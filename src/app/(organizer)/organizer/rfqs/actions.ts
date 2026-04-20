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
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

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

  const admin = await createSupabaseServiceRoleClient();
  const { data: profile } = await admin
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
  in_subcategory: boolean;
};

// Search is intentionally NOT subcategory-scoped — an organizer may want to
// invite a supplier they have an off-platform relationship with even if the
// supplier hasn't self-linked to the subcategory yet. We still annotate each
// hit with `in_subcategory` so the UI can warn on cross-subcategory picks.
export async function searchApprovedSuppliersAction(
  input: unknown,
): Promise<SupplierSearchHit[]> {
  const parsed = SearchInput.safeParse(input);
  if (!parsed.success) return [];

  const supabase = await createSupabaseServerClient();
  const gate = await requireOrganizerRole(supabase);
  if ("error" in gate) return [];

  // ILIKE pattern — escape `%` and `_` conservatively.
  const pattern = `%${parsed.data.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const { data: hitRows } = await supabase
    .from("suppliers")
    .select("id, slug, business_name, base_city")
    .eq("verification_status", "approved")
    .eq("is_published", true)
    .or(`business_name.ilike.${pattern},slug.ilike.${pattern}`)
    .limit(10);

  const hits = (hitRows ?? []) as Array<{
    id: string;
    slug: string;
    business_name: string;
    base_city: string;
  }>;
  if (hits.length === 0) return [];

  // Annotate each hit with whether they serve the target subcategory. A single
  // lookup on the candidate id set keeps this to one extra round-trip.
  const { data: linkRows } = await supabase
    .from("supplier_categories")
    .select("supplier_id")
    .eq("subcategory_id", parsed.data.subcategory_id)
    .in(
      "supplier_id",
      hits.map((h) => h.id),
    );
  const linked = new Set(
    ((linkRows ?? []) as Array<{ supplier_id: string }>).map((r) => r.supplier_id),
  );

  return hits.map((r) => ({
    id: r.id,
    slug: r.slug,
    business_name: r.business_name,
    base_city: r.base_city,
    in_subcategory: linked.has(r.id),
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

  // Route the transactional write through the `send_rfq_tx` RPC so the
  // rfqs insert and the rfq_invites fan-out commit or roll back together.
  // Event ownership is re-verified inside the function (service-role
  // bypasses RLS, so the RPC itself is the enforcement boundary).
  const admin = createSupabaseServiceRoleClient();

  const { data: rpcData, error: rpcErr } = await admin.rpc("send_rfq_tx", {
    p_organizer_id: gate.userId,
    p_event_id: parsed.data.event_id,
    p_category_id: parsed.data.category_id,
    p_subcategory_id: parsed.data.subcategory_id,
    p_requirements: validatedRequirements,
    p_response_deadline_hours: parsed.data.response_deadline_hours,
    p_invites: parsed.data.shortlist,
  });

  if (rpcErr) {
    // Map the structured raise codes to user-facing messages. Unknown codes
    // surface the raw message so Postgres errors aren't silently swallowed.
    const code = rpcErr.code as string | undefined;
    const message = rpcErr.message ?? "unknown error";
    let friendly = `Failed to send RFQ: ${message}`;
    if (code === "P0020") friendly = "Invalid response deadline — choose 24h, 48h, or 72h.";
    else if (code === "P0021") friendly = "Invite list is malformed.";
    else if (code === "P0022") friendly = "Shortlist is empty — pick at least one supplier.";
    else if (code === "P0023") friendly = "Too many suppliers on the shortlist (max 20).";
    else if (code === "P0024") friendly = "Event not found or not accessible.";
    else if (code === "P0025") friendly = "Invalid invite source in shortlist.";
    return { ok: false, error: friendly };
  }

  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const rfqId = (row as { rfq_id?: string } | null)?.rfq_id;
  if (!rfqId) {
    return { ok: false, error: "RFQ creation returned no id." };
  }

  revalidatePath("/organizer/rfqs");
  revalidatePath("/organizer/dashboard");
  revalidatePath(`/organizer/events/${parsed.data.event_id}`);

  return { ok: true, rfq_id: rfqId };
}
