/**
 * Sevent auto-match engine — ranker only.
 *
 * Contract:
 * - Hard filters (approved + published, category, city OR service-area match,
 *   no availability overlap on the event window, concurrent-event capacity
 *   remaining, at least one package whose `[min_qty, max_qty]` range covers
 *   `event.guest_count`) happen SQL-side in `query.ts::fetchAutoMatchCandidates`.
 *   This function assumes every candidate has already passed those filters.
 * - This function only **ranks** the candidates and returns the ordered top-N
 *   list with a score breakdown + human-readable reasons.
 *
 * Weights (Codex-approved — keep in sync with Claude Docs/state-machines.md):
 *   - 0.45  capability   — category/subcategory match + package qty coverage
 *   - 0.20  travel       — same city > service-area city > out-of-area
 *   - 0.15  responsiveness — 30d response rate, 0.5 neutral when insufficient data
 *   - 0.10  booking_quality — verified/approved + bio completeness (v1 proxy)
 *   - 0.10  rotation     — soft penalty on suppliers with many invites in 14d
 *
 * Determinism: this function MUST produce stable output for a given input.
 * Tie-break by `supplier_id` ASC after rounding scores to 4 decimal places.
 */

export type AutoMatchContext = {
  event: {
    id: string;
    city: string;
    starts_at: string;
    ends_at: string;
    guest_count: number | null;
  };
  category_id: string;
  subcategory_id: string;
};

export type AutoMatchCandidate = {
  supplier_id: string;
  business_name: string;
  slug: string;
  base_city: string;
  service_area_cities: string[];
  concurrent_event_limit: number;
  active_overlaps: number;
  packages: Array<{
    id: string;
    min_qty: number;
    max_qty: number | null;
    base_price_halalas: number;
  }>;
  response_rate_30d: number | null;
  invites_last_14d: number;
};

export type MatchBreakdown = {
  capability: number;
  travel: number;
  responsiveness: number;
  booking_quality: number;
  rotation: number;
  total: number;
};

export type MatchResult = {
  supplier_id: string;
  business_name: string;
  slug: string;
  breakdown: MatchBreakdown;
  reasons: string[];
};

export function computeAutoMatch(
  _ctx: AutoMatchContext,
  _candidates: AutoMatchCandidate[],
): MatchResult[] {
  throw new Error("computeAutoMatch not implemented — Lane 2");
}
