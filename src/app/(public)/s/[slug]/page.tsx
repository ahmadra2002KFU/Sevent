import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ImageOff, PackageOpen, Star } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { GalleryGrid } from "@/components/public/GalleryGrid";
import { PackageCard } from "@/components/public/PackageCard";
import { SupplierProfileHero } from "@/components/public/SupplierProfileHero";
import { getPublicSupplierBySlug } from "@/lib/domain/supplierProfile";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const supplier = await getPublicSupplierBySlug(slug);
  if (!supplier) return { title: "Supplier not found · Sevent" };
  return {
    title: `${supplier.business_name} · Sevent`,
    description:
      supplier.bio ??
      `Verified Sevent supplier in ${supplier.base_city}. View packages and book with a digital contract.`,
  };
}

export default async function PublicSupplierProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const [t, tCats, brand, supplier] = await Promise.all([
    getTranslations("public.supplier"),
    getTranslations("public.categories"),
    getTranslations("brand"),
    getPublicSupplierBySlug(slug),
  ]);

  if (!supplier) notFound();

  const hasReviews = supplier.reviewSummary.count > 0;
  // Primary parent category name (first subcategory with a parent label) for
  // the breadcrumb middle segment. Falls back to the subcategory name when
  // no parent label is set.
  const firstCat = supplier.subcategories[0];
  const breadcrumbCategoryLabel =
    firstCat?.parent_name_en ?? firstCat?.name_en ?? tCats("title");

  const heroImageUrl = supplier.media[0]?.public_url ?? null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-8 sm:py-12">
      <Breadcrumb
        items={[
          { label: brand("name"), href: "/" },
          { label: breadcrumbCategoryLabel, href: "/categories" },
          { label: supplier.business_name },
        ]}
      />

      <SupplierProfileHero
        businessName={supplier.business_name}
        bio={supplier.bio}
        baseCity={supplier.base_city}
        serviceAreaCities={supplier.service_area_cities}
        languages={supplier.languages}
        heroImageUrl={heroImageUrl}
        subcategories={supplier.subcategories}
        verifiedLabel={t("verifiedBadge")}
        baseCityLabel={t("baseCityLabel")}
        serviceAreaLabel={t("serviceAreaLabel")}
        languagesLabel={t("languagesLabel")}
      />

      <Tabs defaultValue="portfolio" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="portfolio">{t("portfolioHeading")}</TabsTrigger>
          <TabsTrigger value="packages">{t("packagesHeading")}</TabsTrigger>
          <TabsTrigger value="reviews">{t("reviewsHeading")}</TabsTrigger>
        </TabsList>

        {/* --------------------- Portfolio --------------------- */}
        <TabsContent value="portfolio" className="mt-6">
          {supplier.media.length === 0 ? (
            <EmptyState
              icon={ImageOff}
              title={t("noPortfolio")}
              description={t("noPortfolioDescription")}
            />
          ) : (
            <GalleryGrid
              items={supplier.media.map((m) => ({
                id: m.id,
                public_url: m.public_url,
                title: m.title,
              }))}
              businessName={supplier.business_name}
              dialogTitle={t("portfolioDialogTitle", {
                name: supplier.business_name,
              })}
            />
          )}
        </TabsContent>

        {/* --------------------- Packages --------------------- */}
        <TabsContent value="packages" className="mt-6">
          {supplier.packages.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title={t("noPackages")}
              description={t("noPackagesDescription")}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {supplier.packages.map((p) => (
                <PackageCard
                  key={p.id}
                  name={p.name}
                  description={p.description}
                  basePriceHalalas={p.base_price_halalas}
                  fromPriceVisible={p.from_price_visible}
                  unitLabel={t(`packageUnit.${p.unit}`)}
                  qtyRangeLabel={t("qtyRange", {
                    min: p.min_qty,
                    max: p.max_qty ?? "∞",
                  })}
                  fromLabel={t("fromLabel")}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* --------------------- Reviews ---------------------- */}
        <TabsContent value="reviews" className="mt-6">
          {hasReviews ? (
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-6">
              <div className="flex size-14 items-center justify-center rounded-full bg-accent-gold-100 text-accent-gold-500">
                <Star className="size-6 fill-current" aria-hidden />
              </div>
              <div>
                <p className="text-2xl font-bold text-brand-navy-900">
                  {supplier.reviewSummary.average_overall?.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" / 5"}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("reviewsCount", { count: supplier.reviewSummary.count })}
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Star}
              title={t("noReviewsTitle")}
              description={t("noReviews")}
            />
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
