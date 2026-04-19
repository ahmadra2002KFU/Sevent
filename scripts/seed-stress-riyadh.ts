/**
 * Stress-seed: 100 Riyadh suppliers, all approved + published.
 *
 * Purpose: exercise auto-match ranking with realistic competition. Kept separate
 * from the canonical `scripts/seed-users.ts` fixture (25 suppliers, documented
 * across categories + cities) so it can be added/removed without disturbing the
 * baseline.
 *
 * See `Claude Docs/stress-seed-riyadh-100.md` for purpose, usage, cleanup.
 *
 * Run:   pnpm seed:stress
 * Clean: pnpm seed:stress:clean
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { createClient } from "@supabase/supabase-js";
import { sarToHalalas } from "../src/lib/domain/money";
import {
  parsePricingRuleConfig,
  type PricingRuleType,
} from "../src/lib/domain/pricing/rules";
import { slugifyBusinessName } from "../src/lib/domain/onboarding";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "[stress-seed] Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const STRESS_EMAIL_PREFIX = "rstress-";
export const STRESS_EMAIL_DOMAIN = "@sevent.dev";
const PASSWORD = "StressPass123!";

type Sub =
  | "venue-ballroom"
  | "venue-outdoor"
  | "venue-conference"
  | "catering-buffet"
  | "catering-plated"
  | "catering-coffee"
  | "photo-wedding"
  | "photo-corporate";

type CatSpec = {
  slug: Sub;
  count: number;
  suffixes: string[];
  unit: "event" | "hour" | "day" | "person" | "unit";
  priceMedianSar: number;
  minQtyRange: [number, number];
};

// Distribution totals 100. Median prices mirror real Riyadh market bands so the
// ranker's travel-fit / quality signals stay in a believable order of magnitude.
const CATEGORIES: CatSpec[] = [
  { slug: "venue-ballroom", count: 12, suffixes: ["Ballroom", "Palace", "Grand Hall"], unit: "event", priceMedianSar: 45000, minQtyRange: [1, 1] },
  { slug: "venue-outdoor", count: 12, suffixes: ["Gardens", "Pavilion", "Outdoor"], unit: "event", priceMedianSar: 32000, minQtyRange: [1, 1] },
  { slug: "venue-conference", count: 12, suffixes: ["Conference", "Convention", "Centre"], unit: "day", priceMedianSar: 20000, minQtyRange: [1, 1] },
  { slug: "catering-buffet", count: 13, suffixes: ["Buffet", "Catering Co", "Kitchen"], unit: "person", priceMedianSar: 300, minQtyRange: [40, 80] },
  { slug: "catering-plated", count: 13, suffixes: ["Plated", "Dining", "Gastronomy"], unit: "person", priceMedianSar: 500, minQtyRange: [20, 50] },
  { slug: "catering-coffee", count: 13, suffixes: ["Qahwa", "Coffee House", "Sweets"], unit: "event", priceMedianSar: 4000, minQtyRange: [1, 1] },
  { slug: "photo-wedding", count: 13, suffixes: ["Lens", "Studio", "Wedding Photo"], unit: "event", priceMedianSar: 11000, minQtyRange: [1, 1] },
  { slug: "photo-corporate", count: 12, suffixes: ["Capture", "Corporate Photo", "Media House"], unit: "event", priceMedianSar: 8000, minQtyRange: [1, 1] },
];

const PREFIXES = [
  "Najd", "Al Qasr", "Diriyah", "Olaya", "Ghadir", "Sulaimaniyah",
  "Al Yasmin", "Al Nakheel", "Al Malqa", "Al Izdihar", "Al Hamra",
  "Al Rabwah", "Al Murooj", "Al Faisaliyah", "Al Mohammadiyah",
  "Al Worood", "Al Sahafah", "Al Aqiq", "Al Narjis", "Al Arid",
  "King Fahd", "King Abdullah", "King Salman", "Ar Rawdah",
  "Kingdom", "Riyadh Centre", "North Riyadh", "Al Murabba",
  "Al Hada", "Al Ghadir",
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

// Seed a per-run RNG so names/prices are stable across reruns (idempotency).
// A cheap LCG is enough for dummy-data generation.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const categoryIdBySlug = new Map<string, string>();
async function loadCategoryIds() {
  const { data, error } = await supa
    .from("categories")
    .select("id, slug")
    .in("slug", CATEGORIES.map((c) => c.slug));
  if (error) throw new Error(`categories lookup: ${error.message}`);
  for (const row of data ?? []) {
    categoryIdBySlug.set(row.slug as string, row.id as string);
  }
  for (const c of CATEGORIES) {
    if (!categoryIdBySlug.has(c.slug)) {
      throw new Error(
        `category ${c.slug} missing - run supabase db reset + pnpm seed first`,
      );
    }
  }
}

async function upsertAuthUser(
  email: string,
  fullName: string,
): Promise<{ id: string; existed: boolean }> {
  // Search by email in pages of 1000 to handle >1000 users later.
  let page = 1;
  while (true) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (hit) return { id: hit.id, existed: true };
    if (data.users.length < 1000) break;
    page += 1;
  }
  const { data, error } = await supa.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "supplier", full_name: fullName, language: "en" },
  });
  if (error || !data.user) {
    throw new Error(`createUser(${email}): ${error?.message ?? "no user"}`);
  }
  return { id: data.user.id, existed: false };
}

async function uniqueSlug(base: string): Promise<string> {
  const slug = slugifyBusinessName(base) || "supplier";
  let candidate = slug;
  let n = 1;
  while (true) {
    const { data, error } = await supa
      .from("suppliers")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw new Error(`slug lookup: ${error.message}`);
    if (!data) return candidate;
    n += 1;
    candidate = `${slug}-${n}`;
    if (n > 200) throw new Error(`cannot resolve slug for ${base}`);
  }
}

async function seedOne(
  idx: number,
  cat: CatSpec,
  rand: () => number,
): Promise<"created" | "updated"> {
  const emailIdx = String(idx).padStart(3, "0");
  const email = `${STRESS_EMAIL_PREFIX}${emailIdx}${STRESS_EMAIL_DOMAIN}`;
  const prefix = PREFIXES[Math.floor(rand() * PREFIXES.length)];
  const suffix = cat.suffixes[Math.floor(rand() * cat.suffixes.length)];
  const businessName = `${prefix} ${suffix} ${emailIdx}`;

  const { id: userId, existed } = await upsertAuthUser(email, businessName);

  await supa.from("profiles").update({ role: "supplier" }).eq("id", userId);

  const jitter = 0.75 + rand() * 0.5; // ±25%
  const basePriceSar = Math.round(cat.priceMedianSar * jitter);
  const minQty = cat.minQtyRange[0] + Math.floor(rand() * (cat.minQtyRange[1] - cat.minQtyRange[0] + 1));
  const capacity = 50 + Math.floor(rand() * 950);
  const concurrent = 1 + Math.floor(rand() * 3);

  const { data: existing } = await supa
    .from("suppliers")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();

  let supplierId: string;
  if (existing) {
    supplierId = existing.id as string;
    await supa
      .from("suppliers")
      .update({
        business_name: businessName,
        bio: `Stress-seed supplier in ${cat.slug}. Generated for auto-match load testing.`,
        base_city: "Riyadh",
        service_area_cities: ["Riyadh"],
        languages: ["ar", "en"],
        capacity,
        concurrent_event_limit: concurrent,
        verification_status: "approved",
        is_published: true,
      })
      .eq("id", supplierId);
  } else {
    const slug = await uniqueSlug(businessName);
    const { data: inserted, error: insErr } = await supa
      .from("suppliers")
      .insert({
        profile_id: userId,
        business_name: businessName,
        slug,
        legal_type: "company",
        cr_number: `10${emailIdx.padStart(8, "9")}`,
        bio: `Stress-seed supplier in ${cat.slug}. Generated for auto-match load testing.`,
        base_city: "Riyadh",
        service_area_cities: ["Riyadh"],
        languages: ["ar", "en"],
        capacity,
        concurrent_event_limit: concurrent,
        verification_status: "approved",
        is_published: true,
      })
      .select("id")
      .single();
    if (insErr || !inserted) throw new Error(`supplier insert: ${insErr?.message}`);
    supplierId = inserted.id as string;
  }

  const subcategoryId = categoryIdBySlug.get(cat.slug)!;
  await supa
    .from("supplier_categories")
    .upsert(
      { supplier_id: supplierId, subcategory_id: subcategoryId },
      { onConflict: "supplier_id,subcategory_id" },
    );

  const { data: pkgRow } = await supa
    .from("packages")
    .select("id")
    .eq("supplier_id", supplierId)
    .maybeSingle();
  if (!pkgRow) {
    await supa.from("packages").insert({
      supplier_id: supplierId,
      subcategory_id: subcategoryId,
      name: `${businessName} — Signature`,
      description: `Signature package from ${businessName}. Stress-seed fixture.`,
      base_price_halalas: sarToHalalas(basePriceSar),
      currency: "SAR",
      unit: cat.unit,
      min_qty: minQty,
      from_price_visible: true,
      is_active: true,
    });
  }

  const ruleType = PRICING_RULE_ORDER[(idx - 1) % PRICING_RULE_ORDER.length];
  const { data: existingRule } = await supa
    .from("pricing_rules")
    .select("id")
    .eq("supplier_id", supplierId)
    .eq("rule_type", ruleType)
    .maybeSingle();
  if (!existingRule) {
    await supa.from("pricing_rules").insert({
      supplier_id: supplierId,
      package_id: null,
      rule_type: ruleType,
      config_jsonb: parsePricingRuleConfig(ruleType, pricingConfigFor(ruleType)),
      priority: 100,
      version: 1,
      is_active: true,
      currency: "SAR",
    });
  }

  return existed ? "updated" : "created";
}

async function main() {
  await loadCategoryIds();

  console.log(`[stress-seed] Seeding 100 Riyadh suppliers…`);
  let created = 0;
  let updated = 0;
  let idx = 1;
  const rand = lcg(0xC0FFEE);
  for (const cat of CATEGORIES) {
    for (let i = 0; i < cat.count; i++) {
      const result = await seedOne(idx, cat, rand);
      if (result === "created") created += 1;
      else updated += 1;
      if (idx % 10 === 0) console.log(`  …${idx}/100`);
      idx += 1;
    }
  }
  console.log(`[stress-seed] Done. created=${created} updated=${updated}`);
  console.log(`[stress-seed] Password for all: ${PASSWORD}`);
  console.log(`[stress-seed] Emails: ${STRESS_EMAIL_PREFIX}001${STRESS_EMAIL_DOMAIN} … ${STRESS_EMAIL_PREFIX}100${STRESS_EMAIL_DOMAIN}`);
}

main().catch((err) => {
  console.error("[stress-seed] FAILED:", err);
  process.exit(1);
});
