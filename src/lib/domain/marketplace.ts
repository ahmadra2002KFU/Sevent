/**
 * Read-side DTOs + queries for the supplier opportunities marketplace.
 *
 * Server-side only — do not import from client components. Mirrors the
 * pattern of `publicBrowse.ts` and `supplierProfile.ts`:
 *   - `createSupabaseServerClient` for user-scoped reads (RLS-gated).
 *   - Small typed DTOs at the boundary.
 *   - Business rules (exclude RFQs the caller already has an invite for)
 *     applied in TypeScript so the filter pipeline stays readable.
 *
 * RLS gate:
 *   - `rfqs: marketplace supplier read` lets an approved+published supplier
 *     read any RFQ where `is_published_to_marketplace AND status='sent'`.
 *   - The `exclude-already-invited` rule is applied here in TS after pulling
 *     the candidate set, because the RFQ rows the caller has an invite for
 *     are already readable under `rfqs: invited supplier read` — a DB-side
 *     anti-join would need a raw SQL function we don't need yet.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EventType } from "@/lib/supabase/types";

export type MarketplaceFilters = {
  /** Parent category id (optional). */
  category_id?: string | null;
  /** Child subcategory id (optional). */
  subcategory_id?: string | null;
  /** City slug from `src/lib/domain/cities.ts`. */
  city?: string | null;
  /** Market segment (event_type) slug. */
  segment?: EventType | null;
  /** Inclusive lower bound for event start (YYYY-MM-DD). */
  startsFrom?: string | null;
  /** Inclusive upper bound for event start (YYYY-MM-DD). */
  startsTo?: string | null;
  /** Budget window, in halalas. Matches an RFQ whose event budget range
   *  overlaps the supplier's [budgetMinHalalas, budgetMaxHalalas] interval. */
  budgetMinHalalas?: number | null;
  budgetMaxHalalas?: number | null;
};

export type MarketplaceOpportunity = {
  rfq_id: string;
  sent_at: string | null;
  expires_at: string | null;
  category: {
    id: string;
    slug: string;
    name_en: string;
    name_ar: string | null;
  } | null;
  subcategory: {
    id: string;
    slug: string;
    name_en: string;
    name_ar: string | null;
  } | null;
  event: {
    id: string;
    city: string;
    starts_at: string;
    ends_at: string;
    guest_count: number | null;
    event_type: EventType;
    budget_min_halalas: number | null;
    budget_max_halalas: number | null;
  };
};

/**
 * Lists marketplace opportunities visible to the caller. The caller MUST be
 * an approved+published supplier — the route gate enforces this.
 *
 * Returns RFQs in `sent` state with `is_published_to_marketplace=true`,
 * excluding ones the supplier already has an `rfq_invites` row for (regardless
 * of that row's source/status — the goal is to hide already-handled RFQs).
 */
export async function listMarketplaceOpportunities(
  params: {
    supplier_id: string;
    filters: MarketplaceFilters;
  },
): Promise<MarketplaceOpportunity[]> {
  const supabase = await createSupabaseServerClient();

  // 1. Fetch every invite row for this supplier so we can exclude the joined
  //    RFQs. A Set keeps the downstream .filter() O(1).
  const { data: inviteRows } = await supabase
    .from("rfq_invites")
    .select("rfq_id")
    .eq("supplier_id", params.supplier_id);
  const excludedRfqIds = new Set<string>(
    ((inviteRows ?? []) as Array<{ rfq_id: string }>).map((r) => r.rfq_id),
  );

  // 2. Fetch candidate RFQs via RLS. The relational select pulls the event +
  //    both category rows in one hop. Supabase returns `categories` as an
  //    array when the foreign key is ambiguous — we use the named FK hint
  //    (same pattern as the supplier quote builder loader).
  type RfqJoinRow = {
    id: string;
    sent_at: string | null;
    expires_at: string | null;
    events:
      | {
          id: string;
          city: string;
          starts_at: string;
          ends_at: string;
          guest_count: number | null;
          event_type: EventType;
          budget_range_min_halalas: number | null;
          budget_range_max_halalas: number | null;
        }
      | null;
    category:
      | {
          id: string;
          slug: string;
          name_en: string;
          name_ar: string | null;
        }
      | null;
    subcategory:
      | {
          id: string;
          slug: string;
          name_en: string;
          name_ar: string | null;
        }
      | null;
  };

  const { data: rfqRows, error } = await supabase
    .from("rfqs")
    .select(
      `id, sent_at, expires_at,
       events (
         id, city, starts_at, ends_at, guest_count, event_type,
         budget_range_min_halalas, budget_range_max_halalas
       ),
       category:categories!rfqs_category_id_fkey (
         id, slug, name_en, name_ar
       ),
       subcategory:categories!rfqs_subcategory_id_fkey (
         id, slug, name_en, name_ar
       )`,
    )
    .eq("is_published_to_marketplace", true)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(200);
  if (error) return [];

  const rows = (rfqRows ?? []) as unknown as RfqJoinRow[];

  // 3. Apply filters client-side. The candidate set is bounded (<=200) and
  //    most filters boil down to column comparisons that don't benefit from
  //    SQL pushdown at our pilot scale.
  const filters = params.filters;
  const now = Date.now();

  const filtered = rows
    .filter((r) => !excludedRfqIds.has(r.id))
    .filter((r) => r.events !== null)
    .filter((r) => {
      // Skip expired RFQs so suppliers don't waste a click.
      if (r.expires_at && new Date(r.expires_at).getTime() < now) return false;
      return true;
    })
    .filter((r) => {
      if (!filters.category_id) return true;
      return r.category?.id === filters.category_id;
    })
    .filter((r) => {
      if (!filters.subcategory_id) return true;
      return r.subcategory?.id === filters.subcategory_id;
    })
    .filter((r) => {
      if (!filters.city) return true;
      return r.events?.city === filters.city;
    })
    .filter((r) => {
      if (!filters.segment) return true;
      return r.events?.event_type === filters.segment;
    })
    .filter((r) => {
      if (!filters.startsFrom) return true;
      const eventDay = r.events?.starts_at.slice(0, 10) ?? "";
      return eventDay >= filters.startsFrom;
    })
    .filter((r) => {
      if (!filters.startsTo) return true;
      const eventDay = r.events?.starts_at.slice(0, 10) ?? "";
      return eventDay <= filters.startsTo;
    })
    .filter((r) => {
      // Budget overlap: [bMin,bMax] ∩ [fMin,fMax] non-empty. Null endpoints
      // mean "unbounded on that side".
      const bMin = r.events?.budget_range_min_halalas ?? null;
      const bMax = r.events?.budget_range_max_halalas ?? null;
      const fMin = filters.budgetMinHalalas ?? null;
      const fMax = filters.budgetMaxHalalas ?? null;
      if (fMin !== null && bMax !== null && bMax < fMin) return false;
      if (fMax !== null && bMin !== null && bMin > fMax) return false;
      return true;
    });

  return filtered.map<MarketplaceOpportunity>((r) => ({
    rfq_id: r.id,
    sent_at: r.sent_at,
    expires_at: r.expires_at,
    category: r.category,
    subcategory: r.subcategory,
    event: {
      id: r.events!.id,
      city: r.events!.city,
      starts_at: r.events!.starts_at,
      ends_at: r.events!.ends_at,
      guest_count: r.events!.guest_count,
      event_type: r.events!.event_type,
      budget_min_halalas: r.events!.budget_range_min_halalas,
      budget_max_halalas: r.events!.budget_range_max_halalas,
    },
  }));
}

/**
 * Returns a single opportunity DTO for the detail page. Caller MUST be an
 * approved+published supplier; RLS enforces the visibility gate.
 * Returns `null` if the RFQ is not published, already expired, or the caller
 * already has an invite row for it (in which case they should use their
 * regular RFQ inbox, not the marketplace apply flow).
 */
export async function getMarketplaceOpportunity(params: {
  rfq_id: string;
  supplier_id: string;
}): Promise<
  | (MarketplaceOpportunity & {
      requirements_jsonb: unknown;
      response_due_at: string | null;
    })
  | null
> {
  const supabase = await createSupabaseServerClient();

  // Early-out if the supplier already has an invite — they should use their
  // RFQ inbox, not the marketplace apply path.
  const { data: existing } = await supabase
    .from("rfq_invites")
    .select("id")
    .eq("rfq_id", params.rfq_id)
    .eq("supplier_id", params.supplier_id)
    .maybeSingle();
  if (existing) return null;

  const { data: rfqRow } = await supabase
    .from("rfqs")
    .select(
      `id, sent_at, expires_at, requirements_jsonb,
       events (
         id, city, starts_at, ends_at, guest_count, event_type,
         budget_range_min_halalas, budget_range_max_halalas
       ),
       category:categories!rfqs_category_id_fkey (
         id, slug, name_en, name_ar
       ),
       subcategory:categories!rfqs_subcategory_id_fkey (
         id, slug, name_en, name_ar
       )`,
    )
    .eq("id", params.rfq_id)
    .eq("is_published_to_marketplace", true)
    .eq("status", "sent")
    .maybeSingle();

  if (!rfqRow) return null;

  const row = rfqRow as unknown as {
    id: string;
    sent_at: string | null;
    expires_at: string | null;
    requirements_jsonb: unknown;
    events:
      | {
          id: string;
          city: string;
          starts_at: string;
          ends_at: string;
          guest_count: number | null;
          event_type: EventType;
          budget_range_min_halalas: number | null;
          budget_range_max_halalas: number | null;
        }
      | null;
    category:
      | {
          id: string;
          slug: string;
          name_en: string;
          name_ar: string | null;
        }
      | null;
    subcategory:
      | {
          id: string;
          slug: string;
          name_en: string;
          name_ar: string | null;
        }
      | null;
  };

  if (!row.events) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }

  return {
    rfq_id: row.id,
    sent_at: row.sent_at,
    expires_at: row.expires_at,
    category: row.category,
    subcategory: row.subcategory,
    event: {
      id: row.events.id,
      city: row.events.city,
      starts_at: row.events.starts_at,
      ends_at: row.events.ends_at,
      guest_count: row.events.guest_count,
      event_type: row.events.event_type,
      budget_min_halalas: row.events.budget_range_min_halalas,
      budget_max_halalas: row.events.budget_range_max_halalas,
    },
    requirements_jsonb: row.requirements_jsonb,
    response_due_at: row.expires_at,
  };
}
