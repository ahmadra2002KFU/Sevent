/**
 * Sevent auto-match — reason builder.
 *
 * Translates a `MatchResult` + the originating context into the short
 * human-readable chip strings displayed next to each suggested supplier.
 *
 * NOTE: Plain English strings only. Real i18n lookup (organizer.shortlist.*
 * message keys) is wired at the UI layer once the organizer shortlist panel
 * lands in Lane 3. TODO(sprint6): swap the dict below for message keys and
 * let the caller resolve via `getTranslations()`.
 */

import type { AutoMatchContext, MatchResult } from "./autoMatch";

const REASON_TEXT = {
  same_city: (city: string) => `Based in ${city}`,
  service_area: (city: string) => `Serves ${city} (service area)`,
  capability_full: "Packages match guest count",
  capability_partial: "Offers packages in this category",
  responds_fast: "Responds within 24h",
  responds_unknown: "New to Sevent",
  rotating_in: "Rotating in new opportunity",
  verified: "Verified supplier",
} as const;

/**
 * Pick a compact list of reason chips (3–5 entries) for a given match.
 * Pure function of `match.breakdown` + `ctx` — no DB lookups.
 */
export function reasonsFor(
  match: MatchResult,
  ctx: AutoMatchContext,
): string[] {
  const reasons: string[] = [];
  const b = match.breakdown;

  // Every candidate has passed the approval/publish hard filter in query.ts,
  // so "Verified supplier" is universally true.
  reasons.push(REASON_TEXT.verified);

  // Travel — either same city or service-area only (out-of-area = 0 but such
  // candidates never survive the hard filter so we only branch on 1 vs 0.5).
  if (b.travel >= 1) {
    reasons.push(REASON_TEXT.same_city(ctx.event.city));
  } else if (b.travel > 0) {
    reasons.push(REASON_TEXT.service_area(ctx.event.city));
  }

  // Capability — 1.0 = qty fits, 0.5 = packages exist but qty mismatch.
  if (b.capability >= 1) {
    reasons.push(REASON_TEXT.capability_full);
  } else if (b.capability > 0) {
    reasons.push(REASON_TEXT.capability_partial);
  }

  // Responsiveness — only surface strong positives/unknowns, stay silent on
  // the neutral 0.5 default so we don't mis-advertise behaviour.
  if (b.responsiveness >= 0.8) {
    reasons.push(REASON_TEXT.responds_fast);
  } else if (b.responsiveness === 0.5) {
    reasons.push(REASON_TEXT.responds_unknown);
  }

  // Rotation — highlight under-invited suppliers so organizers understand
  // why a lower-scored candidate ranks up.
  if (b.rotation >= 1) {
    reasons.push(REASON_TEXT.rotating_in);
  }

  return reasons;
}
