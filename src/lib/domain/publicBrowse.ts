/**
 * Read-side DTOs + queries for the public category browse pages (Lane 1).
 *
 * Server-side only — do not import from client components. Mirrors the
 * structure of `src/lib/domain/supplierProfile.ts` (anon Supabase client,
 * RLS-enforced visibility, small typed DTOs at the boundary).
 *
 * RLS policies on `suppliers`, `supplier_categories`, `supplier_media` and
 * `categories` already hide unpublished or un-approved rows from anon readers,
 * so every row these queries return is safe to expose publicly.
 */

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  STORAGE_BUCKETS,
  createSignedDownloadUrl,
} from "@/lib/supabase/storage";

export type PublicBrowseCategory = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string | null;
  supplier_count: number;
};

export type PublicBrowseSupplier = {
  id: string;
  slug: string;
  business_name: string;
  base_city: string;
  first_photo_url: string | null;
};

export type PublicBrowseSubcategoryWithSuppliers = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string | null;
  suppliers: PublicBrowseSupplier[];
};

const SUPPLIERS_PER_SUBCATEGORY = 8;

/**
 * Returns the list of top-level categories (parent_id IS NULL) with an
 * approximate count of approved+published suppliers that have at least one
 * subcategory under that parent.
 *
 * Two-query approach keeps the typing flat: we pull parents, then children,
 * then supplier_categories joined to the visible suppliers, and join in TS.
 */
export async function listTopLevelCategoriesUncached(): Promise<PublicBrowseCategory[]> {
  const supabase = await createSupabaseServerClient();

  const { data: parentRows, error: parentErr } = await supabase
    .from("categories")
    .select("id, slug, name_en, name_ar, sort_order")
    .is("parent_id", null)
    .order("sort_order", { ascending: true });

  if (parentErr || !parentRows) return [];
  if (parentRows.length === 0) return [];

  const parentIds = parentRows.map((r) => r.id as string);

  // children: parent_id -> [child_id, ...]
  const { data: childRows } = await supabase
    .from("categories")
    .select("id, parent_id")
    .in("parent_id", parentIds);

  const childToParent = new Map<string, string>();
  const childIds: string[] = [];
  for (const row of childRows ?? []) {
    const childId = row.id as string;
    const parentId = row.parent_id as string;
    childToParent.set(childId, parentId);
    childIds.push(childId);
  }

  // supplier_categories joined to visible suppliers. If no children, skip.
  const countByParent = new Map<string, number>();
  for (const id of parentIds) countByParent.set(id, 0);

  if (childIds.length > 0) {
    type SupplierCategoryJoinRow = {
      supplier_id: string;
      subcategory_id: string;
      suppliers:
        | {
            id: string;
            verification_status: string;
            is_published: boolean;
          }
        | null;
    };
    const { data: scRows } = await supabase
      .from("supplier_categories")
      .select(
        "supplier_id, subcategory_id, suppliers:supplier_id ( id, verification_status, is_published )",
      )
      .in("subcategory_id", childIds);

    const rows = (scRows ?? []) as unknown as SupplierCategoryJoinRow[];
    // Deduplicate: one supplier may offer multiple subcategories under the
    // same parent — count them once per parent.
    const seenPerParent = new Map<string, Set<string>>();
    for (const row of rows) {
      const sup = row.suppliers;
      if (!sup) continue;
      if (sup.verification_status !== "approved" || !sup.is_published) continue;
      const parentId = childToParent.get(row.subcategory_id);
      if (!parentId) continue;
      let seen = seenPerParent.get(parentId);
      if (!seen) {
        seen = new Set<string>();
        seenPerParent.set(parentId, seen);
      }
      if (seen.has(sup.id)) continue;
      seen.add(sup.id);
      countByParent.set(parentId, (countByParent.get(parentId) ?? 0) + 1);
    }
  }

  return parentRows.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    name_en: r.name_en as string,
    name_ar: (r as { name_ar?: string | null }).name_ar ?? null,
    supplier_count: countByParent.get(r.id as string) ?? 0,
  }));
}

/**
 * Looks up a top-level parent category by slug. Returns `null` when no parent
 * with that slug exists (the caller should render 404). We explicitly filter
 * on `parent_id IS NULL` so a child slug does not leak through.
 */
export async function getParentCategoryBySlugUncached(
  slug: string,
): Promise<{
  id: string;
  slug: string;
  name_en: string;
  name_ar: string | null;
} | null> {
  if (!slug || typeof slug !== "string") return null;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name_en, name_ar")
    .eq("slug", slug)
    .is("parent_id", null)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id as string,
    slug: data.slug as string,
    name_en: data.name_en as string,
    name_ar: (data as { name_ar?: string | null }).name_ar ?? null,
  };
}

/**
 * For each subcategory under the given parent, returns up to
 * `SUPPLIERS_PER_SUBCATEGORY` approved+published suppliers (optionally filtered
 * by city: either base_city equals the city OR service_area_cities contains
 * it). Each supplier is returned with its first portfolio photo (sort_order
 * ascending) or null when no photo has been uploaded.
 */
export async function listSubcategoriesWithSuppliersUncached(
  parentId: string,
  city: string | null,
): Promise<PublicBrowseSubcategoryWithSuppliers[]> {
  if (!parentId) return [];
  const supabase = await createSupabaseServerClient();

  const { data: subRows, error: subErr } = await supabase
    .from("categories")
    .select("id, slug, name_en, name_ar, sort_order")
    .eq("parent_id", parentId)
    .order("sort_order", { ascending: true });

  if (subErr || !subRows || subRows.length === 0) return [];

  const subcategoryIds = subRows.map((r) => r.id as string);

  // Pull every (supplier_id, subcategory_id) link for these subcategories with
  // the supplier row joined; we'll filter approved+published + city in TS, and
  // cap each subcategory to SUPPLIERS_PER_SUBCATEGORY suppliers.
  type SupplierRow = {
    id: string;
    slug: string;
    business_name: string;
    base_city: string;
    service_area_cities: string[] | null;
    serves_all_ksa: boolean | null;
    verification_status: string;
    is_published: boolean;
  };
  type ScRow = {
    subcategory_id: string;
    supplier_id: string;
    suppliers: SupplierRow | null;
  };

  const { data: scRows } = await supabase
    .from("supplier_categories")
    .select(
      "subcategory_id, supplier_id, suppliers:supplier_id ( id, slug, business_name, base_city, service_area_cities, serves_all_ksa, verification_status, is_published )",
    )
    .in("subcategory_id", subcategoryIds);

  const joined = (scRows ?? []) as unknown as ScRow[];

  const matchesCity = (sup: SupplierRow): boolean => {
    if (!city) return true;
    if (sup.serves_all_ksa) return true;
    if (sup.base_city === city) return true;
    const area = sup.service_area_cities ?? [];
    return Array.isArray(area) && area.includes(city);
  };

  // Group by subcategory, dedupe suppliers per subcategory, cap at N.
  const bySub = new Map<string, SupplierRow[]>();
  for (const id of subcategoryIds) bySub.set(id, []);
  const seenPerSub = new Map<string, Set<string>>();

  for (const row of joined) {
    const sup = row.suppliers;
    if (!sup) continue;
    if (sup.verification_status !== "approved" || !sup.is_published) continue;
    if (!matchesCity(sup)) continue;
    const bucket = bySub.get(row.subcategory_id);
    if (!bucket) continue;
    if (bucket.length >= SUPPLIERS_PER_SUBCATEGORY) continue;
    let seen = seenPerSub.get(row.subcategory_id);
    if (!seen) {
      seen = new Set<string>();
      seenPerSub.set(row.subcategory_id, seen);
    }
    if (seen.has(sup.id)) continue;
    seen.add(sup.id);
    bucket.push(sup);
  }

  // Batch-fetch the first photo per supplier in a single query.
  const supplierIdSet = new Set<string>();
  for (const list of bySub.values()) {
    for (const sup of list) supplierIdSet.add(sup.id);
  }

  const firstPhotoBySupplier = new Map<string, string>();
  if (supplierIdSet.size > 0) {
    const { data: mediaRows } = await supabase
      .from("supplier_media")
      .select("supplier_id, file_path, sort_order, kind")
      .in("supplier_id", Array.from(supplierIdSet))
      .eq("kind", "photo")
      .order("sort_order", { ascending: true });

    const seen = new Set<string>();
    const firstByPath: Array<{ sid: string; path: string }> = [];
    for (const row of mediaRows ?? []) {
      const sid = row.supplier_id as string;
      if (seen.has(sid)) continue;
      seen.add(sid);
      firstByPath.push({ sid, path: row.file_path as string });
    }
    const signedUrls = await Promise.all(
      firstByPath.map(({ path }) =>
        createSignedDownloadUrl(supabase, STORAGE_BUCKETS.portfolio, path),
      ),
    );
    firstByPath.forEach(({ sid }, i) => {
      firstPhotoBySupplier.set(sid, signedUrls[i]);
    });
  }

  return subRows.map((row) => {
    const id = row.id as string;
    const suppliers = bySub.get(id) ?? [];
    return {
      id,
      slug: row.slug as string,
      name_en: row.name_en as string,
      name_ar: (row as { name_ar?: string | null }).name_ar ?? null,
      suppliers: suppliers.map((sup) => ({
        id: sup.id,
        slug: sup.slug,
        business_name: sup.business_name,
        base_city: sup.base_city,
        first_photo_url: firstPhotoBySupplier.get(sup.id) ?? null,
      })),
    };
  });
}

/**
 * Cached variants for production. Safe to call multiple times in the same RSC
 * tree (e.g. `generateMetadata` + page body); React `cache()` coalesces
 * repeated calls into a single DB round-trip per request.
 */
export const listTopLevelCategories = cache(listTopLevelCategoriesUncached);
export const getParentCategoryBySlug = cache(getParentCategoryBySlugUncached);
export const listSubcategoriesWithSuppliers = cache(
  listSubcategoriesWithSuppliersUncached,
);
