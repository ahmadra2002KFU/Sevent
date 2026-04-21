// Market segments — the canonical 5-value classification for events and for
// suppliers' "works with" tags. Stored as the public.event_type enum.

export type MarketSegmentSlug =
  | "private_occasions"
  | "business_events"
  | "entertainment_culture"
  | "sports_exhibitions"
  | "others";

export type MarketSegment = {
  slug: MarketSegmentSlug;
  name_en: string;
  name_ar: string;
  // Emoji shown in the picker tile. Keeps the picker legible for low-literacy
  // users without requiring a designer to draft 5 SVGs right now.
  icon: string;
};

export const MARKET_SEGMENTS: ReadonlyArray<MarketSegment> = Object.freeze([
  { slug: "private_occasions",     name_en: "Private Occasions",       name_ar: "مناسبات خاصة",  icon: "🎉" },
  { slug: "business_events",       name_en: "Business Events",         name_ar: "فعاليات الأعمال", icon: "💼" },
  { slug: "entertainment_culture", name_en: "Entertainment and Culture", name_ar: "ترفيه وثقافة",  icon: "🎭" },
  { slug: "sports_exhibitions",    name_en: "Sports and Exhibitions",  name_ar: "رياضة ومعارض",   icon: "🏟️" },
  { slug: "others",                name_en: "Others",                  name_ar: "أخرى",           icon: "✨" },
]);

export const MARKET_SEGMENT_SLUGS: ReadonlyArray<MarketSegmentSlug> =
  MARKET_SEGMENTS.map((s) => s.slug);

const SEGMENT_BY_SLUG = new Map(MARKET_SEGMENTS.map((s) => [s.slug, s]));

export function getSegmentBySlug(
  slug: string | null | undefined,
): MarketSegment | null {
  if (!slug) return null;
  return SEGMENT_BY_SLUG.get(slug as MarketSegmentSlug) ?? null;
}

export function segmentNameFor(
  slug: string | null | undefined,
  locale: "en" | "ar",
): string {
  const s = getSegmentBySlug(slug);
  if (!s) return slug ?? "";
  return locale === "ar" ? s.name_ar : s.name_en;
}

export function segmentOptions(
  locale: "en" | "ar",
): Array<{ value: MarketSegmentSlug; label: string; icon: string }> {
  return MARKET_SEGMENTS.map((s) => ({
    value: s.slug,
    label: locale === "ar" ? s.name_ar : s.name_en,
    icon: s.icon,
  }));
}
