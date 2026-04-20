/**
 * Shared fixtures + helpers for Sprint 4 Lane 5 concurrency integration tests.
 *
 * IMPORTANT: this is NOT a test file. It has no `describe`/`it`/`test`, only
 * helpers. Vitest's default include matches `*.test.ts`, so this file (ending
 * in `.ts`) is intentionally not collected as a suite.
 *
 * Design:
 * - Loads env from .env.local at import time so `import "dotenv/config"` isn't
 *   required in every test file — just importing this module is enough.
 * - `INTEGRATION_ENABLED` is exported so each test file can do
 *   `describe.skipIf(!INTEGRATION_ENABLED)` and the whole suite skips cleanly
 *   when the local Supabase stack isn't up.
 * - `makeAdminClient()` returns a fresh service-role `@supabase/supabase-js`
 *   client per call. We don't share a single client across tests because some
 *   concurrent tests fire many RPC calls and we want independent HTTP
 *   connection pools to more faithfully model production race conditions.
 * - Fixture factories mint uniquely-named rows per test (UUID suffix) so we
 *   can skip cleanup — local dev DB is disposable. This is explicit per the
 *   task instructions: cleanup logic is surprisingly fragile when it spans
 *   events → rfqs → quotes → bookings → availability_blocks FK chains, and
 *   `pnpm db:reset` is the canonical reset.
 */
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  buildRevisionSnapshot,
  type BuildRevisionSnapshotInput,
  QUOTE_ENGINE_VERSION,
} from "@/lib/domain/quote";
import dotenv from "dotenv";
import path from "node:path";

// dotenv/config loads from CWD; make sure .env.local is picked up regardless
// of where Vitest runs from (repo root vs. worktree root).
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * True when the caller has explicitly opted into integration tests (by setting
 * INTEGRATION=1) AND the env has the Supabase URL + service-role key. We gate
 * on both so a partial env in CI still cleanly skips instead of exploding.
 */
export const INTEGRATION_ENABLED: boolean =
  process.env.INTEGRATION === "1" && !!SUPABASE_URL && !!SERVICE_ROLE_KEY;

/**
 * Returns a fresh service-role Supabase client. Each call makes a new client
 * so parallel RPC fires don't share queue state.
 */
export function makeAdminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "Integration tests require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Short marker used across fixtures so future humans can spot test rows in
 * the DB. Not used for cleanup (we don't clean up — see header).
 */
export const TEST_MARKER = "sprint4-lane5-concurrency-test";

/**
 * Unique suffix to keep fixtures per-test isolated. UUID → hex → first 12
 * chars keeps email length reasonable while being effectively collision-free.
 */
export function uniqueSuffix(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

// -----------------------------------------------------------------------------
// Admin + organizer + supplier user creation.
// -----------------------------------------------------------------------------

type UserCreated = { id: string; email: string };

export async function createAuthUser(
  admin: SupabaseClient,
  params: {
    email: string;
    role: "organizer" | "supplier" | "admin";
    fullName: string;
  },
): Promise<UserCreated> {
  const { data, error } = await admin.auth.admin.createUser({
    email: params.email,
    password: "TestPass123!",
    email_confirm: true,
    user_metadata: {
      role: params.role,
      full_name: params.fullName,
    },
  });
  if (error || !data.user) {
    throw new Error(
      `createAuthUser(${params.email}) failed: ${error?.message ?? "no user returned"}`,
    );
  }
  // The handle_new_user trigger already inserted a profiles row. But requested
  // role='admin' is downgraded to 'organizer' by the trigger, so for any role
  // other than 'organizer' we force-update profiles.role via service-role.
  if (params.role !== "organizer") {
    const { error: updErr } = await admin
      .from("profiles")
      .update({ role: params.role })
      .eq("id", data.user.id);
    if (updErr) {
      throw new Error(`profile role update: ${updErr.message}`);
    }
  }
  return { id: data.user.id, email: params.email };
}

export async function createSupplierRow(
  admin: SupabaseClient,
  params: {
    profile_id: string;
    business_name: string;
    concurrent_event_limit?: number;
  },
): Promise<{ id: string }> {
  const suffix = uniqueSuffix();
  const { data, error } = await admin
    .from("suppliers")
    .insert({
      profile_id: params.profile_id,
      business_name: params.business_name,
      slug: `test-supplier-${suffix}`,
      legal_type: "company",
      cr_number: `1010${suffix.slice(0, 6)}`,
      base_city: "Riyadh",
      service_area_cities: ["Riyadh"],
      languages: ["en"],
      capacity: 100,
      concurrent_event_limit: params.concurrent_event_limit ?? 1,
      bio: `Integration test supplier (${TEST_MARKER})`,
      verification_status: "approved",
      is_published: true,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`supplier insert: ${error?.message ?? "no row"}`);
  }
  return { id: data.id as string };
}

/**
 * Look up a (seeded) category slug or fall back to inserting a minimal parent
 * + leaf so the tests work even on a freshly-reset DB where the seed.sql
 * categories might not have been applied yet.
 */
export async function ensureCategory(
  admin: SupabaseClient,
  slug: string,
): Promise<{ id: string; parent_id: string }> {
  const { data: existing } = await admin
    .from("categories")
    .select("id, parent_id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing && existing.parent_id) {
    return {
      id: existing.id as string,
      parent_id: existing.parent_id as string,
    };
  }
  // Fall back: create a parent + leaf for test purposes.
  const parentSlug = `test-parent-${uniqueSuffix()}`;
  const { data: parent, error: parentErr } = await admin
    .from("categories")
    .insert({
      slug: parentSlug,
      name_en: "Test parent",
      name_ar: "اختبار",
      sort_order: 999,
    })
    .select("id")
    .single();
  if (parentErr || !parent) {
    throw new Error(`ensureCategory parent: ${parentErr?.message ?? "no row"}`);
  }
  const childSlug = `${slug}-${uniqueSuffix()}`;
  const { data: child, error: childErr } = await admin
    .from("categories")
    .insert({
      parent_id: parent.id as string,
      slug: childSlug,
      name_en: "Test leaf",
      name_ar: "اختبار",
      sort_order: 1,
    })
    .select("id")
    .single();
  if (childErr || !child) {
    throw new Error(`ensureCategory child: ${childErr?.message ?? "no row"}`);
  }
  return { id: child.id as string, parent_id: parent.id as string };
}

// -----------------------------------------------------------------------------
// Event + RFQ + quote + revision helpers.
// -----------------------------------------------------------------------------

export async function createEvent(
  admin: SupabaseClient,
  params: {
    organizer_id: string;
    /** ISO-8601; defaults to far-future to avoid colliding with seed fixtures. */
    starts_at?: string;
    ends_at?: string;
  },
): Promise<{ id: string; starts_at: string; ends_at: string }> {
  // Default to a random day 6–24 months in the future to minimise the chance
  // of overlapping with any other test's event window on the same supplier.
  const baseDate = new Date();
  baseDate.setUTCFullYear(baseDate.getUTCFullYear() + 2);
  baseDate.setUTCMonth(Math.floor(Math.random() * 12));
  baseDate.setUTCDate(1 + Math.floor(Math.random() * 27));
  baseDate.setUTCHours(18, 0, 0, 0);
  const starts = params.starts_at ?? baseDate.toISOString();
  const endsDate = new Date(starts);
  endsDate.setUTCHours(endsDate.getUTCHours() + 4);
  const ends = params.ends_at ?? endsDate.toISOString();

  const { data, error } = await admin
    .from("events")
    .insert({
      organizer_id: params.organizer_id,
      client_name: `Test event ${uniqueSuffix()}`,
      event_type: "wedding",
      city: "Riyadh",
      starts_at: starts,
      ends_at: ends,
      guest_count: 80,
      notes: TEST_MARKER,
    })
    .select("id, starts_at, ends_at")
    .single();
  if (error || !data) {
    throw new Error(`createEvent: ${error?.message ?? "no row"}`);
  }
  return {
    id: data.id as string,
    starts_at: data.starts_at as string,
    ends_at: data.ends_at as string,
  };
}

export async function createRfq(
  admin: SupabaseClient,
  params: {
    event_id: string;
    category_id: string;
    subcategory_id: string;
  },
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("rfqs")
    .insert({
      event_id: params.event_id,
      category_id: params.category_id,
      subcategory_id: params.subcategory_id,
      status: "sent",
      requirements_jsonb: { marker: TEST_MARKER },
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`createRfq: ${error?.message ?? "no row"}`);
  }
  return { id: data.id as string };
}

/**
 * Build a minimal valid revision snapshot — one free-form package line with a
 * known total. Used purely so `quote_revisions` has a row the RPC can
 * reference; the engine's correctness is covered by Lane 1 tests.
 */
export function makeMinimalSnapshot(params: {
  event_id: string;
  event_starts_at: string;
  event_ends_at: string;
  total_halalas?: number;
}): {
  snapshot: ReturnType<typeof buildRevisionSnapshot>["snapshot"];
  content_hash: string;
} {
  const total = params.total_halalas ?? 500_00; // 500 SAR
  const input: BuildRevisionSnapshotInput = {
    engine_version: QUOTE_ENGINE_VERSION,
    currency: "SAR",
    source: "free_form",
    line_items: [
      {
        kind: "package",
        label: "Integration test package",
        qty: 1,
        unit: "event",
        unit_price_halalas: total,
        total_halalas: total,
      },
    ],
    subtotal_halalas: total,
    travel_fee_halalas: 0,
    setup_fee_halalas: 0,
    teardown_fee_halalas: 0,
    vat_rate_pct: 0,
    vat_amount_halalas: 0,
    total_halalas: total,
    deposit_pct: 30,
    payment_schedule: "deposit",
    cancellation_terms: "standard",
    inclusions: [],
    exclusions: [],
    notes: null,
    expires_at: null,
    inputs: {
      event_id: params.event_id,
      event_starts_at: params.event_starts_at,
      event_ends_at: params.event_ends_at,
      guest_count: null,
      venue_lat: null,
      venue_lng: null,
      package_id: null,
      distance_km: null,
    },
  };
  return buildRevisionSnapshot(input);
}

/**
 * Creates a quotes row in status='sent' with a matching quote_revisions row.
 * Sets `current_revision_id` so `accept_quote_tx` passes its P0005 guard.
 */
export async function seedSentQuote(
  admin: SupabaseClient,
  params: {
    rfq_id: string;
    supplier_id: string;
    supplier_profile_id: string;
    event_id: string;
    event_starts_at: string;
    event_ends_at: string;
  },
): Promise<{ quote_id: string; revision_id: string }> {
  // 1. Insert quote in draft (current_revision_id NULL is allowed initially).
  const { data: q, error: qErr } = await admin
    .from("quotes")
    .insert({
      rfq_id: params.rfq_id,
      supplier_id: params.supplier_id,
      source: "free_form",
      status: "draft",
      currency: "SAR",
    })
    .select("id")
    .single();
  if (qErr || !q) throw new Error(`seedSentQuote insert quote: ${qErr?.message}`);
  const quote_id = q.id as string;

  // 2. Insert the revision (v1).
  const { snapshot, content_hash } = makeMinimalSnapshot({
    event_id: params.event_id,
    event_starts_at: params.event_starts_at,
    event_ends_at: params.event_ends_at,
  });
  const { data: rev, error: revErr } = await admin
    .from("quote_revisions")
    .insert({
      quote_id,
      version: 1,
      author_id: params.supplier_profile_id,
      snapshot_jsonb: snapshot,
      content_hash,
    })
    .select("id")
    .single();
  if (revErr || !rev) {
    throw new Error(`seedSentQuote insert revision: ${revErr?.message}`);
  }
  const revision_id = rev.id as string;

  // 3. Promote quote to sent with current_revision_id pointing at v1.
  const { error: updErr } = await admin
    .from("quotes")
    .update({
      status: "sent",
      current_revision_id: revision_id,
      sent_at: new Date().toISOString(),
    })
    .eq("id", quote_id);
  if (updErr) throw new Error(`seedSentQuote promote: ${updErr.message}`);

  return { quote_id, revision_id };
}

// -----------------------------------------------------------------------------
// Parallel RPC result classification.
// -----------------------------------------------------------------------------

/**
 * Shape of a successful `accept_quote_tx` response row.
 *
 * PostgREST returns `returns table(...)` functions as an array; when rpc()
 * is called without `.single()`, we get `data: Array<{booking_id, block_id}>`
 * with length 1. We keep the parsing explicit.
 */
export type AcceptQuoteSuccessRow = { booking_id: string; block_id: string };

export type AcceptQuoteOutcome =
  | { kind: "success"; row: AcceptQuoteSuccessRow }
  | { kind: "error"; code: string | null; message: string; raw: unknown };

/**
 * Classify a PostgREST rpc() result. Our RPCs raise with errcode 'P000X';
 * supabase-js surfaces that in `error.code`. Some error shapes only carry
 * the message — we fall back to parsing 'Pxxxx' from message text.
 */
export function classifyAcceptResult(
  data: unknown,
  error: unknown,
): AcceptQuoteOutcome {
  if (error) {
    const err = error as { code?: string; message?: string };
    // Prefer structured code; fall back to sniffing the message for 'PXXXX'.
    let code: string | null = err.code ?? null;
    if (!code && typeof err.message === "string") {
      const m = err.message.match(/P\d{4}/);
      if (m) code = m[0];
    }
    return {
      kind: "error",
      code,
      message: err.message ?? String(error),
      raw: error,
    };
  }
  if (Array.isArray(data) && data.length === 1) {
    const row = data[0] as AcceptQuoteSuccessRow;
    if (row && typeof row.booking_id === "string" && typeof row.block_id === "string") {
      return { kind: "success", row };
    }
  }
  return {
    kind: "error",
    code: null,
    message: `unexpected RPC shape: ${JSON.stringify(data)}`,
    raw: data,
  };
}

/**
 * Extract the P-code (e.g. 'P0007') from an error outcome's raw error for
 * diagnostic assertions.
 */
export function codeOf(outcome: AcceptQuoteOutcome): string | null {
  return outcome.kind === "error" ? outcome.code : null;
}
