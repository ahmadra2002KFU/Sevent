import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PackageRow,
  PricingRuleRow,
  SupplierRow,
} from "@/lib/supabase/types";

export type CatalogSubcategory = {
  id: string;
  slug: string;
  name_en: string;
  parent_id: string | null;
  parent_name_en: string | null;
};

export type CatalogBootstrap =
  | {
      ok: true;
      supplier: Pick<
        SupplierRow,
        "id" | "business_name" | "slug" | "verification_status" | "is_published"
      >;
      packages: PackageRow[];
      rules: PricingRuleRow[];
      subcategories: CatalogSubcategory[];
      selectedSubcategoryIds: string[];
    }
  | { ok: false; error: string };

export async function loadCatalogBootstrap(): Promise<CatalogBootstrap> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, error: "You must be signed in to manage the catalog." };
  }

  const { data: supplier, error: supplierErr } = await supabase
    .from("suppliers")
    .select("id, business_name, slug, verification_status, is_published")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (supplierErr) {
    return { ok: false, error: `Supplier lookup failed: ${supplierErr.message}` };
  }
  if (!supplier) {
    return {
      ok: false,
      error: "Complete supplier onboarding before adding packages.",
    };
  }

  const supplierId = supplier.id as string;

  const [packagesRes, rulesRes, catsRes, linksRes] = await Promise.all([
    supabase
      .from("packages")
      .select(
        "id, supplier_id, subcategory_id, name, description, base_price_halalas, currency, unit, min_qty, max_qty, from_price_visible, is_active, created_at, updated_at",
      )
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false }),
    supabase
      .from("pricing_rules")
      .select(
        "id, supplier_id, package_id, rule_type, config_jsonb, priority, version, is_active, valid_from, valid_to, currency, created_at, updated_at",
      )
      .eq("supplier_id", supplierId)
      .order("priority", { ascending: true })
      .order("version", { ascending: false }),
    supabase
      .from("categories")
      .select("id, slug, name_en, parent_id")
      .order("sort_order", { ascending: true }),
    supabase
      .from("supplier_categories")
      .select("subcategory_id")
      .eq("supplier_id", supplierId),
  ]);

  if (packagesRes.error) {
    return { ok: false, error: `Failed to load packages: ${packagesRes.error.message}` };
  }
  if (rulesRes.error) {
    return { ok: false, error: `Failed to load pricing rules: ${rulesRes.error.message}` };
  }
  if (catsRes.error) {
    return { ok: false, error: `Failed to load categories: ${catsRes.error.message}` };
  }
  if (linksRes.error) {
    return {
      ok: false,
      error: `Failed to load supplier categories: ${linksRes.error.message}`,
    };
  }

  const allCats = catsRes.data ?? [];
  const parentNameById = new Map<string, string>();
  for (const c of allCats) {
    if (c.parent_id === null) parentNameById.set(c.id as string, c.name_en as string);
  }

  const subcategories: CatalogSubcategory[] = allCats
    .filter((c) => c.parent_id !== null)
    .map((c) => ({
      id: c.id as string,
      slug: c.slug as string,
      name_en: c.name_en as string,
      parent_id: (c.parent_id as string | null) ?? null,
      parent_name_en: c.parent_id
        ? parentNameById.get(c.parent_id as string) ?? null
        : null,
    }));

  const selectedSubcategoryIds = (linksRes.data ?? []).map(
    (r) => r.subcategory_id as string,
  );

  return {
    ok: true,
    supplier: {
      id: supplierId,
      business_name: supplier.business_name as string,
      slug: supplier.slug as string,
      verification_status:
        supplier.verification_status as SupplierRow["verification_status"],
      is_published: Boolean(supplier.is_published),
    },
    packages: (packagesRes.data ?? []) as PackageRow[],
    rules: (rulesRes.data ?? []) as PricingRuleRow[],
    subcategories,
    selectedSubcategoryIds,
  };
}
