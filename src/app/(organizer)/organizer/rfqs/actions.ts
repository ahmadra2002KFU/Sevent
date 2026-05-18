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
import { parseRfqExtension, RfqFormInput, type RfqExtensionKind } from "@/lib/domain/rfq";
import { requireAccess } from "@/lib/auth/access";
import { createNotification } from "@/lib/notifications/inApp";
import { env } from "@/lib/env";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

function appUrl(): string {
  return env?.APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
}

async function requireOrganizerRole(): Promise<
  { userId: string } | { error: string }
> {
  const { user } = await requireAccess("organizer.rfqs");
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
  const gate = await requireOrganizerRole();
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
  name_ar: string;
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
    .select("id, parent_id, slug, name_en, name_ar, sort_order")
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
  const gate = await requireOrganizerRole();
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
  const gate = await requireOrganizerRole();
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

// SendRfqInput is RfqFormInput + a shortlist. We accept the requirements
// blob loosely here (discriminated-union shape is re-validated via
// parseRfqExtension below) so the Zod parse fails cleanly rather than on a
// nested shape mismatch the UI can't report.
const SendRfqInput = RfqFormInput.extend({
  requirements: z
    .object({ kind: z.enum(["venues", "catering", "photography", "generic"]) })
    .passthrough(),
  // Shortlist can be empty when `publish_to_marketplace` is true — suppliers
  // discover the RFQ themselves via the marketplace. The refinement below
  // enforces "shortlist OR marketplace must reach someone".
  shortlist: z.array(ShortlistEntry).min(0).max(10),
  // Defaults to true (user chose "ON by default, organizer opts out"); if the
  // caller omits it entirely we publish the new RFQ to the marketplace.
  publish_to_marketplace: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.shortlist.length === 0 && !data.publish_to_marketplace) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["shortlist"],
      message:
        "Add at least one supplier, or enable 'Publish to marketplace' to let suppliers self-apply.",
    });
  }
});

// The failure branch carries a stable `code` (mapped at the render boundary to
// `organizer.rfqWizard.errors.*`) — never user-facing prose. `issues` is the
// Zod path:message detail kept for client-side debugging only; it is not shown
// to users.
export type SendRfqResult =
  | { ok: true; rfq_id: string }
  | { ok: false; code: string; issues?: string[] };

export async function sendRfqAction(input: unknown): Promise<SendRfqResult> {
  const parsed = SendRfqInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalidSubmission",
      issues: parsed.error.issues.map((i) =>
        i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
      ),
    };
  }

  const gate = await requireOrganizerRole();
  if ("error" in gate) return { ok: false, code: "forbidden" };

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
        code: "invalidRequirements",
        issues: err.issues.map((i) =>
          i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
        ),
      };
    }
    // Never surface a raw thrown message — fold to the stable code.
    return { ok: false, code: "invalidRequirements" };
  }

  // Route the transactional write through the `send_rfq_tx` RPC so the
  // rfqs insert (including the marketplace visibility flag) and the
  // rfq_invites fan-out commit or roll back together. Event ownership is
  // re-verified inside the function (service-role bypasses RLS, so the
  // RPC itself is the enforcement boundary).
  //
  // Pre-Stage-4 the marketplace flag was flipped via a separate UPDATE
  // AFTER the RPC succeeded; if that UPDATE failed (transient error / RLS
  // regression / lock timeout) the RFQ existed in the wrong visibility
  // state with no atomic recovery. The 20260517100000 migration added
  // `p_is_published_to_marketplace` to the RPC signature so the value is
  // set on the insert itself.
  const admin = createSupabaseServiceRoleClient();

  const { data: rpcData, error: rpcErr } = await admin.rpc("send_rfq_tx", {
    p_organizer_id: gate.userId,
    p_event_id: parsed.data.event_id,
    p_category_id: parsed.data.category_id,
    p_subcategory_id: parsed.data.subcategory_id,
    p_requirements: validatedRequirements,
    p_response_deadline_hours: parsed.data.response_deadline_hours,
    p_invites: parsed.data.shortlist,
    p_is_published_to_marketplace: parsed.data.publish_to_marketplace,
  });

  if (rpcErr) {
    // Map the structured raise codes to stable error-code keys. Unknown codes
    // fold to `unknown` — we never surface the raw Postgres message.
    const pgCode = rpcErr.code as string | undefined;
    let code = "unknown";
    if (pgCode === "P0020") code = "invalidDeadline";
    else if (pgCode === "P0021") code = "inviteListMalformed";
    else if (pgCode === "P0022") code = "shortlistEmpty";
    else if (pgCode === "P0023") code = "shortlistTooLarge";
    else if (pgCode === "P0024") code = "eventNotFound";
    else if (pgCode === "P0025") code = "invalidInviteSource";
    else {
      console.error("[sendRfqAction] send_rfq_tx failed", {
        code: pgCode ?? null,
        message: rpcErr.message,
      });
    }
    return { ok: false, code };
  }

  // Note: RETURNS TABLE columns are `out_rfq_id` / `out_invite_count`
  // after the 20260420060000 ambiguity fix — do NOT rename them back
  // without re-aliasing every unqualified reference in the function body.
  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const rfqId = (row as { out_rfq_id?: string } | null)?.out_rfq_id;
  if (!rfqId) {
    return { ok: false, code: "rfqCreateNoId" };
  }

  // Marketplace publish flag is now set atomically inside `send_rfq_tx`
  // (see the 20260517100000 migration). The follow-up UPDATE was removed
  // because a failure there would have left the RFQ in the wrong
  // visibility state after a successful RPC, with no rollback. Anything
  // touching `is_published_to_marketplace` post-create must go through a
  // dedicated mutation action that revalidates the path on success.

  // Best-effort: write an `rfq.invited` in-app notification for each invited
  // supplier. A DB trigger + email worker (built separately) turns each one
  // into a "new opportunity" email — so the payload keys below become React
  // component props and must match the agreed contract exactly. The RFQ is
  // already committed; a notification failure must NEVER fail this action.
  if (parsed.data.shortlist.length > 0) {
    try {
      // Event type — fallback to a generic label if the row is missing.
      const { data: eventRow } = await admin
        .from("events")
        .select("event_type")
        .eq("id", parsed.data.event_id)
        .maybeSingle();
      const eventType =
        (eventRow as { event_type?: string } | null)?.event_type ?? "your event";

      // Category names (bilingual) for the opportunity email.
      const { data: categoryRow } = await admin
        .from("categories")
        .select("name_en, name_ar")
        .eq("id", parsed.data.subcategory_id)
        .maybeSingle();
      const categoryNameEn =
        (categoryRow as { name_en?: string } | null)?.name_en ?? "";
      const categoryNameAr =
        (categoryRow as { name_ar?: string } | null)?.name_ar ?? "";

      // The invites just created by the RPC — id + supplier_id + due date.
      const { data: inviteRows } = await admin
        .from("rfq_invites")
        .select("id, supplier_id, response_due_at")
        .eq("rfq_id", rfqId);
      const invites = (inviteRows ?? []) as Array<{
        id: string;
        supplier_id: string;
        response_due_at: string | null;
      }>;

      // The notification must land on the supplier user's profile row, not the
      // supplier entity id — resolve supplier_id → profile_id in one lookup.
      const supplierProfileMap = new Map<string, string>();
      if (invites.length > 0) {
        const { data: supplierRows } = await admin
          .from("suppliers")
          .select("id, profile_id")
          .in(
            "id",
            invites.map((inv) => inv.supplier_id),
          );
        for (const s of (supplierRows ?? []) as Array<{
          id: string;
          profile_id: string | null;
        }>) {
          if (s.id && s.profile_id) supplierProfileMap.set(s.id, s.profile_id);
        }
      }

      // Fan out the notifications in parallel. Each closure has its own
      // try/catch so one flaky insert cannot cascade.
      await Promise.all(
        invites.map(async (invite) => {
          const profileId = supplierProfileMap.get(invite.supplier_id);
          if (!profileId) return;
          try {
            await createNotification({
              supabase: admin,
              user_id: profileId,
              kind: "rfq.invited",
              payload: {
                rfq_id: rfqId,
                invite_id: invite.id,
                event_type: eventType,
                category_name_en: categoryNameEn,
                category_name_ar: categoryNameAr,
                response_due_at: invite.response_due_at,
                opportunity_url: `${appUrl()}/supplier/rfqs/${invite.id}`,
              },
            });
          } catch (e) {
            console.error("[sendRfqAction] notify rfq.invited failed", {
              invite_id: invite.id,
              error: e,
            });
          }
        }),
      );
    } catch (e) {
      console.error("[sendRfqAction] rfq.invited notification step failed", e);
    }
  }

  revalidatePath("/organizer/rfqs");
  revalidatePath("/organizer/dashboard");
  revalidatePath(`/organizer/events/${parsed.data.event_id}`);

  return { ok: true, rfq_id: rfqId };
}
