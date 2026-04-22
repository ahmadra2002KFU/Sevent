import { getLocale, getTranslations } from "next-intl/server";
import { Building2, Utensils } from "lucide-react";
import { listTopLevelCategories } from "@/lib/domain/publicBrowse";
import { getCategoryIcon } from "@/components/public/categoryIcons";
import { LandingHero } from "@/components/public/landing/LandingHero";
import type { HeroCategoryChip } from "@/components/public/landing/LandingHero";
import { TrustStrip } from "@/components/public/landing/TrustStrip";
import { PillarsSection } from "@/components/public/landing/PillarsSection";
import type { PillarItem } from "@/components/public/landing/PillarsSection";
import { HowItWorks } from "@/components/public/landing/HowItWorks";
import type { HowItWorksStep } from "@/components/public/landing/HowItWorks";
import { RfqShowcase } from "@/components/public/landing/RfqShowcase";
import type { ShowcaseBullet } from "@/components/public/landing/RfqShowcase";
import { CategoryGrid } from "@/components/public/landing/CategoryGrid";
import type { CategoryGridItem } from "@/components/public/landing/CategoryGrid";
import { SupplierShowcase } from "@/components/public/landing/SupplierShowcase";
import { TestimonialRail } from "@/components/public/landing/TestimonialRail";
import type { Testimonial } from "@/components/public/landing/TestimonialRail";
import { FaqSection } from "@/components/public/landing/FaqSection";
import type { FaqItem } from "@/components/public/landing/FaqSection";
import { PilotBand } from "@/components/public/landing/PilotBand";

export const dynamic = "force-dynamic";

type FallbackCategory = {
  slug: string;
  name: string;
  count: number;
};

/**
 * Public landing page. Server-rendered top to bottom; the FAQ accordion is
 * the single client island.
 *
 * Section flow (aligned with the approved design bundle):
 *   1. Hero — navy band + proof card with meta stats
 *   2. Trust strip — four Saudi compliance marks
 *   3. Pillars — three value-prop cards
 *   4. How it works — four numbered steps
 *   5. RFQ showcase — mock comparison panel + bullets
 *   6. Categories — 8-tile grid fed by live data, falls back to design copy
 *   7. Supplier showcase — dashboard mock + bullets
 *   8. Testimonials — three quote cards
 *   9. FAQ — six-item accordion
 *  10. Pilot band — navy closing CTA
 */
export default async function LandingPage() {
  const [t, categories, locale] = await Promise.all([
    getTranslations("landing"),
    listTopLevelCategories(),
    getLocale(),
  ]);
  const isAr = locale === "ar";

  const categoriesSuffix = t("categories.suffix");

  // Pull the 8 category tiles: prefer live counts, but fall back to the
  // design's static list when the DB hasn't been seeded yet (pre-launch /
  // preview envs). Either path renders identical shape to the grid.
  const fallbackCategories = t.raw(
    "categories.fallback",
  ) as FallbackCategory[];

  const categoryItems: CategoryGridItem[] =
    categories.length > 0
      ? categories.slice(0, 8).map((c) => ({
          slug: c.slug,
          name: isAr && c.name_ar ? c.name_ar : c.name_en,
          countLabel: t("categories.supplierCount", {
            count: c.supplier_count,
          }),
          icon: getCategoryIcon(c.slug),
          href: `/categories/${c.slug}`,
        }))
      : fallbackCategories.map((c) => ({
          slug: c.slug,
          name: c.name,
          countLabel: `${c.count} ${categoriesSuffix}`,
          icon: getCategoryIcon(c.slug),
          href: `/categories/${c.slug}`,
        }));

  // Hero chips: first 6 categories as icon chips inside the proof card.
  const heroChips: HeroCategoryChip[] = categoryItems.slice(0, 6).map((c) => ({
    key: c.slug,
    label: c.name,
    icon: c.icon,
  }));

  // Safety net — the hero proof card looks empty without chips.
  if (heroChips.length === 0) {
    heroChips.push(
      { key: "venues", label: "Venues", icon: Building2 },
      { key: "catering", label: "Catering", icon: Utensils },
    );
  }

  const pillarItems = t.raw("valueProp.items") as PillarItem[];
  const howSteps = t.raw("how.steps") as HowItWorksStep[];
  const showcaseBullets = t.raw("showcase.bullets") as ShowcaseBullet[];
  const supplierBullets = t.raw(
    "supplierShowcase.bullets",
  ) as ShowcaseBullet[];
  const testimonials = t.raw("testimonials.items") as Testimonial[];
  const faqItems = t.raw("faq.items") as FaqItem[];

  return (
    <main className="flex flex-col">
      <LandingHero
        eyebrow={t("hero.eyebrow")}
        title={t("hero.title")}
        subtitle={t("hero.subtitle")}
        ctaOrganizer={t("hero.ctaOrganizer")}
        ctaSupplier={t("hero.ctaSupplier")}
        statLabel={t("hero.statLabel")}
        statValue={t("hero.statValue")}
        chips={heroChips}
        stats={[
          { value: t("hero.meta1Value"), label: t("hero.meta1Label") },
          { value: t("hero.meta2Value"), label: t("hero.meta2Label") },
          { value: t("hero.meta3Value"), label: t("hero.meta3Label") },
        ]}
      />

      <TrustStrip
        label={t("trust.label")}
        marks={{
          gea: t("trust.gea"),
          mada: t("trust.mada"),
          zatca: t("trust.zatca"),
          sama: t("trust.sama"),
        }}
      />

      <PillarsSection
        id="pillars-heading"
        eyebrow={t("valueProp.eyebrow")}
        heading={t("valueProp.heading")}
        lede={t("valueProp.lede")}
        items={pillarItems}
      />

      <HowItWorks
        id="how-heading"
        eyebrow={t("how.eyebrow")}
        heading={t("how.heading")}
        lede={t("how.lede")}
        steps={howSteps}
      />

      <RfqShowcase
        eyebrow={t("showcase.eyebrow")}
        heading={t("showcase.heading")}
        lede={t("showcase.lede")}
        cta={t("showcase.cta")}
        bullets={showcaseBullets}
        mock={{
          rfqTitle: t("showcase.mock.rfqTitle"),
          rfqSub: t("showcase.mock.rfqSub"),
          rfqStatus: t("showcase.mock.rfqStatus"),
          quotesLeft: t("showcase.mock.quotesLeft"),
          compareAll: t("showcase.mock.compareAll"),
          rows: [
            {
              initial: "R",
              initialBg: "cobalt",
              name: t("showcase.mock.q1Name"),
              meta: t("showcase.mock.q1Meta"),
              price: t("showcase.mock.q1Price"),
              unit: t("showcase.mock.q1Unit"),
              verified: t("showcase.mock.verified"),
              best: { label: t("showcase.mock.bestTag") },
            },
            {
              initial: "N",
              initialBg: "gold",
              name: t("showcase.mock.q2Name"),
              meta: t("showcase.mock.q2Meta"),
              price: t("showcase.mock.q2Price"),
              unit: t("showcase.mock.q2Unit"),
              verified: t("showcase.mock.verified"),
            },
            {
              initial: "B",
              initialBg: "success",
              name: t("showcase.mock.q3Name"),
              meta: t("showcase.mock.q3Meta"),
              price: t("showcase.mock.q3Price"),
              unit: t("showcase.mock.q3Unit"),
              verified: t("showcase.mock.verified"),
            },
          ],
        }}
      />

      <CategoryGrid
        id="categories-heading"
        eyebrow={t("categories.eyebrow")}
        heading={t("categories.heading")}
        lede={t("categories.subtitle")}
        browseAll={t("categories.browseAll")}
        items={categoryItems}
      />

      <SupplierShowcase
        id="supplier-showcase-heading"
        eyebrow={t("supplierShowcase.eyebrow")}
        heading={t("supplierShowcase.heading")}
        lede={t("supplierShowcase.lede")}
        cta1={t("supplierShowcase.cta1")}
        cta2={t("supplierShowcase.cta2")}
        bullets={supplierBullets}
        dashboard={{
          path: t("supplierShowcase.dashboard.path"),
          greet: t("supplierShowcase.dashboard.greet"),
          sub: t("supplierShowcase.dashboard.sub"),
          approved: t("supplierShowcase.dashboard.approved"),
          k1Label: t("supplierShowcase.dashboard.k1Label"),
          k1Value: t("supplierShowcase.dashboard.k1Value"),
          k1Trend: t("supplierShowcase.dashboard.k1Trend"),
          k2Label: t("supplierShowcase.dashboard.k2Label"),
          k2Value: t("supplierShowcase.dashboard.k2Value"),
          k2Trend: t("supplierShowcase.dashboard.k2Trend"),
          k3Label: t("supplierShowcase.dashboard.k3Label"),
          k3Value: t("supplierShowcase.dashboard.k3Value"),
          invitesHeading: t("supplierShowcase.dashboard.invites"),
          invites: [
            {
              event: t("supplierShowcase.dashboard.i1Event"),
              sub: t("supplierShowcase.dashboard.i1Sub"),
              due: t("supplierShowcase.dashboard.i1Due"),
              cta: t("supplierShowcase.dashboard.quoteCta"),
              ctaStyle: "primary",
              open: true,
            },
            {
              event: t("supplierShowcase.dashboard.i2Event"),
              sub: t("supplierShowcase.dashboard.i2Sub"),
              due: t("supplierShowcase.dashboard.i2Due"),
              cta: t("supplierShowcase.dashboard.quoteCta"),
              ctaStyle: "primary",
              open: true,
            },
            {
              event: t("supplierShowcase.dashboard.i3Event"),
              sub: t("supplierShowcase.dashboard.i3Sub"),
              due: t("supplierShowcase.dashboard.i3Due"),
              cta: t("supplierShowcase.dashboard.viewCta"),
              ctaStyle: "ghost",
            },
          ],
        }}
      />

      <TestimonialRail
        id="testimonials-heading"
        eyebrow={t("testimonials.eyebrow")}
        heading={t("testimonials.heading")}
        items={testimonials}
      />

      <FaqSection
        id="faq-heading"
        eyebrow={t("faq.eyebrow")}
        heading={t("faq.heading")}
        lede={t("faq.lede")}
        contact={t("faq.contact")}
        items={faqItems}
      />

      <PilotBand
        eyebrow={t("pilot.eyebrow")}
        title={t("pilot.title")}
        subtitle={t("pilot.subtitle")}
        ctaSupplier={t("pilot.ctaSupplier")}
        ctaBrowse={t("pilot.ctaBrowse")}
      />
    </main>
  );
}
