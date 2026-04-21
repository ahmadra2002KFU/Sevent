import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { CityFilter } from "@/components/public/CityFilter";
import { SupplierCard } from "@/components/public/SupplierCard";
import { CITY_OPTIONS } from "@/lib/domain/events";
import {
  getParentCategoryBySlug,
  listSubcategoriesWithSuppliers,
} from "@/lib/domain/publicBrowse";

type PageProps = {
  params: Promise<{ parent: string }>;
  searchParams: Promise<{ city?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { parent: parentSlug } = await params;
  const parent = await getParentCategoryBySlug(parentSlug);
  if (!parent) return { title: "Category not found · Sevent" };
  return {
    title: `${parent.name_en} · Sevent`,
    description: `Browse verified ${parent.name_en} suppliers in Saudi Arabia.`,
  };
}

function normalizeCity(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = CITY_OPTIONS.find((c) => c === raw);
  return match ?? null;
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ parent: parentSlug }, rawSearch] = await Promise.all([
    params,
    searchParams,
  ]);

  const parent = await getParentCategoryBySlug(parentSlug);
  if (!parent) notFound();

  const city = normalizeCity(rawSearch.city);

  const [tCats, tSearch, tSupplier, brand, subcategories] = await Promise.all([
    getTranslations("public.categories"),
    getTranslations("public.search"),
    getTranslations("public.supplier"),
    getTranslations("brand"),
    listSubcategoriesWithSuppliers(parent.id, city),
  ]);

  const totalSuppliers = subcategories.reduce(
    (acc, s) => acc + s.suppliers.length,
    0,
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 sm:py-14">
      <Breadcrumb
        items={[
          { label: brand("name"), href: "/" },
          { label: tCats("title"), href: "/categories" },
          { label: parent.name_en },
        ]}
      />

      <PageHeader
        title={parent.name_en}
        description={tSearch("resultsSummary", {
          count: totalSuppliers,
          city: city ?? tSearch("allCities"),
        })}
        actions={
          <CityFilter
            cities={CITY_OPTIONS}
            currentCity={city}
            label={tSearch("cityFilterLabel")}
            allCitiesLabel={tSearch("allCities")}
          />
        }
      />

      {subcategories.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={tCats("empty")}
          description={tSearch("noResults")}
        />
      ) : (
        <div className="flex flex-col gap-14">
          {subcategories.map((sub) => (
            <section key={sub.id} className="flex flex-col gap-6">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-xl font-bold tracking-tight text-brand-navy-900">
                  {tSearch("subcategoryHeading", { name: sub.name_en })}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {tSearch("supplierCount", { count: sub.suppliers.length })}
                </span>
              </div>

              {sub.suppliers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  {tSearch("noResults")}
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {sub.suppliers.map((sup) => (
                    <SupplierCard
                      key={sup.id}
                      href={`/s/${sup.slug}`}
                      businessName={sup.business_name}
                      baseCity={sup.base_city}
                      firstPhotoUrl={sup.first_photo_url}
                      verifiedLabel={tSupplier("verifiedBadge")}
                      viewLabel={tSearch("viewProfile")}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
