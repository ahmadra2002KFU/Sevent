// KSA administrative cities used across the platform (supplier base city,
// service area, event venue city). Frozen const; regional capital listed first
// in each region so picker defaults look natural.

export type KsaRegionSlug =
  | "riyadh"
  | "makkah"
  | "madinah"
  | "eastern"
  | "qassim"
  | "asir"
  | "tabuk"
  | "hail"
  | "northern_borders"
  | "jazan"
  | "najran"
  | "al_bahah"
  | "al_jawf";

export type KsaCity = {
  slug: string;
  name_en: string;
  name_ar: string;
  region: KsaRegionSlug;
  is_regional_capital: boolean;
};

export const KSA_CITIES: ReadonlyArray<KsaCity> = Object.freeze([
  // Regional capitals
  { slug: "riyadh",        name_en: "Riyadh",         name_ar: "الرياض",    region: "riyadh",           is_regional_capital: true },
  { slug: "makkah",        name_en: "Makkah",         name_ar: "مكة المكرمة", region: "makkah",           is_regional_capital: true },
  { slug: "madinah",       name_en: "Madinah",        name_ar: "المدينة المنورة", region: "madinah",         is_regional_capital: true },
  { slug: "dammam",        name_en: "Dammam",         name_ar: "الدمام",    region: "eastern",          is_regional_capital: true },
  { slug: "buraidah",      name_en: "Buraidah",       name_ar: "بريدة",     region: "qassim",           is_regional_capital: true },
  { slug: "abha",          name_en: "Abha",           name_ar: "أبها",      region: "asir",             is_regional_capital: true },
  { slug: "tabuk",         name_en: "Tabuk",          name_ar: "تبوك",      region: "tabuk",            is_regional_capital: true },
  { slug: "hail",          name_en: "Hail",           name_ar: "حائل",      region: "hail",             is_regional_capital: true },
  { slug: "arar",          name_en: "Arar",           name_ar: "عرعر",      region: "northern_borders", is_regional_capital: true },
  { slug: "jizan",         name_en: "Jizan",          name_ar: "جازان",     region: "jazan",            is_regional_capital: true },
  { slug: "najran",        name_en: "Najran",         name_ar: "نجران",     region: "najran",           is_regional_capital: true },
  { slug: "al_bahah",      name_en: "Al-Bahah",       name_ar: "الباحة",    region: "al_bahah",         is_regional_capital: true },
  { slug: "sakakah",       name_en: "Sakakah",        name_ar: "سكاكا",     region: "al_jawf",          is_regional_capital: true },

  // Major secondary cities
  { slug: "jeddah",        name_en: "Jeddah",         name_ar: "جدة",        region: "makkah",  is_regional_capital: false },
  { slug: "taif",          name_en: "Taif",           name_ar: "الطائف",     region: "makkah",  is_regional_capital: false },
  { slug: "rabigh",        name_en: "Rabigh",         name_ar: "رابغ",       region: "makkah",  is_regional_capital: false },
  { slug: "al_qunfudhah",  name_en: "Al-Qunfudhah",   name_ar: "القنفذة",    region: "makkah",  is_regional_capital: false },
  { slug: "khobar",        name_en: "Khobar",         name_ar: "الخبر",      region: "eastern", is_regional_capital: false },
  { slug: "dhahran",       name_en: "Dhahran",        name_ar: "الظهران",    region: "eastern", is_regional_capital: false },
  { slug: "jubail",        name_en: "Jubail",         name_ar: "الجبيل",     region: "eastern", is_regional_capital: false },
  { slug: "al_ahsa",       name_en: "Al-Ahsa (Hofuf)", name_ar: "الأحساء",   region: "eastern", is_regional_capital: false },
  { slug: "qatif",         name_en: "Qatif",          name_ar: "القطيف",     region: "eastern", is_regional_capital: false },
  { slug: "hafar_al_batin", name_en: "Hafar al-Batin", name_ar: "حفر الباطن", region: "eastern", is_regional_capital: false },
  { slug: "khafji",        name_en: "Khafji",         name_ar: "الخفجي",     region: "eastern", is_regional_capital: false },
  { slug: "yanbu",         name_en: "Yanbu",          name_ar: "ينبع",       region: "madinah", is_regional_capital: false },
  { slug: "khamis_mushait", name_en: "Khamis Mushait", name_ar: "خميس مشيط", region: "asir",    is_regional_capital: false },
  { slug: "unaizah",       name_en: "Unaizah",        name_ar: "عنيزة",      region: "qassim",  is_regional_capital: false },
  { slug: "ar_rass",       name_en: "Ar Rass",        name_ar: "الرس",       region: "qassim",  is_regional_capital: false },
  { slug: "al_kharj",      name_en: "Al-Kharj",       name_ar: "الخرج",      region: "riyadh",  is_regional_capital: false },
  { slug: "al_majmaah",    name_en: "Al-Majma'ah",    name_ar: "المجمعة",    region: "riyadh",  is_regional_capital: false },
  { slug: "wadi_ad_dawasir", name_en: "Wadi ad-Dawasir", name_ar: "وادي الدواسر", region: "riyadh", is_regional_capital: false },
  { slug: "duba",          name_en: "Duba",           name_ar: "ضباء",       region: "tabuk",   is_regional_capital: false },
  { slug: "qurayyat",      name_en: "Qurayyat",       name_ar: "القريات",    region: "al_jawf", is_regional_capital: false },
]);

const CITY_BY_SLUG: ReadonlyMap<string, KsaCity> = new Map(
  KSA_CITIES.map((c) => [c.slug, c]),
);

export function getCityBySlug(slug: string | null | undefined): KsaCity | null {
  if (!slug) return null;
  return CITY_BY_SLUG.get(slug) ?? null;
}

export function cityNameFor(
  slug: string | null | undefined,
  locale: "en" | "ar",
): string {
  const city = getCityBySlug(slug);
  if (!city) return slug ?? "";
  return locale === "ar" ? city.name_ar : city.name_en;
}

export function cityOptions(
  locale: "en" | "ar",
): Array<{ value: string; label: string; region: KsaRegionSlug; is_regional_capital: boolean }> {
  return KSA_CITIES.map((c) => ({
    value: c.slug,
    label: locale === "ar" ? c.name_ar : c.name_en,
    region: c.region,
    is_regional_capital: c.is_regional_capital,
  }));
}

export const CITY_SLUGS = KSA_CITIES.map((c) => c.slug);
