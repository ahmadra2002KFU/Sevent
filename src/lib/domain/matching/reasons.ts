/**
 * Sevent auto-match — reason builder.
 *
 * Translates a `MatchResult` + the originating context into the i18n message
 * keys that render the shortlist explainer chips ("same city", "available on
 * date", "responds within 24h", etc.). Keys live under `organizer.shortlist.*`
 * in the message catalogs. Lane 2 implements the body.
 */

import type { AutoMatchContext, MatchResult } from "./autoMatch";

export function reasonsFor(
  _match: MatchResult,
  _ctx: AutoMatchContext,
): string[] {
  throw new Error("reasonsFor not implemented — Lane 2");
}
