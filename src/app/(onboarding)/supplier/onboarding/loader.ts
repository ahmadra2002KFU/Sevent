import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

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

export async function loadOnboardingBootstrap(): Promise<OnboardingBootstrap> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let supplier: OnboardingBootstrap["supplier"] = null;
  let profileFullName: string | null = null;
  const docs: OnboardingBootstrap["docs"] = [];
  const subcategoryIds: string[] = [];

  if (user) {
    // Profile full_name fetched via service-role — @supabase/ssr + publishable
    // key pattern documented in src/lib/supabase/server.ts returns empty rows
    // for user-scoped SELECTs. Ownership is re-enforced by `.eq("id", user.id)`.
    const admin = createSupabaseServiceRoleClient();
    const { data: profileRow } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    profileFullName = (profileRow?.full_name as string | null) ?? null;

    const { data: supplierRow } = await supabase
      .from("suppliers")
      .select(
        "id, business_name, slug, legal_type, cr_number, national_id, bio, base_city, service_area_cities, serves_all_ksa, languages, capacity, concurrent_event_limit, verification_status, is_published, logo_path, works_with_segments",
      )
      .eq("profile_id", user.id)
      .maybeSingle();

    if (supplierRow) {
      supplier = {
        ...supplierRow,
        works_with_segments: (supplierRow.works_with_segments ?? []) as string[],
        logo_path: (supplierRow.logo_path ?? null) as string | null,
        serves_all_ksa: Boolean(
          (supplierRow as { serves_all_ksa?: boolean }).serves_all_ksa,
        ),
      } as OnboardingBootstrap["supplier"];
      const { data: docRows } = await supabase
        .from("supplier_docs")
        .select("id, doc_type, file_path, status, notes, created_at")
        .eq("supplier_id", supplierRow.id)
        .order("created_at", { ascending: false });
      if (docRows) docs.push(...docRows);
      const { data: cats } = await supabase
        .from("supplier_categories")
        .select("subcategory_id")
        .eq("supplier_id", supplierRow.id);
      if (cats) {
        for (const c of cats) subcategoryIds.push(c.subcategory_id as string);
      }
    }
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug, name_en, name_ar, parent_id")
    .order("sort_order", { ascending: true });

  return {
    profileFullName,
    supplier,
    docs,
    subcategoryIds,
    categories: categories ?? [],
  };
}
