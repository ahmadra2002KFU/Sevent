import { getLocale, getTranslations } from "next-intl/server";
import { PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { CategoryTile } from "@/components/public/CategoryTile";
import { getCategoryIcon } from "@/components/public/categoryIcons";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { listTopLevelCategories } from "@/lib/domain/publicBrowse";
import { categoryName } from "@/lib/domain/taxonomy";
import type { SupportedLocale } from "@/lib/domain/formatDate";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "Browse categories · Sevent",
    description:
      "Every verified Sevent supplier category. Pick a category to discover venues, catering, photography and more across Saudi Arabia.",
  };
}

export default async function CategoriesPage() {
  const [locale, t, tLanding, brand, categories] = await Promise.all([
    getLocale() as Promise<SupportedLocale>,
    getTranslations("public.categories"),
    getTranslations("landing"),
    getTranslations("brand"),
    listTopLevelCategories(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 sm:py-14">
      <Breadcrumb
        items={[
          { label: brand("name"), href: "/" },
          { label: t("title") },
        ]}
      />

      <PageHeader title={t("title")} description={t("subtitle")} />

      {categories.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={t("empty")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <CategoryTile
              key={c.id}
              href={`/categories/${c.slug}`}
              name={categoryName(c, locale) || c.name_en}
              supplierCount={c.supplier_count}
              supplierCountLabel={tLanding("categories.supplierCount", {
                count: c.supplier_count,
              })}
              icon={getCategoryIcon(c.slug)}
              viewLabel={t("viewSubcategory")}
            />
          ))}
        </div>
      )}
    </main>
  );
}
