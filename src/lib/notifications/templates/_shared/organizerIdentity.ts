/**
 * Bilingual "company — via actor" display formatter for email templates.
 *
 * When the action was taken on behalf of a company (multi-user organizer),
 * the supplier-facing surface (and any organizer-facing surface where both
 * are known) should render the company as the primary identity with the
 * actor as a "via" subline. Falls back to the actor's name alone when no
 * company is provided — the historical behavior for individual organizers.
 *
 * The em-dash separator is the same in both locales; only the preposition
 * ("via" → "بواسطة") flips. Whitespace around the dash uses normal spaces;
 * the email renderer's directional handling takes care of bidi flipping
 * inside Arabic copy.
 */

import type { Locale } from "./i18n";

export function formatOrganizerIdentity(
  actorName: string | null | undefined,
  companyName: string | null | undefined,
  locale: Locale,
): string {
  const actor = actorName?.trim() || (locale === "ar" ? "المنظم" : "the organizer");
  const company = companyName?.trim();
  if (!company) return actor;
  const via = locale === "ar" ? "بواسطة" : "via";
  return `${company} — ${via} ${actor}`;
}
