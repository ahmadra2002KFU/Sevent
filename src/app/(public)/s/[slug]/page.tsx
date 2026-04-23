import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ImageOff, PackageOpen, Star } from "lucide-react";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { GalleryGrid } from "@/components/public/GalleryGrid";
import { PackageCard } from "@/components/public/PackageCard";
import { SupplierProfileHero } from "@/components/public/SupplierProfileHero";
import {
  getPublicSupplierBySlug,
  type PublicSupplierProfile,
} from "@/lib/domain/supplierProfile";
import { cityNameFor } from "@/lib/domain/cities";
import type { SupportedLocale } from "@/lib/domain/formatDate";

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
  const [locale, t, tCats, brand, supplier] = await Promise.all([
    getLocale() as Promise<SupportedLocale>,
    getTranslations("public.supplier"),
    getTranslations("public.categories"),
    getTranslations("brand"),
    getPublicSupplierBySlug(slug),
  ]);

  if (!supplier) notFound();

  const firstCat = supplier.subcategories[0];
  const isAr = locale === "ar";
  const firstCatParent = firstCat
    ? isAr
      ? firstCat.parent_name_ar ?? firstCat.parent_name_en
      : firstCat.parent_name_en
    : null;
  const firstCatName = firstCat
    ? isAr
      ? firstCat.name_ar ?? firstCat.name_en
      : firstCat.name_en
    : null;
  const breadcrumbCategoryLabel =
    firstCatParent ?? firstCatName ?? tCats("title");

  const heroImageUrl = supplier.media[0]?.public_url ?? null;

  // Expose the supplier's accent color as a CSS custom property so any
  // descendant CTA / link / border can opt in via `var(--accent-supplier)`.
  const accentStyle: CSSProperties = {
    ["--accent-supplier" as string]: supplier.accent_color,
  };

  return (
    <main
      className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-8 sm:py-12"
      style={accentStyle}
    >
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
        baseCity={cityNameFor(supplier.base_city, locale)}
        serviceAreaCities={supplier.service_area_cities.map((c) =>
          cityNameFor(c, locale),
        )}
        servesAllKsa={supplier.serves_all_ksa}
        languages={supplier.languages}
        heroImageUrl={heroImageUrl}
        logoUrl={supplier.logo_url}
        subcategories={supplier.subcategories}
        locale={locale}
        verifiedLabel={t("verifiedBadge")}
        baseCityLabel={t("baseCityLabel")}
        serviceAreaLabel={t("serviceAreaLabel")}
        servesAllKsaLabel={t("servesAllKsaLabel")}
        languagesLabel={t("languagesLabel")}
      />

      {/*
        The supplier company-profile PDF has been moved off the public profile
        per the onboarding-redesign plan (decision 6). It's now gated behind
        an accepted quote and surfaced on the organizer booking detail page.
      */}

      <div className="flex flex-col gap-10">
        {supplier.profile_sections_order.map((section) => (
          <SupplierSection
            key={section}
            section={section}
            supplier={supplier}
            t={t}
          />
        ))}
      </div>
    </main>
  );
}

type SectionProps = {
  section: string;
  supplier: PublicSupplierProfile;
  // Matches next-intl's server-translator signature for the supplier namespace.
  t: Awaited<ReturnType<typeof getTranslations<"public.supplier">>>;
};

/**
 * Renders a single profile section keyed by slug. Unknown slugs render
 * nothing — the loader already filters them out, but we keep a defensive
 * fallback here so an accidental future addition doesn't crash the page.
 */
function SupplierSection({ section, supplier, t }: SectionProps) {
  switch (section) {
    case "bio":
      return <BioSection supplier={supplier} t={t} />;
    case "packages":
      return <PackagesSection supplier={supplier} t={t} />;
    case "portfolio":
      return <PortfolioSection supplier={supplier} t={t} />;
    case "reviews":
      return <ReviewsSection supplier={supplier} t={t} />;
    default:
      return null;
  }
}

// -------------------------- Section renderers -------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xl font-semibold text-brand-navy-900"
      style={{ borderInlineStartColor: "var(--accent-supplier)" }}
    >
      <span className="border-s-4 ps-3" style={{ borderColor: "var(--accent-supplier)" }}>
        {children}
      </span>
    </h2>
  );
}

function BioSection({
  supplier,
  t,
}: {
  supplier: PublicSupplierProfile;
  t: SectionProps["t"];
}) {
  // Hero already renders a short bio blurb. The standalone Bio section only
  // shows when there's meaningful copy to highlight so the page doesn't
  // duplicate content for suppliers who haven't filled out a long bio yet.
  if (!supplier.bio) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>{t("bioHeading")}</SectionHeading>
      <p className="max-w-3xl text-sm leading-relaxed text-foreground">
        {supplier.bio}
      </p>
    </section>
  );
}

function PortfolioSection({
  supplier,
  t,
}: {
  supplier: PublicSupplierProfile;
  t: SectionProps["t"];
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>{t("portfolioHeading")}</SectionHeading>
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
    </section>
  );
}

function PackagesSection({
  supplier,
  t,
}: {
  supplier: PublicSupplierProfile;
  t: SectionProps["t"];
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>{t("packagesHeading")}</SectionHeading>
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
    </section>
  );
}

function ReviewsSection({
  supplier,
  t,
}: {
  supplier: PublicSupplierProfile;
  t: SectionProps["t"];
}) {
  const hasReviews = supplier.reviewSummary.count > 0;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>{t("reviewsHeading")}</SectionHeading>
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
    </section>
  );
}
