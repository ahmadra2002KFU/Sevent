/**
 * Read-side DTOs and queries for the public supplier profile page (Lane 2).
 *
 * Server-side only — do not import from client components. All money stays in
 * halalas; formatting is the caller's concern (use `formatHalalas` from money.ts).
 *
 * RLS policies on suppliers, packages, supplier_media, supplier_categories and
 * reviews already enforce published/approved visibility. We still re-check in
 * `getPublicSupplierBySlug` so a misconfigured RLS does not silently leak
 * unpublished rows.
 */

import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import {
  STORAGE_BUCKETS,
  createSignedDownloadUrl,
  publicPortfolioUrl,
} from "@/lib/supabase/storage";
import { DEFAULT_ACCENT_HEX } from "@/lib/domain/taxonomy";

const DEFAULT_SECTIONS_ORDER: ReadonlyArray<string> = Object.freeze([
  "bio",
  "packages",
  "portfolio",
  "reviews",
]);

export type PublicSupplierPackage = {
  id: string;
  name: string;
  description: string | null;
  base_price_halalas: number;
  unit: "event" | "hour" | "day" | "person" | "unit";
  min_qty: number;
  max_qty: number | null;
  from_price_visible: boolean;
};

export type PublicSupplierMedia = {
  id: string;
  title: string | null;
  sort_order: number;
  public_url: string;
};

export type PublicSupplierReviewSummary = {
  count: number;
  average_overall: number | null;
};

export type PublicSupplierSubcategory = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string | null;
  parent_name_en: string | null;
  parent_name_ar: string | null;
};

export type PublicSupplierCompanyProfileDoc = {
  /** Signed, short-lived download URL for the company profile PDF. */
  download_url: string;
  file_path: string;
};

export type PublicSupplierProfile = {
  id: string;
  slug: string;
  business_name: string;
  bio: string | null;
  base_city: string;
  service_area_cities: string[];
  languages: string[];
  verification_status: "approved";
  is_published: true;
  /** Signed URL for the supplier's uploaded logo, or `null` if none. */
  logo_url: string | null;
  /** Hex accent color (always populated — defaults to platform cobalt). */
  accent_color: string;
  /**
   * Order in which to render profile sections. Always contains every known
   * slug (`bio`, `packages`, `portfolio`, `reviews`) in the saved order, with
   * any missing slugs appended at the end in the default order. Unknown
   * slugs coming from the DB are filtered out by the caller.
   */
  profile_sections_order: string[];
  /** Company profile PDF download, when the supplier has an approved row. */
  company_profile: PublicSupplierCompanyProfileDoc | null;
  packages: PublicSupplierPackage[];
  media: PublicSupplierMedia[];
  subcategories: PublicSupplierSubcategory[];
  reviewSummary: PublicSupplierReviewSummary;
};

/**
 * Returns the profile DTO for a published + approved supplier. Returns `null`
 * when no such supplier exists (the caller should render a 404). The anon
 * Supabase client is intentionally used here — RLS policies enforce the
 * `is_published AND verification_status='approved'` visibility rule, so any
 * row this query returns is safe to expose publicly.
 */
export async function getPublicSupplierBySlug(
  slug: string,
): Promise<PublicSupplierProfile | null> {
  if (!slug || typeof slug !== "string") return null;

  const supabase = await createSupabaseServerClient();

  const { data: supplier, error: supplierErr } = await supabase
    .from("suppliers")
    .select(
      "id, profile_id, slug, business_name, bio, base_city, service_area_cities, languages, verification_status, is_published, logo_path, accent_color, profile_sections_order",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("verification_status", "approved")
    .maybeSingle();
  if (supplierErr || !supplier) return null;

  const supplierId = supplier.id as string;
  const profileId = supplier.profile_id as string;

  // `supplier-logos` is RLS-gated non-public. We reach for the service-role
  // client here strictly to mint short-lived signed URLs for the logo. The
  // company-profile PDF is no longer surfaced on the public profile (see
  // Screen 6/7 redesign — decision 6); it's gated behind an accepted quote
  // and surfaced on the organizer booking detail page instead.
  const admin = createSupabaseServiceRoleClient();

  const [packagesRes, mediaRes, catsRes, reviewsRes] = await Promise.all([
    supabase
      .from("packages")
      .select(
        "id, name, description, base_price_halalas, unit, min_qty, max_qty, from_price_visible, is_active",
      )
      .eq("supplier_id", supplierId)
      .eq("is_active", true)
      .order("base_price_halalas", { ascending: true }),
    supabase
      .from("supplier_media")
      .select("id, file_path, title, sort_order, kind")
      .eq("supplier_id", supplierId)
      .eq("kind", "photo")
      .order("sort_order", { ascending: true }),
    supabase
      .from("supplier_categories")
      .select(
        "subcategory_id, categories:subcategory_id ( id, slug, name_en, name_ar, parent_id )",
      )
      .eq("supplier_id", supplierId),
    // `reviews.reviewee_id` references profiles, not suppliers. We therefore
    // aggregate by the supplier-owner's profile id. Sprint 5 will wire reviews
    // end-to-end; until then this query returns an empty set and the UI shows
    // the empty-state copy.
    supabase
      .from("reviews")
      .select("ratings_jsonb")
      .eq("reviewee_id", profileId)
      .not("published_at", "is", null),
  ]);

  const packages: PublicSupplierPackage[] = (packagesRes.data ?? []).map(
    (row) => ({
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      base_price_halalas: Number(row.base_price_halalas ?? 0),
      unit: row.unit as PublicSupplierPackage["unit"],
      min_qty: Number(row.min_qty ?? 1),
      max_qty: row.max_qty == null ? null : Number(row.max_qty),
      from_price_visible: Boolean(row.from_price_visible),
    }),
  );

  const media: PublicSupplierMedia[] = (mediaRes.data ?? []).map((row) => ({
    id: row.id as string,
    title: (row.title as string | null) ?? null,
    sort_order: Number(row.sort_order ?? 0),
    public_url: publicPortfolioUrl(supabase, row.file_path as string),
  }));

  // Fetch the parent category names in a second hop so we can show the parent
  // label above the subcategory slug. Keeps the typing simple and avoids
  // relying on Supabase-CLI-generated join helpers.
  type CategoryJoinRow = {
    subcategory_id: string;
    categories:
      | { id: string; slug: string; name_en: string; name_ar: string | null; parent_id: string | null }
      | null;
  };
  const subcategoryRows = (catsRes.data ?? []) as unknown as CategoryJoinRow[];
  const parentIds = Array.from(
    new Set(
      subcategoryRows
        .map((r) => r.categories?.parent_id ?? null)
        .filter((v): v is string => typeof v === "string"),
    ),
  );
  let parentNameById = new Map<
    string,
    { name_en: string; name_ar: string | null }
  >();
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from("categories")
      .select("id, name_en, name_ar")
      .in("id", parentIds);
    parentNameById = new Map(
      (parents ?? []).map((p) => [
        p.id as string,
        {
          name_en: p.name_en as string,
          name_ar: (p as { name_ar?: string | null }).name_ar ?? null,
        },
      ]),
    );
  }

  const subcategories: PublicSupplierSubcategory[] = subcategoryRows
    .filter((r) => r.categories)
    .map((r) => {
      const c = r.categories!;
      const parentNames = c.parent_id ? parentNameById.get(c.parent_id) : null;
      return {
        id: c.id,
        slug: c.slug,
        name_en: c.name_en,
        name_ar: c.name_ar,
        parent_name_en: parentNames?.name_en ?? null,
        parent_name_ar: parentNames?.name_ar ?? null,
      };
    });

  const reviewRows = reviewsRes.data ?? [];
  const overalls: number[] = [];
  for (const row of reviewRows) {
    const ratings = row.ratings_jsonb as { overall?: number } | null;
    if (ratings && typeof ratings.overall === "number") {
      overalls.push(ratings.overall);
    }
  }
  const reviewSummary: PublicSupplierReviewSummary = {
    count: overalls.length,
    average_overall:
      overalls.length === 0
        ? null
        : overalls.reduce((a, b) => a + b, 0) / overalls.length,
  };

  // --- Logo: signed download URL from the `supplier-logos` bucket ----------
  // The bucket is non-public with a public-read RLS policy gated by
  // approved+published. The row we just loaded satisfies that gate, so any
  // signed URL we mint is safe to embed in the public page. We prefer signed
  // URLs over `getPublicUrl` because the bucket's `public` flag is `false` —
  // `getPublicUrl` would hand back a URL that still requires the RLS policy
  // to resolve, whereas a signed URL bypasses it cleanly.
  const logoPath = (supplier.logo_path as string | null) ?? null;
  let logoUrl: string | null = null;
  if (logoPath) {
    try {
      logoUrl = await createSignedDownloadUrl(admin, STORAGE_BUCKETS.logos, logoPath);
    } catch {
      // Best-effort: if the object is missing we just fall back to initials.
      logoUrl = null;
    }
  }

  // --- Company profile PDF --------------------------------------------------
  // Intentionally not surfaced on the public profile — see comment above.
  const companyProfile: PublicSupplierCompanyProfileDoc | null = null;

  // --- Accent color + section order -----------------------------------------
  const accentRaw = (supplier.accent_color as string | null) ?? DEFAULT_ACCENT_HEX;
  const accentColor = /^#[0-9a-fA-F]{6}$/.test(accentRaw)
    ? accentRaw
    : DEFAULT_ACCENT_HEX;

  const rawOrder = Array.isArray(supplier.profile_sections_order)
    ? (supplier.profile_sections_order as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  // Keep only known slugs (defensive — DB may drift ahead of the UI), then
  // append any default slugs that were missing so every section still renders.
  const knownFromDb = rawOrder.filter((slug) =>
    DEFAULT_SECTIONS_ORDER.includes(slug),
  );
  const missingDefaults = DEFAULT_SECTIONS_ORDER.filter(
    (slug) => !knownFromDb.includes(slug),
  );
  const profileSectionsOrder =
    knownFromDb.length === 0
      ? [...DEFAULT_SECTIONS_ORDER]
      : [...knownFromDb, ...missingDefaults];

  return {
    id: supplierId,
    slug: supplier.slug as string,
    business_name: supplier.business_name as string,
    bio: (supplier.bio as string | null) ?? null,
    base_city: supplier.base_city as string,
    service_area_cities: (supplier.service_area_cities as string[]) ?? [],
    languages: (supplier.languages as string[]) ?? [],
    verification_status: "approved",
    is_published: true,
    logo_url: logoUrl,
    accent_color: accentColor,
    profile_sections_order: profileSectionsOrder,
    company_profile: companyProfile,
    packages,
    media,
    subcategories,
    reviewSummary,
  };
}
