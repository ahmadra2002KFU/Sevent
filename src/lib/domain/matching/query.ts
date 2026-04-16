/**
 * Sevent auto-match — hard-filter query.
 *
 * This module owns the SQL-side hard filters applied before ranking:
 *   - suppliers.verification_status = 'approved' AND suppliers.is_published
 *   - supplier_categories.subcategory_id matches `ctx.subcategory_id`
 *   - base_city = ctx.event.city OR ctx.event.city = ANY(service_area_cities)
 *   - NO availability_block overlapping [ctx.event.starts_at, ctx.event.ends_at]
 *   - concurrent_event_limit - current_overlaps > 0 on the event window
 *   - at least one active package whose [min_qty, max_qty] covers
 *     ctx.event.guest_count (if provided; unfiltered when guest_count is null)
 *
 * The actual SQL implementation lands in Lane 2. Ranker-side logic must not
 * try to re-apply any of these filters — it consumes the pre-filtered list.
 */

import type { AutoMatchCandidate, AutoMatchContext } from "./autoMatch";

export async function fetchAutoMatchCandidates(
  _ctx: AutoMatchContext,
): Promise<AutoMatchCandidate[]> {
  throw new Error("fetchAutoMatchCandidates not implemented — Lane 2");
}
