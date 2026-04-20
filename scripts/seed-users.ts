/**
 * Sevent demo seed — idempotent-by-email service-role user fixture.
 *
 * Creates: 1 admin, 2 organizers, and 25 suppliers (12 Riyadh + 13 Jeddah)
 * spread across six Sprint 2 categories. Every supplier gets:
 *   - profile + suppliers row,
 *   - 2 packages (halalas via money.ts),
 *   - 1 pricing rule (rotated across all 5 pricing_rule_type values),
 *   - 2 portfolio photos uploaded to supplier-portfolio,
 *   - 1 verification doc uploaded to supplier-docs,
 *   - supplier_categories link.
 *
 * First 8 suppliers: approved + is_published=true. Remainder stays pending.
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

type CategorySlug =
  | "venue-ballroom"
  | "venue-outdoor"
  | "venue-conference"
  | "catering-buffet"
  | "catering-plated"
  | "catering-coffee"
  | "photo-wedding"
  | "photo-corporate"
  | "video-cinematic"
  | "photo-drone"
  | "decor-kosha"
  | "decor-florals"
  | "decor-lighting"
  | "dj"
  | "performer"
  | "av-sound"
  | "av-staging";

type SupplierSpec = {
  business_name: string;
  legal_type: "company" | "freelancer" | "foreign";
  base_city: "Riyadh" | "Jeddah";
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
};

const SUPPLIERS: SupplierSpec[] = [
  // Riyadh (12)
  { business_name: "Riyadh Royal Ballroom", legal_type: "company", base_city: "Riyadh", subcategory_slug: "venue-ballroom", languages: ["ar","en"], capacity: 600, concurrent_event_limit: 1, cr_number: "1010111111", bio: "Ballroom venue in North Riyadh with in-house catering partnerships.", package_prices_sar: [35000, 55000], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "Najd Outdoor Gardens", legal_type: "company", base_city: "Riyadh", subcategory_slug: "venue-outdoor", languages: ["ar","en"], capacity: 400, concurrent_event_limit: 1, cr_number: "1010222222", bio: "Outdoor garden venues for corporate and private events.", package_prices_sar: [28000, 42000], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "KAFD Conference Suites", legal_type: "company", base_city: "Riyadh", subcategory_slug: "venue-conference", languages: ["ar","en"], capacity: 250, concurrent_event_limit: 1, cr_number: "1010333333", bio: "Premium conference halls in KAFD with full AV.", package_prices_sar: [18000, 26000], package_units: ["day","day"], min_qty: [1,1] },
  { business_name: "Sufra Catering Riyadh", legal_type: "company", base_city: "Riyadh", subcategory_slug: "catering-buffet", languages: ["ar","en"], capacity: 1000, concurrent_event_limit: 1, cr_number: "1010444444", bio: "Arabic and international buffet catering.", package_prices_sar: [250, 380], package_units: ["person","person"], min_qty: [50,100] },
  { business_name: "Plated Nights Riyadh", legal_type: "company", base_city: "Riyadh", subcategory_slug: "catering-plated", languages: ["en","ar"], capacity: 300, concurrent_event_limit: 1, cr_number: "1010555555", bio: "Fine-dining plated service for weddings and gala dinners.", package_prices_sar: [420, 620], package_units: ["person","person"], min_qty: [30,60] },
  { business_name: "Qahwat Al Najd", legal_type: "freelancer", base_city: "Riyadh", subcategory_slug: "catering-coffee", languages: ["ar"], capacity: 500, concurrent_event_limit: 1, national_id: "1098765431", bio: "Traditional Saudi coffee + dessert service.", package_prices_sar: [3200, 5500], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "Lens Riyadh Studios", legal_type: "company", base_city: "Riyadh", subcategory_slug: "photo-wedding", languages: ["ar","en"], capacity: 1, concurrent_event_limit: 1, cr_number: "1010666666", bio: "Boutique wedding photography.", package_prices_sar: [8500, 14000], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "Capital Corporate Photo", legal_type: "company", base_city: "Riyadh", subcategory_slug: "photo-corporate", languages: ["en","ar"], capacity: 1, concurrent_event_limit: 1, cr_number: "1010777777", bio: "Corporate event photography.", package_prices_sar: [6500, 11500], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "Kosha Kreators Riyadh", legal_type: "company", base_city: "Riyadh", subcategory_slug: "decor-kosha", languages: ["ar","en"], capacity: 1, concurrent_event_limit: 1, cr_number: "1010888888", bio: "Kosha design and stage build for weddings.", package_prices_sar: [22000, 34000], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "Florals of Najd", legal_type: "freelancer", base_city: "Riyadh", subcategory_slug: "decor-florals", languages: ["ar","en"], capacity: 1, concurrent_event_limit: 1, national_id: "1234567890", bio: "Floral designers specializing in modern Arabian arrangements.", package_prices_sar: [4500, 9500], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "Beat Lab DJ Riyadh", legal_type: "freelancer", base_city: "Riyadh", subcategory_slug: "dj", languages: ["en","ar"], capacity: 1, concurrent_event_limit: 1, national_id: "1122334455", bio: "Premium DJ service with lighting rig included.", package_prices_sar: [4200, 7800], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "StageWorks Riyadh", legal_type: "company", base_city: "Riyadh", subcategory_slug: "av-sound", languages: ["en","ar"], capacity: 2000, concurrent_event_limit: 1, cr_number: "1010999999", bio: "Sound reinforcement, mics, and mixing.", package_prices_sar: [9500, 18000], package_units: ["event","event"], min_qty: [1,1] },

  // Jeddah (13)
  { business_name: "Jeddah Corniche Pavilion", legal_type: "company", base_city: "Jeddah", subcategory_slug: "venue-outdoor", languages: ["ar","en"], capacity: 500, concurrent_event_limit: 1, cr_number: "4030111111", bio: "Seaside pavilion on the Jeddah Corniche.", package_prices_sar: [32000, 48000], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "Al Hamra Ballroom", legal_type: "company", base_city: "Jeddah", subcategory_slug: "venue-ballroom", languages: ["ar","en"], capacity: 800, concurrent_event_limit: 1, cr_number: "4030222222", bio: "Grand ballroom in Al Hamra district with parking for 300.", package_prices_sar: [38000, 62000], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "Red Sea Conference Centre", legal_type: "company", base_city: "Jeddah", subcategory_slug: "venue-conference", languages: ["ar","en"], capacity: 300, concurrent_event_limit: 1, cr_number: "4030333333", bio: "Waterfront conference halls with breakout rooms.", package_prices_sar: [16000, 24000], package_units: ["day","day"], min_qty: [1,1] },
  { business_name: "Hijazi Feast Catering", legal_type: "company", base_city: "Jeddah", subcategory_slug: "catering-buffet", languages: ["ar","en"], capacity: 1200, concurrent_event_limit: 1, cr_number: "4030444444", bio: "Authentic Hijazi buffet with live stations.", package_prices_sar: [240, 360], package_units: ["person","person"], min_qty: [60,120] },
  { business_name: "Tihama Plated Dining", legal_type: "company", base_city: "Jeddah", subcategory_slug: "catering-plated", languages: ["en","ar"], capacity: 240, concurrent_event_limit: 1, cr_number: "4030555555", bio: "Modern Saudi plated dining experiences.", package_prices_sar: [410, 580], package_units: ["person","person"], min_qty: [20,50] },
  { business_name: "Dessert Trolley Jeddah", legal_type: "freelancer", base_city: "Jeddah", subcategory_slug: "catering-coffee", languages: ["ar"], capacity: 400, concurrent_event_limit: 1, national_id: "1098765432", bio: "Coffee, dates, and dessert service.", package_prices_sar: [2800, 4800], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "Red Sea Lens", legal_type: "company", base_city: "Jeddah", subcategory_slug: "photo-wedding", languages: ["ar","en"], capacity: 1, concurrent_event_limit: 1, cr_number: "4030666666", bio: "Award-winning wedding photography.", package_prices_sar: [9500, 16000], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "Coast Corporate Video", legal_type: "company", base_city: "Jeddah", subcategory_slug: "video-cinematic", languages: ["en","ar"], capacity: 1, concurrent_event_limit: 1, cr_number: "4030777777", bio: "Cinematic event films and highlight reels.", package_prices_sar: [12000, 22000], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "SkyLens Drone", legal_type: "freelancer", base_city: "Jeddah", subcategory_slug: "photo-drone", languages: ["en","ar"], capacity: 1, concurrent_event_limit: 1, national_id: "1234567899", bio: "Licensed drone pilot for aerial footage.", package_prices_sar: [3800, 6500], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "Petal Studio Jeddah", legal_type: "company", base_city: "Jeddah", subcategory_slug: "decor-florals", languages: ["ar","en"], capacity: 1, concurrent_event_limit: 1, cr_number: "4030888888", bio: "Floral design studio with same-day delivery.", package_prices_sar: [5200, 10500], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "Glow Event Lighting", legal_type: "company", base_city: "Jeddah", subcategory_slug: "decor-lighting", languages: ["en","ar"], capacity: 1, concurrent_event_limit: 1, cr_number: "4030999999", bio: "Architectural and stage lighting.", package_prices_sar: [8500, 15000], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "Hijaz Live Performers", legal_type: "company", base_city: "Jeddah", subcategory_slug: "performer", languages: ["ar","en"], capacity: 1, concurrent_event_limit: 1, cr_number: "4031111111", bio: "Live oud, percussion, and vocal performers.", package_prices_sar: [7200, 13500], package_units: ["event","event"], min_qty: [1,1] },
  { business_name: "Coastline Staging", legal_type: "company", base_city: "Jeddah", subcategory_slug: "av-staging", languages: ["en","ar"], capacity: 1500, concurrent_event_limit: 1, cr_number: "4032222222", bio: "Modular staging, trussing, and LED walls.", package_prices_sar: [14000, 26000], package_units: ["event","event"], min_qty: [1,1] },
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
  const { data, error } = await supa
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`category ${slug}: ${error.message}`);
  if (!data) throw new Error(`category ${slug} missing - run supabase db reset first`);
  return data.id as string;
}

async function seedSupplier(idx: number, spec: SupplierSpec, approve: boolean): Promise<void> {
  const email = `supplier-${idx}@sevent.dev`;
  console.log(`  [${idx}] ${spec.business_name} (${email}) - ${approve ? "approved" : "pending"}`);

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

  const ruleType = PRICING_RULE_ORDER[(idx - 1) % PRICING_RULE_ORDER.length];
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
    await seedSupplier(idx, SUPPLIERS[i], i < APPROVED_COUNT);
  }

  console.log("[seed] Done.");
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
