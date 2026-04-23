import {
  createSupabaseServiceRoleClient,
  getCurrentUser,
} from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createSupabaseServiceRoleClient>;

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
};

export async function loadOnboardingBootstrap(
  options: LoadOnboardingBootstrapOptions = {},
): Promise<OnboardingBootstrap> {
  const admin = options.admin ?? createSupabaseServiceRoleClient();
  let userId = options.userId ?? null;
  if (!userId) {
    userId = (await getCurrentUser())?.id ?? null;
  }

  let supplier: OnboardingBootstrap["supplier"] = null;
  let profileFullName: string | null = null;
  const docs: OnboardingBootstrap["docs"] = [];
  const subcategoryIds: string[] = [];

  const categoriesPromise = admin
    .from("categories")
    .select("id, slug, name_en, name_ar, parent_id")
    .order("sort_order", { ascending: true });

  if (userId) {
    // Server-side onboarding reads use the service-role client; ownership is
    // still enforced by profile_id/userId filters before data reaches the UI.
    const supplierSelect =
      "id, business_name, slug, legal_type, cr_number, national_id, bio, base_city, service_area_cities, serves_all_ksa, languages, capacity, concurrent_event_limit, verification_status, is_published, logo_path, works_with_segments";
    let supplierQuery = admin.from("suppliers").select(supplierSelect);
    supplierQuery = options.supplierId
      ? supplierQuery.eq("id", options.supplierId).eq("profile_id", userId)
      : supplierQuery.eq("profile_id", userId);

    const [{ data: profileRow }, { data: supplierRow }] = await Promise.all([
      admin
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle(),
      supplierQuery.maybeSingle(),
    ]);
    profileFullName = (profileRow?.full_name as string | null) ?? null;

    if (supplierRow) {
      supplier = {
        ...supplierRow,
        works_with_segments: (supplierRow.works_with_segments ?? []) as string[],
        logo_path: (supplierRow.logo_path ?? null) as string | null,
        serves_all_ksa: Boolean(
          (supplierRow as { serves_all_ksa?: boolean }).serves_all_ksa,
        ),
      } as OnboardingBootstrap["supplier"];
      const [docRowsRes, catsRes] = await Promise.all([
        admin
          .from("supplier_docs")
          .select("id, doc_type, file_path, status, notes, created_at")
          .eq("supplier_id", supplierRow.id)
          .order("created_at", { ascending: false }),
        admin
          .from("supplier_categories")
          .select("subcategory_id")
          .eq("supplier_id", supplierRow.id),
      ]);
      const docRows = docRowsRes.data;
      if (docRows) docs.push(...docRows);
      const cats = catsRes.data;
      if (cats) {
        for (const c of cats) subcategoryIds.push(c.subcategory_id as string);
      }
    }
  }

  const { data: categories } = await categoriesPromise;

  return {
    profileFullName,
    supplier,
    docs,
    subcategoryIds,
    categories: categories ?? [],
  };
}
