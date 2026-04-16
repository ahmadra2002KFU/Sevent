"use server";

/**
 * Lane 3 · Sprint 3 — organizer RFQ server actions.
 *
 * Owns:
 *   - `listMyEventsAction`          wizard step 1 prefill
 *   - `listCategoriesAction`        wizard step 1 cascading selects
 *   - `previewAutoMatchAction`      wizard step 3 auto-match preview
 *   - `searchApprovedSuppliersAction` wizard step 3 manual add
 *   - `sendRfqAction`               wizard step 4 final write
 *
 * Role gating: every mutating entry point re-checks `profiles.role` before
 * touching the DB; RLS is the second line of defence.
 *
 * Conditional-upsert caveat: `sendRfqAction` upserts rfq_invites on
 * (rfq_id, supplier_id). This means re-invoking the action with a shortlist
 * that reuses a supplier_id whose invite is already `quoted` or `declined`
 * would overwrite that status back to `invited`. Sprint 6 will tighten this
 * with a dedicated RPC that only allows invited↔withdrawn transitions.
 */

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import {
  computeAutoMatch,
  type AutoMatchContext,
  type MatchResult,
} from "@/lib/domain/matching/autoMatch";
import { fetchAutoMatchCandidates } from "@/lib/domain/matching/query";
import { parseRfqExtension, type RfqExtensionKind } from "@/lib/domain/rfq";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["organizer", "agency", "admin"] as const;

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function requireOrganizerRole(
  supabase: SupabaseServerClient,
): Promise<{ userId: string } | { error: string }> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "You must be signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as { role: string } | null)?.role;
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    return { error: "Organizer, agency, or admin role required." };
  }
  return { userId: user.id };
}

// ---------------------------------------------------------------------------
// listMyEventsAction
// ---------------------------------------------------------------------------

export type OrganizerEventSummary = {
  id: string;
  event_type: string;
  client_name: string | null;
  city: string;
  starts_at: string;
  ends_at: string;
  guest_count: number | null;
};

export async function listMyEventsAction(): Promise<OrganizerEventSummary[]> {
  const supabase = await createSupabaseServerClient();
  const gate = await requireOrganizerRole(supabase);
  if ("error" in gate) return [];

  const { data } = await supabase
    .from("events")
    .select("id, event_type, client_name, city, starts_at, ends_at, guest_count")
    .order("starts_at", { ascending: true });

  return ((data ?? []) as Array<OrganizerEventSummary>).map((row) => ({
    id: row.id,
    event_type: row.event_type,
    client_name: row.client_name,
    city: row.city,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    guest_count: row.guest_count,
  }));
}

// ---------------------------------------------------------------------------
// listCategoriesAction
// ---------------------------------------------------------------------------

export type CategoryOption = {
  id: string;
  parent_id: string | null;
  slug: string;
  name_en: string;
  sort_order: number;
};

export type CategoriesBundle = {
  parents: CategoryOption[];
  children: CategoryOption[];
};

export async function listCategoriesAction(): Promise<CategoriesBundle> {
  const supabase = await createSupabaseServerClient();
  // Categories are public-readable per Lane 0 migration — no role gate needed.
  const { data } = await supabase
    .from("categories")
    .select("id, parent_id, slug, name_en, sort_order")
    .order("sort_order", { ascending: true });

  const rows = (data ?? []) as CategoryOption[];
  return {
    parents: rows.filter((r) => r.parent_id === null),
    children: rows.filter((r) => r.parent_id !== null),
  };
}

// ---------------------------------------------------------------------------
// previewAutoMatchAction
// ---------------------------------------------------------------------------

const PreviewInput = z.object({
  event_id: z.string().uuid(),
  category_id: z.string().uuid(),
  subcategory_id: z.string().uuid(),
});

export type PreviewAutoMatchResult =
  | { ok: true; matches: MatchResult[] }
  | { ok: false; error: "matching_offline" | "event_not_found" | "invalid_input" | "forbidden" };

export async function previewAutoMatchAction(
  input: unknown,
): Promise<PreviewAutoMatchResult> {
  const parsed = PreviewInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createSupabaseServerClient();
  const gate = await requireOrganizerRole(supabase);
  if ("error" in gate) return { ok: false, error: "forbidden" };

  // RLS scopes `events` to the caller's rows (and admins). If this returns no
  // row, the organizer does not own the event (or it doesn't exist).
  const { data: eventRow } = await supabase
    .from("events")
    .select("id, city, starts_at, ends_at, guest_count")
    .eq("id", parsed.data.event_id)
    .maybeSingle();

  if (!eventRow) return { ok: false, error: "event_not_found" };
  const ev = eventRow as {
    id: string;
    city: string;
    starts_at: string;
    ends_at: string;
    guest_count: number | null;
  };

  const ctx: AutoMatchContext = {
    event: {
      id: ev.id,
      city: ev.city,
      starts_at: ev.starts_at,
      ends_at: ev.ends_at,
      guest_count: ev.guest_count,
    },
    category_id: parsed.data.category_id,
    subcategory_id: parsed.data.subcategory_id,
  };

  try {
    const candidates = await fetchAutoMatchCandidates(ctx);
    const matches = computeAutoMatch(ctx, candidates);
    return { ok: true, matches };
  } catch {
    // Matching is a Sprint 3 experimental surface — surface a clean
    // "matching_offline" so the wizard can still proceed with manual picks.
    return { ok: false, error: "matching_offline" };
  }
}

// ---------------------------------------------------------------------------
// searchApprovedSuppliersAction
// ---------------------------------------------------------------------------

const SearchInput = z.object({
  subcategory_id: z.string().uuid(),
  q: z.string().trim().min(1).max(120),
});

export type SupplierSearchHit = {
  id: string;
  slug: string;
  business_name: string;
  base_city: string;
};

export async function searchApprovedSuppliersAction(
  input: unknown,
): Promise<SupplierSearchHit[]> {
  const parsed = SearchInput.safeParse(input);
  if (!parsed.success) return [];

  const supabase = await createSupabaseServerClient();
  const gate = await requireOrganizerRole(supabase);
  if ("error" in gate) return [];

  // Step 1 — supplier ids linked to the subcategory.
  const { data: linkRows } = await supabase
    .from("supplier_categories")
    .select("supplier_id")
    .eq("subcategory_id", parsed.data.subcategory_id);

  const ids = Array.from(
    new Set(((linkRows ?? []) as Array<{ supplier_id: string }>).map((r) => r.supplier_id)),
  );
  if (ids.length === 0) return [];

  // Step 2 — filter approved + published + name/slug match. ILIKE via
  // PostgREST's `ilike` operator; escape `%` and `_` conservatively.
  const pattern = `%${parsed.data.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const { data } = await supabase
    .from("suppliers")
    .select("id, slug, business_name, base_city")
    .in("id", ids)
    .eq("verification_status", "approved")
    .eq("is_published", true)
    .or(`business_name.ilike.${pattern},slug.ilike.${pattern}`)
    .limit(10);

  return ((data ?? []) as SupplierSearchHit[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    business_name: r.business_name,
    base_city: r.base_city,
  }));
}

// ---------------------------------------------------------------------------
// sendRfqAction
// ---------------------------------------------------------------------------

const ShortlistEntry = z.object({
  supplier_id: z.string().uuid(),
  source: z.enum(["auto_match", "organizer_picked"]),
});

const SendRfqInput = z.object({
  event_id: z.string().uuid(),
  category_id: z.string().uuid(),
  subcategory_id: z.string().uuid(),
  requirements: z.object({ kind: z.enum(["venues", "catering", "photography", "generic"]) }).passthrough(),
  response_deadline_hours: z.union([z.literal(24), z.literal(48), z.literal(72)]),
  shortlist: z.array(ShortlistEntry).min(1).max(10),
});

export type SendRfqResult =
  | { ok: true; rfq_id: string }
  | { ok: false; error: string; issues?: string[] };

export async function sendRfqAction(input: unknown): Promise<SendRfqResult> {
  const parsed = SendRfqInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid RFQ submission.",
      issues: parsed.error.issues.map((i) =>
        i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
      ),
    };
  }

  const supabase = await createSupabaseServerClient();
  const gate = await requireOrganizerRole(supabase);
  if ("error" in gate) return { ok: false, error: gate.error };

  // Re-parse the requirements payload with the discriminated-union schema.
  // `parseRfqExtension` throws ZodError on bad shape — translate to a result.
  const kind = (parsed.data.requirements as { kind: RfqExtensionKind }).kind;
  let validatedRequirements: unknown;
  try {
    validatedRequirements = parseRfqExtension(kind, parsed.data.requirements);
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        ok: false,
        error: "Invalid requirements payload.",
        issues: err.issues.map((i) =>
          i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
        ),
      };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Invalid requirements." };
  }

  // Verify the caller owns the event. RLS already scopes this but we surface
  // a clean error when the record is not found.
  const { data: eventRow } = await supabase
    .from("events")
    .select("id")
    .eq("id", parsed.data.event_id)
    .maybeSingle();
  if (!eventRow) return { ok: false, error: "Event not found or not accessible." };

  // Insert the RFQ row.
  const nowIso = new Date().toISOString();
  const { data: rfqInsert, error: rfqErr } = await supabase
    .from("rfqs")
    .insert({
      event_id: parsed.data.event_id,
      category_id: parsed.data.category_id,
      subcategory_id: parsed.data.subcategory_id,
      status: "sent" as const,
      requirements_jsonb: validatedRequirements,
      sent_at: nowIso,
    })
    .select("id")
    .single();

  if (rfqErr || !rfqInsert) {
    return {
      ok: false,
      error: `Failed to create RFQ: ${rfqErr?.message ?? "unknown error"}`,
    };
  }

  const rfqId = (rfqInsert as { id: string }).id;

  // Invite upsert.
  //
  // We upsert on (rfq_id, supplier_id) so re-sending the wizard for the same
  // RFQ is idempotent. Trade-off: an existing invite row with status=quoted
  // or declined WILL be overwritten back to invited. Acceptable in Sprint 3
  // because the wizard always creates a fresh RFQ (no edit flow yet).
  // Sprint 6 will replace this with an RPC that allows only invited↔withdrawn
  // transitions and never regresses terminal statuses.
  const responseDueAtIso = new Date(
    Date.now() + parsed.data.response_deadline_hours * 60 * 60 * 1000,
  ).toISOString();

  const inviteRows = parsed.data.shortlist.map((entry) => ({
    rfq_id: rfqId,
    supplier_id: entry.supplier_id,
    source: entry.source,
    status: "invited" as const,
    sent_at: nowIso,
    response_due_at: responseDueAtIso,
  }));

  const { error: inviteErr } = await supabase
    .from("rfq_invites")
    .upsert(inviteRows, { onConflict: "rfq_id,supplier_id" });

  if (inviteErr) {
    return {
      ok: false,
      error: `RFQ created but invites failed: ${inviteErr.message}`,
    };
  }

  revalidatePath("/organizer/rfqs");
  revalidatePath("/organizer/dashboard");
  revalidatePath(`/organizer/events/${parsed.data.event_id}`);

  return { ok: true, rfq_id: rfqId };
}
