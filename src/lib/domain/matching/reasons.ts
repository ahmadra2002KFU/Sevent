/**
 * Sevent auto-match — reason builder.
 *
 * Builds the structured reason chips displayed next to each suggested
 * supplier. Each entry is a stable `code` (plus optional interpolation
 * `params`) — NOT a pre-rendered string. The UI layer
 * (`ShortlistEditor`) resolves `code` → localized text via the
 * `organizer.shortlist.reasons.*` message namespace, so the chips render
 * correctly in both Arabic and English.
 */

import type { AutoMatchContext, MatchResult } from "./autoMatch";

/**
 * A localization-ready match reason. `code` maps to a key under
 * `organizer.shortlist.reasons.*`; `params` carries any interpolation values
 * that key expects (city name, guest count, response-window hours).
 */
export type MatchReason = {
  code:
    | "verified"
    | "sameCity"
    | "serviceArea"
    | "packagesInRange"
    | "offersInCategory"
    | "respondsWithin"
    | "newToSevent"
    | "rotating";
  params?: Record<string, string | number>;
};

/**
 * Pick a compact list of reason chips (3–5 entries) for a given match.
 * Pure function of `match.breakdown` + `ctx` — no DB lookups, no i18n.
 */
export function reasonsFor(
  match: MatchResult,
  ctx: AutoMatchContext,
): MatchReason[] {
  const reasons: MatchReason[] = [];
  const b = match.breakdown;

  // Every candidate has passed the approval/publish hard filter in query.ts,
  // so "Verified supplier" is universally true.
  reasons.push({ code: "verified" });

  // Travel — either same city or service-area only (out-of-area = 0 but such
  // candidates never survive the hard filter so we only branch on 1 vs 0.5).
  if (b.travel >= 1) {
    reasons.push({ code: "sameCity", params: { city: ctx.event.city } });
  } else if (b.travel > 0) {
    reasons.push({ code: "serviceArea", params: { city: ctx.event.city } });
  }

  // Capability — 1.0 = qty fits, 0.5 = packages exist but qty mismatch.
  if (b.capability >= 1) {
    reasons.push({
      code: "packagesInRange",
      params: { guests: ctx.event.guest_count ?? 0 },
    });
  } else if (b.capability > 0) {
    reasons.push({ code: "offersInCategory" });
  }

  // Responsiveness — only surface strong positives/unknowns, stay silent on
  // the neutral 0.5 default so we don't mis-advertise behaviour.
  if (b.responsiveness >= 0.8) {
    reasons.push({ code: "respondsWithin", params: { hours: 24 } });
  } else if (b.responsiveness === 0.5) {
    reasons.push({ code: "newToSevent" });
  }

  // Rotation — highlight under-invited suppliers so organizers understand
  // why a lower-scored candidate ranks up.
  if (b.rotation >= 1) {
    reasons.push({ code: "rotating" });
  }

  return reasons;
}
