import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OnboardingBootstrap = {
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
    languages: string[];
    capacity: number | null;
    concurrent_event_limit: number;
    verification_status: string;
    is_published: boolean;
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
  const docs: OnboardingBootstrap["docs"] = [];
  const subcategoryIds: string[] = [];

  if (user) {
    const { data: supplierRow } = await supabase
      .from("suppliers")
      .select(
        "id, business_name, slug, legal_type, cr_number, national_id, bio, base_city, service_area_cities, languages, capacity, concurrent_event_limit, verification_status, is_published",
      )
      .eq("profile_id", user.id)
      .maybeSingle();

    if (supplierRow) {
      supplier = supplierRow;
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
    supplier,
    docs,
    subcategoryIds,
    categories: categories ?? [],
  };
}
