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

import { reasonsFor } from "./reasons";

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

// Locked weights — keep in sync with Claude Docs/state-machines.md.
const W_CAPABILITY = 0.45;
const W_TRAVEL = 0.2;
const W_RESPONSIVENESS = 0.15;
const W_BOOKING_QUALITY = 0.1;
const W_ROTATION = 0.1;

const TOP_N = 5;
const ROUND_DECIMALS = 4;
const ROUND_FACTOR = 10 ** ROUND_DECIMALS;

function round4(n: number): number {
  return Math.round(n * ROUND_FACTOR) / ROUND_FACTOR;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Capability score — does the supplier actually fit this event? */
function scoreCapability(candidate: AutoMatchCandidate, guestCount: number | null): number {
  if (candidate.packages.length === 0) return 0;
  if (guestCount === null) {
    // No guest count on the event — any package existence satisfies capability.
    return 1;
  }
  const anyCovers = candidate.packages.some((p) => {
    const min = p.min_qty;
    const max = p.max_qty ?? Number.POSITIVE_INFINITY;
    return guestCount >= min && guestCount <= max;
  });
  if (anyCovers) return 1;
  // Supplier has packages in this subcategory but none cover the qty — partial credit.
  return 0.5;
}

/** Travel score — same city > service-area only > out-of-area. */
function scoreTravel(candidate: AutoMatchCandidate, eventCity: string): number {
  if (candidate.base_city === eventCity) return 1;
  if (candidate.service_area_cities.includes(eventCity)) return 0.5;
  return 0;
}

/** Responsiveness — neutral 0.5 when sample too small / missing. */
function scoreResponsiveness(candidate: AutoMatchCandidate): number {
  return candidate.response_rate_30d ?? 0.5;
}

/** Booking quality — neutral 0.5 until we track supplier win-rate. */
function scoreBookingQuality(_candidate: AutoMatchCandidate): number {
  // TODO(sprint5): replace with verified-win-rate (bookings / quotes) proxy.
  return 0.5;
}

/** Rotation — reduce score for suppliers we keep re-inviting. */
function scoreRotation(candidate: AutoMatchCandidate): number {
  const penalty = candidate.invites_last_14d / 3;
  return Math.max(0, 1 - penalty);
}

/**
 * Pure, deterministic auto-match ranker. No Date.now, no Math.random, no
 * ambient clock — given the same context + candidates the output is identical.
 */
export function computeAutoMatch(
  ctx: AutoMatchContext,
  candidates: AutoMatchCandidate[],
): MatchResult[] {
  if (candidates.length === 0) return [];

  const scored = candidates.map((candidate) => {
    const capability = clamp01(scoreCapability(candidate, ctx.event.guest_count));
    const travel = clamp01(scoreTravel(candidate, ctx.event.city));
    const responsiveness = clamp01(scoreResponsiveness(candidate));
    const booking_quality = clamp01(scoreBookingQuality(candidate));
    const rotation = clamp01(scoreRotation(candidate));

    const totalRaw =
      W_CAPABILITY * capability +
      W_TRAVEL * travel +
      W_RESPONSIVENESS * responsiveness +
      W_BOOKING_QUALITY * booking_quality +
      W_ROTATION * rotation;

    const breakdown: MatchBreakdown = {
      capability: round4(capability),
      travel: round4(travel),
      responsiveness: round4(responsiveness),
      booking_quality: round4(booking_quality),
      rotation: round4(rotation),
      total: round4(clamp01(totalRaw)),
    };

    return { candidate, breakdown };
  });

  // Sort DESC by total, stable tiebreak ASC by supplier_id.
  scored.sort((a, b) => {
    if (b.breakdown.total !== a.breakdown.total) {
      return b.breakdown.total - a.breakdown.total;
    }
    return a.candidate.supplier_id.localeCompare(b.candidate.supplier_id);
  });

  return scored.slice(0, TOP_N).map(({ candidate, breakdown }) => {
    const partial: MatchResult = {
      supplier_id: candidate.supplier_id,
      business_name: candidate.business_name,
      slug: candidate.slug,
      breakdown,
      reasons: [],
    };
    partial.reasons = reasonsFor(partial, ctx);
    return partial;
  });
}
