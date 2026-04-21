// Canonical 2-level service taxonomy (12 parents with sub-items).
// Single source of truth for: migration seed SQL, Zod enums, form options,
// public browse, supplier onboarding, organizer RFQ wizard.
//
// If you add/remove a slug here, you MUST also update the matching
// `insert into public.categories` block in the latest migration and re-run
// `pnpm db:reset && pnpm seed`.

export type TaxonomyItem = {
  slug: string;
  name_en: string;
  name_ar: string;
};

export type TaxonomyParent = TaxonomyItem & {
  sort_order: number;
  children: ReadonlyArray<TaxonomyItem>;
};

export const TAXONOMY: ReadonlyArray<TaxonomyParent> = Object.freeze([
  {
    slug: "sound_lighting",
    name_en: "Sound and Lighting",
    name_ar: "صوت وإضاءة",
    sort_order: 10,
    children: [
      { slug: "sl_speakers",    name_en: "Speakers",    name_ar: "مكبرات" },
      { slug: "sl_laser",       name_en: "Laser",       name_ar: "ليزر" },
      { slug: "sl_dj",          name_en: "DJ",          name_ar: "دي جي" },
      { slug: "sl_led_screens", name_en: "LED screens", name_ar: "شاشات LED" },
    ],
  },
  {
    slug: "photo_video",
    name_en: "Photography and Video",
    name_ar: "تصوير وفيديو",
    sort_order: 20,
    children: [
      { slug: "pv_photographers",   name_en: "Photographers",   name_ar: "مصورون" },
      { slug: "pv_film",            name_en: "Film",            name_ar: "فيلم" },
      { slug: "pv_live_streaming",  name_en: "Live streaming",  name_ar: "بث مباشر" },
    ],
  },
  {
    slug: "catering_hospitality",
    name_en: "Catering and Hospitality",
    name_ar: "كاترينج وضيافة",
    sort_order: 30,
    children: [
      { slug: "cat_buffet",        name_en: "Buffet",       name_ar: "بوفيه" },
      { slug: "cat_kitchens",      name_en: "Kitchens",     name_ar: "مطابخ" },
      { slug: "cat_vip_services",  name_en: "VIP services", name_ar: "خدمات VIP" },
    ],
  },
  {
    slug: "tents_structures",
    name_en: "Tents and Structures",
    name_ar: "خيام وستراكتشر",
    sort_order: 40,
    children: [
      { slug: "ts_tents",             name_en: "Tents",               name_ar: "خيام" },
      { slug: "ts_domes",             name_en: "Domes",               name_ar: "قباب" },
      { slug: "ts_temporary_hangars", name_en: "Temporary hangars",   name_ar: "هناجر مؤقتة" },
    ],
  },
  {
    slug: "furniture_equipment",
    name_en: "Furniture and Equipment",
    name_ar: "أثاث ومعدات",
    sort_order: 50,
    children: [
      { slug: "fe_chairs", name_en: "Chairs", name_ar: "كراسي" },
      { slug: "fe_tables", name_en: "Tables", name_ar: "طاولات" },
      { slug: "fe_decor",  name_en: "Decor",  name_ar: "ديكور" },
    ],
  },
  {
    slug: "entertainment_arts",
    name_en: "Entertainment and Arts",
    name_ar: "ترفيه وفنون",
    sort_order: 60,
    children: [
      { slug: "ea_folkloric_groups",       name_en: "Folkloric groups",       name_ar: "فرق فلكلورية" },
      { slug: "ea_theatrical_performances", name_en: "Theatrical performances", name_ar: "عروض مسرحية" },
    ],
  },
  {
    slug: "transport_logistics",
    name_en: "Transportation and Logistics",
    name_ar: "نقل ولوجستيات",
    sort_order: 70,
    children: [
      { slug: "tl_vip_cars",       name_en: "VIP cars",       name_ar: "سيارات VIP" },
      { slug: "tl_loading_trucks", name_en: "Loading trucks", name_ar: "شاحنات تحميل" },
    ],
  },
  {
    slug: "stands_exhibitions",
    name_en: "Stands and Exhibitions",
    name_ar: "استاندات ومعارض",
    sort_order: 80,
    children: [
      { slug: "se_stand_design_install", name_en: "Stand design and installation", name_ar: "تصميم وتركيب استاندات" },
    ],
  },
  {
    slug: "coordination_management",
    name_en: "Coordination and Management",
    name_ar: "تنسيق وإدارة",
    sort_order: 90,
    children: [
      { slug: "cm_certified_event_managers", name_en: "Certified event managers", name_ar: "مديرو فعاليات معتمدون" },
    ],
  },
  {
    slug: "flowers_decor",
    name_en: "Flowers and Decor",
    name_ar: "زهور وديكور",
    sort_order: 100,
    children: [
      { slug: "fd_flower_arrangement", name_en: "Flower arrangement", name_ar: "تنسيق ورود" },
      { slug: "fd_bouquets",           name_en: "Bouquets",           name_ar: "باقات" },
      { slug: "fd_decoration",         name_en: "Decoration",         name_ar: "تزيين" },
    ],
  },
  {
    slug: "makeup_beauty",
    name_en: "Makeup and Beauty",
    name_ar: "مكياج وتجميل",
    sort_order: 110,
    children: [
      { slug: "mb_hairstylists",   name_en: "Hairstylists",   name_ar: "مصففو شعر" },
      { slug: "mb_bridal_makeup",  name_en: "Bridal makeup",  name_ar: "مكياج عرائس" },
    ],
  },
  {
    slug: "electricity_power",
    name_en: "Electricity and Power",
    name_ar: "كهرباء وطاقة",
    sort_order: 120,
    children: [
      { slug: "ep_generators",       name_en: "Generators",         name_ar: "مولدات" },
      { slug: "ep_electrical_panels", name_en: "Electrical panels", name_ar: "لوحات كهربائية" },
    ],
  },
]);

export const TAXONOMY_PARENT_SLUGS: ReadonlyArray<string> = TAXONOMY.map(
  (p) => p.slug,
);

export const TAXONOMY_CHILD_SLUGS: ReadonlyArray<string> = TAXONOMY.flatMap(
  (p) => p.children.map((c) => c.slug),
);

export function findTaxonomyItem(
  slug: string,
): { kind: "parent"; parent: TaxonomyParent } | { kind: "child"; parent: TaxonomyParent; child: TaxonomyItem } | null {
  for (const parent of TAXONOMY) {
    if (parent.slug === slug) return { kind: "parent", parent };
    const child = parent.children.find((c) => c.slug === slug);
    if (child) return { kind: "child", parent, child };
  }
  return null;
}

export function taxonomyNameFor(slug: string, locale: "en" | "ar"): string {
  const hit = findTaxonomyItem(slug);
  if (!hit) return slug;
  if (hit.kind === "parent") {
    return locale === "ar" ? hit.parent.name_ar : hit.parent.name_en;
  }
  return locale === "ar" ? hit.child.name_ar : hit.child.name_en;
}

// Curated accent palette for supplier profile color picker. Each color has
// been eyeballed for ≥4.5:1 contrast against white text and a neutral-700
// body. Keep the list in sync with the DB `check` constraint at the app
// layer (DB only enforces hex shape, not membership).
export const ACCENT_PALETTE: ReadonlyArray<{ slug: string; hex: string; name_en: string; name_ar: string }> = Object.freeze([
  { slug: "cobalt",   hex: "#1E7BD8", name_en: "Cobalt",   name_ar: "أزرق كوبالت" },
  { slug: "navy",     hex: "#0F2E5C", name_en: "Navy",     name_ar: "كحلي" },
  { slug: "teal",     hex: "#0E7C86", name_en: "Teal",     name_ar: "أخضر مزرق" },
  { slug: "indigo",   hex: "#4F46E5", name_en: "Indigo",   name_ar: "نيلي" },
  { slug: "emerald",  hex: "#047857", name_en: "Emerald",  name_ar: "زمردي" },
  { slug: "forest",   hex: "#14532D", name_en: "Forest",   name_ar: "أخضر غابي" },
  { slug: "amber",    hex: "#B45309", name_en: "Amber",    name_ar: "كهرماني" },
  { slug: "gold",     hex: "#C8993A", name_en: "Gold",     name_ar: "ذهبي" },
  { slug: "rose",     hex: "#BE185D", name_en: "Rose",     name_ar: "وردي" },
  { slug: "crimson",  hex: "#B91C1C", name_en: "Crimson",  name_ar: "قرمزي" },
  { slug: "plum",     hex: "#7C3AED", name_en: "Plum",     name_ar: "برقوقي" },
  { slug: "charcoal", hex: "#27272A", name_en: "Charcoal", name_ar: "فحمي" },
]);

export const ACCENT_HEX_VALUES = ACCENT_PALETTE.map((a) => a.hex);
export const DEFAULT_ACCENT_HEX = "#1E7BD8";
