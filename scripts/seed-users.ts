/**
 * Sevent demo seed — idempotent-by-email service-role user fixture.
 *
 * Creates: 1 admin, 2 organizers, and 25 suppliers (12 Riyadh + 13 Jeddah)
 * spread across the 2026-04-21 taxonomy. Every supplier gets:
 *   - profile + suppliers row (with accent_color from ACCENT_PALETTE
 *     and 1-2 works_with_segments),
 *   - 2 packages (halalas via money.ts),
 *   - 1 pricing rule (rotated across all 5 pricing_rule_type values),
 *   - 2 portfolio photos uploaded to supplier-portfolio,
 *   - 1 verification doc uploaded to supplier-docs,
 *   - supplier_categories link.
 *
 * First 8 suppliers: approved + is_published=true. Remainder stays pending.
 *
 * ---------------------------------------------------------------------------
 * 2026-04-21 slug migration — legacy fixture slug → new-taxonomy slug.
 * ---------------------------------------------------------------------------
 * The old Sprint-2 taxonomy (venue-*, photo-*, decor-*, av-*, dj, performer)
 * was wiped in migration 20260421000000_taxonomy_profile_polish.sql. We
 * re-map each of the 25 supplier fixtures to the closest sub-item in the new
 * 12-parent taxonomy (src/lib/domain/taxonomy.ts). The mapping preserves the
 * "feel" of each supplier so demo flows still read naturally:
 *
 *   venue-ballroom       → cm_certified_event_managers (re-purpose as a full
 *                          coordination/venue manager; new taxonomy has no
 *                          direct venue slug).
 *   venue-outdoor        → ts_tents / ts_domes (outdoor = tented structure).
 *   venue-conference     → cm_certified_event_managers (conference
 *                          coordinator).
 *   catering-buffet      → cat_buffet
 *   catering-plated      → cat_vip_services
 *   catering-coffee      → cat_buffet  (no coffee-specific slug in new tax)
 *   photo-wedding        → pv_photographers
 *   photo-corporate      → pv_photographers
 *   video-cinematic      → pv_film
 *   photo-drone          → pv_photographers
 *   decor-kosha          → fd_decoration
 *   decor-florals        → fd_flower_arrangement
 *   decor-lighting       → sl_led_screens
 *   dj                   → sl_dj
 *   performer            → ea_folkloric_groups / ea_theatrical_performances
 *   av-sound             → sl_speakers
 *   av-staging           → ts_temporary_hangars
 *
 * Cities: "Riyadh"/"Jeddah" replaced with slugs "riyadh"/"jeddah".
 * ---------------------------------------------------------------------------
 *
 * Run: `pnpm seed` (requires SUPABASE_SERVICE_ROLE_KEY in .env.local).
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { sarToHalalas } from "../src/lib/domain/money";
import {
  parsePricingRuleConfig,
  type PricingRuleType,
} from "../src/lib/domain/pricing/rules";
import { slugifyBusinessName } from "../src/lib/domain/onboarding";
import { STORAGE_BUCKETS, supplierScopedPath } from "../src/lib/supabase/storage";
import { fetchPlaceholderPng, tinyPngBuffer } from "./lib/pngBuffer";
import {
  ACCENT_PALETTE,
  TAXONOMY_CHILD_SLUGS,
} from "../src/lib/domain/taxonomy";
import { CITY_SLUGS } from "../src/lib/domain/cities";
import type { MarketSegmentSlug } from "../src/lib/domain/segments";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "[seed] Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type CreatedUser = { id: string; email: string };

async function upsertAuthUser(params: {
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "organizer" | "supplier";
  language?: "en" | "ar";
}): Promise<CreatedUser> {
  const { data: list, error: listErr } = await supa.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);
  const existing = list.users.find(
    (u) => (u.email ?? "").toLowerCase() === params.email.toLowerCase(),
  );
  if (existing) return { id: existing.id, email: params.email };

  const { data, error } = await supa.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: {
      role: params.role,
      full_name: params.fullName,
      language: params.language ?? "en",
    },
  });
  if (error || !data.user) {
    throw new Error(`createUser(${params.email}) failed: ${error?.message ?? "no user"}`);
  }
  return { id: data.user.id, email: params.email };
}

async function ensureProfileRole(
  userId: string,
  role: "admin" | "organizer" | "supplier",
) {
  const { error } = await supa.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(`profile update(${userId}, ${role}): ${error.message}`);
}

async function uniqueSlug(base: string): Promise<string> {
  const slug = slugifyBusinessName(base) || "supplier";
  let candidate = slug;
  let attempt = 1;
  while (true) {
    const { data, error } = await supa
      .from("suppliers")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw new Error(`slug lookup: ${error.message}`);
    if (!data) return candidate;
    attempt += 1;
    candidate = `${slug}-${attempt}`;
    if (attempt > 50) throw new Error(`cannot resolve slug for ${base}`);
  }
}

async function uploadBytes(
  bucket: string,
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await supa.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`upload(${bucket}/${path}): ${error.message}`);
}

// New-taxonomy child slugs used by the seed. Narrowed to a union so a typo
// here is a compile-time error rather than a runtime "category missing".
type CategorySlug =
  | "cat_buffet"
  | "cat_vip_services"
  | "pv_photographers"
  | "pv_film"
  | "fd_flower_arrangement"
  | "fd_decoration"
  | "sl_dj"
  | "sl_speakers"
  | "sl_led_screens"
  | "ts_tents"
  | "ts_domes"
  | "ts_temporary_hangars"
  | "ea_folkloric_groups"
  | "ea_theatrical_performances"
  | "cm_certified_event_managers";

type CitySlug = "riyadh" | "jeddah";

type SupplierSpec = {
  business_name: string;
  legal_type: "company" | "freelancer" | "foreign";
  base_city: CitySlug;
  subcategory_slug: CategorySlug;
  languages: Array<"en" | "ar">;
  capacity: number;
  concurrent_event_limit: number;
  cr_number?: string;
  national_id?: string;
  bio: string;
  package_prices_sar: [number, number];
  package_units: [
    "event" | "hour" | "day" | "person" | "unit",
    "event" | "hour" | "day" | "person" | "unit",
  ];
  min_qty: [number, number];
  works_with_segments: MarketSegmentSlug[];
};

// Segment heuristic — keep in sync with the doc block at the top of the file.
const SEG_CATERING: MarketSegmentSlug[] = ["private_occasions", "business_events"];
const SEG_PHOTO_VIDEO: MarketSegmentSlug[] = ["private_occasions", "business_events"];
const SEG_DECOR_FLOWERS: MarketSegmentSlug[] = ["private_occasions", "business_events"];
const SEG_SOUND_LIGHT_DJ: MarketSegmentSlug[] = ["private_occasions", "entertainment_culture"];
const SEG_TENTS: MarketSegmentSlug[] = ["private_occasions", "entertainment_culture"];
const SEG_ENTERTAINMENT: MarketSegmentSlug[] = ["private_occasions", "entertainment_culture"];
const SEG_COORDINATION: MarketSegmentSlug[] = [
  "private_occasions",
  "business_events",
  "entertainment_culture",
  "sports_exhibitions",
  "others",
];

const SUPPLIERS: SupplierSpec[] = [
  // Riyadh (12)
  // was venue-ballroom → cm_certified_event_managers (full-service coordinator)
  { business_name: "Riyadh Royal Ballroom", legal_type: "company", base_city: "riyadh", subcategory_slug: "cm_certified_event_managers", languages: ["ar","en"], capacity: 600, concurrent_event_limit: 1, cr_number: "1010111111", bio: "North Riyadh full-service event coordinator with in-house catering partnerships.", package_prices_sar: [35000, 55000], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_COORDINATION },
  // was venue-outdoor → ts_tents
  { business_name: "Najd Outdoor Gardens", legal_type: "company", base_city: "riyadh", subcategory_slug: "ts_tents", languages: ["ar","en"], capacity: 400, concurrent_event_limit: 1, cr_number: "1010222222", bio: "Outdoor tented structures for corporate and private events.", package_prices_sar: [28000, 42000], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_TENTS },
  // was venue-conference → cm_certified_event_managers
  { business_name: "KAFD Conference Suites", legal_type: "company", base_city: "riyadh", subcategory_slug: "cm_certified_event_managers", languages: ["ar","en"], capacity: 250, concurrent_event_limit: 1, cr_number: "1010333333", bio: "Premium conference coordination in KAFD with full AV partners.", package_prices_sar: [18000, 26000], package_units: ["day","day"], min_qty: [1,1], works_with_segments: SEG_COORDINATION },
  // was catering-buffet → cat_buffet
  { business_name: "Sufra Catering Riyadh", legal_type: "company", base_city: "riyadh", subcategory_slug: "cat_buffet", languages: ["ar","en"], capacity: 1000, concurrent_event_limit: 1, cr_number: "1010444444", bio: "Arabic and international buffet catering.", package_prices_sar: [250, 380], package_units: ["person","person"], min_qty: [50,100], works_with_segments: SEG_CATERING },
  // was catering-plated → cat_vip_services
  { business_name: "Plated Nights Riyadh", legal_type: "company", base_city: "riyadh", subcategory_slug: "cat_vip_services", languages: ["en","ar"], capacity: 300, concurrent_event_limit: 1, cr_number: "1010555555", bio: "Fine-dining plated VIP service for weddings and gala dinners.", package_prices_sar: [420, 620], package_units: ["person","person"], min_qty: [30,60], works_with_segments: SEG_CATERING },
  // was catering-coffee → cat_buffet (no coffee-specific slug)
  { business_name: "Qahwat Al Najd", legal_type: "freelancer", base_city: "riyadh", subcategory_slug: "cat_buffet", languages: ["ar"], capacity: 500, concurrent_event_limit: 1, national_id: "1098765431", bio: "Traditional Saudi coffee + dessert buffet service.", package_prices_sar: [3200, 5500], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_CATERING },
  // was photo-wedding → pv_photographers
  { business_name: "Lens Riyadh Studios", legal_type: "company", base_city: "riyadh", subcategory_slug: "pv_photographers", languages: ["ar","en"], capacity: 1, concurrent_event_limit: 1, cr_number: "1010666666", bio: "Boutique wedding photography.", package_prices_sar: [8500, 14000], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_PHOTO_VIDEO },
  // was photo-corporate → pv_photographers
  { business_name: "Capital Corporate Photo", legal_type: "company", base_city: "riyadh", subcategory_slug: "pv_photographers", languages: ["en","ar"], capacity: 1, concurrent_event_limit: 1, cr_number: "1010777777", bio: "Corporate event photography.", package_prices_sar: [6500, 11500], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_PHOTO_VIDEO },
  // was decor-kosha → fd_decoration
  { business_name: "Kosha Kreators Riyadh", legal_type: "company", base_city: "riyadh", subcategory_slug: "fd_decoration", languages: ["ar","en"], capacity: 1, concurrent_event_limit: 1, cr_number: "1010888888", bio: "Kosha design and stage-build decoration for weddings.", package_prices_sar: [22000, 34000], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_DECOR_FLOWERS },
  // was decor-florals → fd_flower_arrangement
  { business_name: "Florals of Najd", legal_type: "freelancer", base_city: "riyadh", subcategory_slug: "fd_flower_arrangement", languages: ["ar","en"], capacity: 1, concurrent_event_limit: 1, national_id: "1234567890", bio: "Floral designers specializing in modern Arabian arrangements.", package_prices_sar: [4500, 9500], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_DECOR_FLOWERS },
  // was dj → sl_dj
  { business_name: "Beat Lab DJ Riyadh", legal_type: "freelancer", base_city: "riyadh", subcategory_slug: "sl_dj", languages: ["en","ar"], capacity: 1, concurrent_event_limit: 1, national_id: "1122334455", bio: "Premium DJ service with lighting rig included.", package_prices_sar: [4200, 7800], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_SOUND_LIGHT_DJ },
  // was av-sound → sl_speakers
  { business_name: "StageWorks Riyadh", legal_type: "company", base_city: "riyadh", subcategory_slug: "sl_speakers", languages: ["en","ar"], capacity: 2000, concurrent_event_limit: 1, cr_number: "1010999999", bio: "Sound reinforcement, mics, and mixing.", package_prices_sar: [9500, 18000], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_SOUND_LIGHT_DJ },

  // Jeddah (13)
  // was venue-outdoor → ts_domes
  { business_name: "Jeddah Corniche Pavilion", legal_type: "company", base_city: "jeddah", subcategory_slug: "ts_domes", languages: ["ar","en"], capacity: 500, concurrent_event_limit: 1, cr_number: "4030111111", bio: "Seaside geodesic dome pavilions on the Jeddah Corniche.", package_prices_sar: [32000, 48000], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_TENTS },
  // was venue-ballroom → cm_certified_event_managers
  { business_name: "Al Hamra Ballroom", legal_type: "company", base_city: "jeddah", subcategory_slug: "cm_certified_event_managers", languages: ["ar","en"], capacity: 800, concurrent_event_limit: 1, cr_number: "4030222222", bio: "Al Hamra full-service event coordination with parking for 300.", package_prices_sar: [38000, 62000], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_COORDINATION },
  // was venue-conference → cm_certified_event_managers
  { business_name: "Red Sea Conference Centre", legal_type: "company", base_city: "jeddah", subcategory_slug: "cm_certified_event_managers", languages: ["ar","en"], capacity: 300, concurrent_event_limit: 1, cr_number: "4030333333", bio: "Waterfront conference management with breakout coordination.", package_prices_sar: [16000, 24000], package_units: ["day","day"], min_qty: [1,1], works_with_segments: SEG_COORDINATION },
  // was catering-buffet → cat_buffet
  { business_name: "Hijazi Feast Catering", legal_type: "company", base_city: "jeddah", subcategory_slug: "cat_buffet", languages: ["ar","en"], capacity: 1200, concurrent_event_limit: 1, cr_number: "4030444444", bio: "Authentic Hijazi buffet with live stations.", package_prices_sar: [240, 360], package_units: ["person","person"], min_qty: [60,120], works_with_segments: SEG_CATERING },
  // was catering-plated → cat_vip_services
  { business_name: "Tihama Plated Dining", legal_type: "company", base_city: "jeddah", subcategory_slug: "cat_vip_services", languages: ["en","ar"], capacity: 240, concurrent_event_limit: 1, cr_number: "4030555555", bio: "Modern Saudi plated VIP dining experiences.", package_prices_sar: [410, 580], package_units: ["person","person"], min_qty: [20,50], works_with_segments: SEG_CATERING },
  // was catering-coffee → cat_buffet
  { business_name: "Dessert Trolley Jeddah", legal_type: "freelancer", base_city: "jeddah", subcategory_slug: "cat_buffet", languages: ["ar"], capacity: 400, concurrent_event_limit: 1, national_id: "1098765432", bio: "Coffee, dates, and dessert buffet service.", package_prices_sar: [2800, 4800], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_CATERING },
  // was photo-wedding → pv_photographers
  { business_name: "Red Sea Lens", legal_type: "company", base_city: "jeddah", subcategory_slug: "pv_photographers", languages: ["ar","en"], capacity: 1, concurrent_event_limit: 1, cr_number: "4030666666", bio: "Award-winning wedding photography.", package_prices_sar: [9500, 16000], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_PHOTO_VIDEO },
  // was video-cinematic → pv_film
  { business_name: "Coast Corporate Video", legal_type: "company", base_city: "jeddah", subcategory_slug: "pv_film", languages: ["en","ar"], capacity: 1, concurrent_event_limit: 1, cr_number: "4030777777", bio: "Cinematic event films and highlight reels.", package_prices_sar: [12000, 22000], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_PHOTO_VIDEO },
  // was photo-drone → pv_photographers
  { business_name: "SkyLens Drone", legal_type: "freelancer", base_city: "jeddah", subcategory_slug: "pv_photographers", languages: ["en","ar"], capacity: 1, concurrent_event_limit: 1, national_id: "1234567899", bio: "Licensed drone pilot for aerial event photography.", package_prices_sar: [3800, 6500], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_PHOTO_VIDEO },
  // was decor-florals → fd_flower_arrangement
  { business_name: "Petal Studio Jeddah", legal_type: "company", base_city: "jeddah", subcategory_slug: "fd_flower_arrangement", languages: ["ar","en"], capacity: 1, concurrent_event_limit: 1, cr_number: "4030888888", bio: "Floral design studio with same-day delivery.", package_prices_sar: [5200, 10500], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_DECOR_FLOWERS },
  // was decor-lighting → sl_led_screens
  { business_name: "Glow Event Lighting", legal_type: "company", base_city: "jeddah", subcategory_slug: "sl_led_screens", languages: ["en","ar"], capacity: 1, concurrent_event_limit: 1, cr_number: "4030999999", bio: "Architectural, stage lighting, and LED wall rental.", package_prices_sar: [8500, 15000], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_SOUND_LIGHT_DJ },
  // was performer → ea_folkloric_groups
  { business_name: "Hijaz Live Performers", legal_type: "company", base_city: "jeddah", subcategory_slug: "ea_folkloric_groups", languages: ["ar","en"], capacity: 1, concurrent_event_limit: 1, cr_number: "4031111111", bio: "Live oud, percussion, and folkloric vocal performers.", package_prices_sar: [7200, 13500], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_ENTERTAINMENT },
  // was av-staging → ts_temporary_hangars
  { business_name: "Coastline Staging", legal_type: "company", base_city: "jeddah", subcategory_slug: "ts_temporary_hangars", languages: ["en","ar"], capacity: 1500, concurrent_event_limit: 1, cr_number: "4032222222", bio: "Modular staging hangars, trussing, and LED walls.", package_prices_sar: [14000, 26000], package_units: ["event","event"], min_qty: [1,1], works_with_segments: SEG_TENTS },
];

const PRICING_RULE_ORDER: PricingRuleType[] = [
  "qty_tier_all_units",
  "qty_tier_incremental",
  "distance_fee",
  "date_surcharge",
  "duration_multiplier",
];

function pricingConfigFor(ruleType: PricingRuleType): unknown {
  switch (ruleType) {
    case "qty_tier_all_units":
      return {
        breakpoints: [
          { gte: 50, discount_pct: 5 },
          { gte: 100, discount_pct: 10 },
          { gte: 200, discount_pct: 15 },
        ],
      };
    case "qty_tier_incremental":
      return {
        breakpoints: [
          { from: 1, to: 50, price_halalas: sarToHalalas(400) },
          { from: 51, to: 150, price_halalas: sarToHalalas(350) },
          { from: 151, to: null, price_halalas: sarToHalalas(300) },
        ],
      };
    case "distance_fee":
      return {
        sar_per_km: 5,
        free_radius_km: 25,
        min_fee_halalas: sarToHalalas(150),
        max_fee_halalas: sarToHalalas(1500),
      };
    case "date_surcharge":
      return {
        scope: "weekday",
        days: ["thu", "fri", "sat"],
        multiplier: 1.15,
      };
    case "duration_multiplier":
      return {
        tiers: [
          { applies_from_days: 1, multiplier: 1.0, label: "Single day" },
          { applies_from_days: 2, multiplier: 1.8, label: "Two days" },
          { applies_from_days: 3, multiplier: 2.5, label: "Three+ days" },
        ],
      };
  }
}

async function findCategoryBySlug(slug: string): Promise<string> {
  // Fail loudly if a fixture references a slug that no longer exists in the
  // TS source of truth — catches drift before we hit the DB.
  if (!TAXONOMY_CHILD_SLUGS.includes(slug)) {
    throw new Error(
      `[seed] subcategory_slug "${slug}" is not a child in src/lib/domain/taxonomy.ts — fix the seed fixture.`,
    );
  }
  const { data, error } = await supa
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`category ${slug}: ${error.message}`);
  if (!data) {
    throw new Error(
      `[seed] category "${slug}" missing from DB — run \`pnpm db:reset\` so migration 20260421000000_taxonomy_profile_polish.sql seeds the 12-parent taxonomy.`,
    );
  }
  return data.id as string;
}

async function seedSupplier(idx: number, spec: SupplierSpec, approve: boolean): Promise<void> {
  const email = `supplier-${idx}@sevent.dev`;
  console.log(`  [${idx}] ${spec.business_name} (${email}) - ${approve ? "approved" : "pending"}`);

  // Fail-loud city guard. Catches fixture drift vs cities.ts.
  if (!CITY_SLUGS.includes(spec.base_city)) {
    throw new Error(
      `[seed] base_city "${spec.base_city}" for ${spec.business_name} is not in src/lib/domain/cities.ts.`,
    );
  }

  const accentHex = ACCENT_PALETTE[(idx - 1) % ACCENT_PALETTE.length]!.hex;

  const user = await upsertAuthUser({
    email,
    password: "DemoPass123!",
    fullName: spec.business_name,
    role: "supplier",
  });
  await ensureProfileRole(user.id, "supplier");

  const { data: existing } = await supa
    .from("suppliers")
    .select("id, slug")
    .eq("profile_id", user.id)
    .maybeSingle();

  let supplierId: string;
  if (existing) {
    supplierId = existing.id as string;
    const { error: updErr } = await supa
      .from("suppliers")
      .update({
        business_name: spec.business_name,
        legal_type: spec.legal_type,
        cr_number: spec.cr_number ?? null,
        national_id: spec.national_id ?? null,
        bio: spec.bio,
        base_city: spec.base_city,
        service_area_cities: [spec.base_city],
        languages: spec.languages,
        capacity: spec.capacity,
        concurrent_event_limit: spec.concurrent_event_limit,
        verification_status: approve ? "approved" : "pending",
        is_published: approve,
        accent_color: accentHex,
        works_with_segments: spec.works_with_segments,
        // profile_sections_order left to DB default.
        // logo_path left null (suppliers upload their own).
      })
      .eq("id", supplierId);
    if (updErr) throw new Error(`supplier update: ${updErr.message}`);
  } else {
    const slug = await uniqueSlug(spec.business_name);
    const { data: inserted, error: insErr } = await supa
      .from("suppliers")
      .insert({
        profile_id: user.id,
        business_name: spec.business_name,
        slug,
        legal_type: spec.legal_type,
        cr_number: spec.cr_number ?? null,
        national_id: spec.national_id ?? null,
        bio: spec.bio,
        base_city: spec.base_city,
        service_area_cities: [spec.base_city],
        languages: spec.languages,
        capacity: spec.capacity,
        concurrent_event_limit: spec.concurrent_event_limit,
        verification_status: approve ? "approved" : "pending",
        is_published: approve,
        accent_color: accentHex,
        works_with_segments: spec.works_with_segments,
        // profile_sections_order left to DB default.
        // logo_path left null (suppliers upload their own).
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      throw new Error(`supplier insert: ${insErr?.message ?? "no row"}`);
    }
    supplierId = inserted.id as string;
  }

  const subcategoryId = await findCategoryBySlug(spec.subcategory_slug);
  const { error: linkErr } = await supa.from("supplier_categories").upsert(
    { supplier_id: supplierId, subcategory_id: subcategoryId },
    { onConflict: "supplier_id,subcategory_id" },
  );
  if (linkErr) throw new Error(`supplier_categories: ${linkErr.message}`);

  const { data: existingPackages } = await supa
    .from("packages")
    .select("id, name")
    .eq("supplier_id", supplierId);
  const existingPkgNames = new Set((existingPackages ?? []).map((p) => p.name as string));
  for (let p = 0; p < 2; p++) {
    const name = `${spec.business_name} — Package ${p + 1}`;
    if (existingPkgNames.has(name)) continue;
    const { error: pkgErr } = await supa.from("packages").insert({
      supplier_id: supplierId,
      subcategory_id: subcategoryId,
      name,
      description: `${spec.bio} Signature package ${p + 1}.`,
      base_price_halalas: sarToHalalas(spec.package_prices_sar[p]),
      currency: "SAR",
      unit: spec.package_units[p],
      min_qty: spec.min_qty[p],
      from_price_visible: true,
      is_active: true,
    });
    if (pkgErr) throw new Error(`package insert: ${pkgErr.message}`);
  }

  const ruleType = PRICING_RULE_ORDER[(idx - 1) % PRICING_RULE_ORDER.length]!;
  const config = parsePricingRuleConfig(ruleType, pricingConfigFor(ruleType));
  const { data: existingRule } = await supa
    .from("pricing_rules")
    .select("id")
    .eq("supplier_id", supplierId)
    .eq("rule_type", ruleType)
    .maybeSingle();
  if (!existingRule) {
    const { error: ruleErr } = await supa.from("pricing_rules").insert({
      supplier_id: supplierId,
      package_id: null,
      rule_type: ruleType,
      config_jsonb: config,
      priority: 100,
      version: 1,
      is_active: true,
      currency: "SAR",
    });
    if (ruleErr) throw new Error(`pricing_rule insert: ${ruleErr.message}`);
  }

  const { data: existingPortfolio } = await supa.storage
    .from(STORAGE_BUCKETS.portfolio)
    .list(`${supplierId}/portfolio`, { limit: 10 });
  const existingPortfolioCount = existingPortfolio?.length ?? 0;

  if (existingPortfolioCount < 2) {
    for (let pi = existingPortfolioCount; pi < 2; pi++) {
      const { bytes, contentType } = await fetchPlaceholderPng(
        `https://placehold.co/800x600.png?text=Sevent+${encodeURIComponent(spec.business_name)}`,
      );
      const path = supplierScopedPath(supplierId, "portfolio", `photo-${pi + 1}.png`);
      await uploadBytes(STORAGE_BUCKETS.portfolio, path, bytes, contentType);

      const { data: existingMedia } = await supa
        .from("supplier_media")
        .select("id")
        .eq("supplier_id", supplierId)
        .eq("file_path", path)
        .maybeSingle();
      if (!existingMedia) {
        const { error: mediaErr } = await supa.from("supplier_media").insert({
          supplier_id: supplierId,
          kind: "photo",
          file_path: path,
          title: `${spec.business_name} sample ${pi + 1}`,
          sort_order: pi,
        });
        if (mediaErr) throw new Error(`supplier_media insert: ${mediaErr.message}`);
      }
    }
  }

  const { data: existingDocs } = await supa
    .from("supplier_docs")
    .select("id")
    .eq("supplier_id", supplierId);
  if (!existingDocs || existingDocs.length === 0) {
    const docPath = supplierScopedPath(supplierId, "docs", "cr-or-id.png");
    await uploadBytes(STORAGE_BUCKETS.docs, docPath, tinyPngBuffer(), "image/png");
    const docType = spec.legal_type === "freelancer" ? "id" : "cr";
    const { error: docErr } = await supa.from("supplier_docs").insert({
      supplier_id: supplierId,
      doc_type: docType,
      file_path: docPath,
      status: approve ? "approved" : "pending",
      notes: "Seeded fixture",
    });
    if (docErr) throw new Error(`supplier_docs insert: ${docErr.message}`);
  }
}

async function main() {
  if (SUPPLIERS.length !== 25) {
    throw new Error(`expected 25 supplier fixtures, got ${SUPPLIERS.length}`);
  }

  console.log("[seed] Creating admin + organizers…");
  const admin = await upsertAuthUser({
    email: "admin@sevent.dev",
    password: "AdminPass123!",
    fullName: "Sevent Admin",
    role: "admin",
  });
  await ensureProfileRole(admin.id, "admin");

  for (const idx of [1, 2]) {
    const user = await upsertAuthUser({
      email: `organizer${idx}@sevent.dev`,
      password: "OrgPass123!",
      fullName: `Organizer ${idx}`,
      role: "organizer",
    });
    await ensureProfileRole(user.id, "organizer");
  }

  console.log("[seed] Creating 25 suppliers…");
  const APPROVED_COUNT = 8;
  for (let i = 0; i < SUPPLIERS.length; i++) {
    const idx = i + 1;
    await seedSupplier(idx, SUPPLIERS[i]!, i < APPROVED_COUNT);
  }

  console.log("[seed] Done.");
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
