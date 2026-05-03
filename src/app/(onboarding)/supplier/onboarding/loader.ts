import { cache } from "react";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createSupabaseServiceRoleClient>;

// Column list shared by the access decision, the supplier profile page, and
// the onboarding wizard bootstrap. Selecting once and threading the row
// through callers eliminates duplicate `suppliers` round-trips per page load.
export const SUPPLIER_ROW_COLUMNS =
  "id, business_name, slug, legal_type, cr_number, national_id, bio, base_city, service_area_cities, serves_all_ksa, languages, capacity, concurrent_event_limit, verification_status, is_published, logo_path, works_with_segments, website_url, accent_color, profile_sections_order" as const;

export type SupplierWideRow = {
  id: string;
  business_name: string;
  slug: string;
  legal_type: string | null;
  cr_number: string | null;
  national_id: string | null;
  bio: string | null;
  base_city: string;
  service_area_cities: string[];
  serves_all_ksa: boolean;
  languages: string[];
  capacity: number | null;
  concurrent_event_limit: number;
  verification_status: string;
  is_published: boolean;
  logo_path: string | null;
  works_with_segments: string[];
  website_url: string | null;
  accent_color: string | null;
  profile_sections_order: string[] | null;
};

/**
 * Per-request cached fetcher for the wide `suppliers` row. Wrapped in React
 * `cache()` so multiple callers in the same RSC tree (the access resolver,
 * the profile page, the onboarding bootstrap) share one DB round-trip.
 *
 * Categories are static enterprise data; we cache the listing the same way
 * to avoid refetching it on every wizard mount.
 */
export const getSupplierRowForUserCached = cache(
  async (
    admin: AdminClient,
    userId: string,
    supplierId?: string | null,
  ): Promise<SupplierWideRow | null> => {
    let query = admin.from("suppliers").select(SUPPLIER_ROW_COLUMNS);
    query = supplierId
      ? query.eq("id", supplierId).eq("profile_id", userId)
      : query.eq("profile_id", userId);
    const { data } = await query.maybeSingle();
    return (data as SupplierWideRow | null) ?? null;
  },
);

export const getCategoriesCached = cache(
  async (admin: AdminClient): Promise<OnboardingBootstrap["categories"]> => {
    const { data } = await admin
      .from("categories")
      .select("id, slug, name_en, name_ar, parent_id")
      .order("sort_order", { ascending: true });
    return (data ?? []) as OnboardingBootstrap["categories"];
  },
);

export type OnboardingBootstrap = {
  /** Current profile full_name, used as the default representative name in Step 1. */
  profileFullName: string | null;
  supplier: {
    id: string;
    business_name: string;
    slug: string;
    legal_type: string | null;
    cr_number: string | null;
    national_id: string | null;
    bio: string | null;
    base_city: string;
    service_area_cities: string[];
    serves_all_ksa: boolean;
    languages: string[];
    capacity: number | null;
    concurrent_event_limit: number;
    verification_status: string;
    is_published: boolean;
    logo_path: string | null;
    works_with_segments: string[];
    website_url: string | null;
  } | null;
  docs: Array<{
    id: string;
    doc_type: string;
    file_path: string;
    status: string;
    notes: string | null;
    created_at: string;
  }>;
  subcategoryIds: string[];
  categories: Array<{
    id: string;
    slug: string;
    name_en: string;
    name_ar: string | null;
    parent_id: string | null;
  }>;
};

type LoadOnboardingBootstrapOptions = {
  userId?: string;
  supplierId?: string | null;
  admin?: AdminClient;
  /**
   * Pre-fetched wide supplier row. When provided, the loader skips its own
   * `suppliers` SELECT — useful when the caller (e.g. the supplier profile
   * page) has already fetched the row for its own rendering needs. The row
   * shape must include the columns in `SUPPLIER_ROW_COLUMNS`.
   */
  supplierRow?: SupplierWideRow | null;
};

function shapeSupplier(
  row: SupplierWideRow,
): NonNullable<OnboardingBootstrap["supplier"]> {
  return {
    id: row.id,
    business_name: row.business_name,
    slug: row.slug,
    legal_type: row.legal_type,
    cr_number: row.cr_number,
    national_id: row.national_id,
    bio: row.bio,
    base_city: row.base_city,
    service_area_cities: row.service_area_cities,
    serves_all_ksa: Boolean(row.serves_all_ksa),
    languages: row.languages,
    capacity: row.capacity,
    concurrent_event_limit: row.concurrent_event_limit,
    verification_status: row.verification_status,
    is_published: row.is_published,
    logo_path: row.logo_path ?? null,
    works_with_segments: (row.works_with_segments ?? []) as string[],
    website_url: row.website_url ?? null,
  };
}

export async function loadOnboardingBootstrap(
  options: LoadOnboardingBootstrapOptions = {},
): Promise<OnboardingBootstrap> {
  const admin = options.admin ?? createSupabaseServiceRoleClient();
  let userId = options.userId ?? null;
  if (!userId) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  let supplier: OnboardingBootstrap["supplier"] = null;
  let profileFullName: string | null = null;
  const docs: OnboardingBootstrap["docs"] = [];
  const subcategoryIds: string[] = [];

  // Categories are static enterprise data — share one fetch per request via
  // React `cache()` so re-renders / multiple bootstrap callers don't refetch.
  const categoriesPromise = getCategoriesCached(admin);

  if (userId) {
    // Resolve the wide supplier row up front: prefer a caller-provided row
    // (zero round-trips), fall back to the per-request cache otherwise.
    const supplierRow: SupplierWideRow | null =
      options.supplierRow !== undefined
        ? options.supplierRow
        : await getSupplierRowForUserCached(admin, userId, options.supplierId);

    const resolvedSupplierId = supplierRow?.id ?? options.supplierId ?? null;

    // Fast path: we know the supplier id (either from caller or from the
    // pre-fetched row), so fan out profile + docs + categories in a single
    // round-trip wave instead of two sequential waves.
    if (resolvedSupplierId) {
      const [{ data: profileRow }, { data: docRows }, { data: catRows }] =
        await Promise.all([
          admin
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .maybeSingle(),
          admin
            .from("supplier_docs")
            .select("id, doc_type, file_path, status, notes, created_at")
            .eq("supplier_id", resolvedSupplierId)
            .order("created_at", { ascending: false }),
          admin
            .from("supplier_categories")
            .select("subcategory_id")
            .eq("supplier_id", resolvedSupplierId),
        ]);
      profileFullName = (profileRow?.full_name as string | null) ?? null;
      if (supplierRow) supplier = shapeSupplier(supplierRow);
      if (docRows) docs.push(...docRows);
      if (catRows) {
        for (const c of catRows)
          subcategoryIds.push(c.subcategory_id as string);
      }
    } else {
      // No supplier row at all — only the profile name is needed.
      const { data: profileRow } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      profileFullName = (profileRow?.full_name as string | null) ?? null;
    }
  }

  const categories = await categoriesPromise;

  return {
    profileFullName,
    supplier,
    docs,
    subcategoryIds,
    categories,
  };
}
