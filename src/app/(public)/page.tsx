import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  FileText,
  Handshake,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HeroSection } from "@/components/public/HeroSection";
import { CategoryTile } from "@/components/public/CategoryTile";
import { listTopLevelCategories } from "@/lib/domain/publicBrowse";
import { getCategoryIcon } from "@/components/public/categoryIcons";

export const dynamic = "force-dynamic";

type ValuePropItem = { title: string; body: string };

/**
 * Sevent landing page. Chrome (nav, footer) is provided by `(public)/layout`.
 *
 * Section sequence:
 *   1. HeroSection — navy band, cobalt CTA, gold accent dot, proof card
 *   2. Pillars — 3-up value proposition with icon chips
 *   3. Featured categories — top 6 discoverable categories with live counts
 *   4. Pilot banner — cobalt band, call to join the Riyadh + Jeddah launch
 *
 * No gradients anywhere — depth is achieved via layered navy surfaces, offset
 * cobalt echo cards, and warm neutral-100 bands between sections.
 */
export default async function LandingPage() {
  const [t, brand, landing, categories] = await Promise.all([
    getTranslations("landing"),
    getTranslations("brand"),
    getTranslations("landing"),
    listTopLevelCategories(),
  ]);

  const pillarItems = (landing.raw("valueProp.items") as ValuePropItem[]).map(
    (item, idx) => ({ ...item, key: idx }),
  );
  const pillarIcons = [Handshake, Star, ShieldCheck] as const;

  const featured = categories.slice(0, 6);

  const heroCategories = featured
    .slice(0, 4)
    .map((c) => c.name_en);

  return (
    <main className="flex flex-col">
      <HeroSection
        eyebrow={t("hero.eyebrow")}
        title={t("hero.title")}
        subtitle={t("hero.subtitle")}
        ctaOrganizer={t("hero.ctaOrganizer")}
        ctaSupplier={t("hero.ctaSupplier")}
        statLabel={t("hero.statLabel")}
        statValue={t("hero.statValue")}
        categories={heroCategories.length > 0 ? heroCategories : [
          t("hero.sampleCategoriesFallback"),
        ]}
      />

      {/* ============================== Pillars ============================= */}
      <section
        aria-labelledby="pillars-heading"
        className="mx-auto w-full max-w-6xl px-6 py-20"
      >
        <div className="flex max-w-2xl flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-cobalt-500">
            {t("valueProp.eyebrow")}
          </span>
          <h2
            id="pillars-heading"
            className="text-3xl font-bold tracking-tight text-brand-navy-900 sm:text-4xl"
          >
            {t("valueProp.heading")}
          </h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {pillarItems.map((item, idx) => {
            const Icon = pillarIcons[idx] ?? FileText;
            return (
              <Card
                key={item.key}
                className="border-border bg-card transition-colors hover:border-brand-cobalt-500/30"
              >
                <CardContent className="flex flex-col gap-4 p-7">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-brand-cobalt-100 text-brand-cobalt-500">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-brand-navy-900">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ============================== Featured categories ================= */}
      {featured.length > 0 ? (
        <section
          aria-labelledby="featured-heading"
          className="border-y border-border bg-neutral-100"
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
              <div className="flex max-w-2xl flex-col gap-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-brand-cobalt-500">
                  {t("categories.eyebrow")}
                </span>
                <h2
                  id="featured-heading"
                  className="text-3xl font-bold tracking-tight text-brand-navy-900 sm:text-4xl"
                >
                  {t("categories.heading")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("categories.subtitle")}
                </p>
              </div>
              <Button asChild variant="outline" size="lg">
                <Link href="/categories">
                  {t("categories.browseAll")}
                  <ArrowRight
                    className="size-4 rtl:-scale-x-100"
                    aria-hidden
                  />
                </Link>
              </Button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((c) => {
                const Icon = getCategoryIcon(c.slug);
                return (
                  <CategoryTile
                    key={c.id}
                    href={`/categories/${c.slug}`}
                    name={c.name_en}
                    supplierCount={c.supplier_count}
                    supplierCountLabel={t("categories.supplierCount", {
                      count: c.supplier_count,
                    })}
                    icon={Icon}
                    viewLabel={t("categories.viewLabel")}
                  />
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* ============================== Pilot banner ======================== */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="relative overflow-hidden rounded-2xl bg-brand-navy-900 p-10 text-white sm:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -end-32 -top-16 size-96 skew-x-12 bg-brand-cobalt-500/20"
          />
          <div className="relative grid gap-6 sm:grid-cols-[1.4fr_auto] sm:items-center">
            <div className="flex flex-col gap-3">
              <span className="inline-flex items-center gap-2 self-start rounded-full bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-accent-gold-500 ring-1 ring-inset ring-white/10">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-accent-gold-500"
                />
                {t("pilot.eyebrow")}
              </span>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t("pilot.title")}
              </h2>
              <p className="max-w-xl text-base text-white/75">
                {t("pilot.subtitle")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-brand-cobalt-500 text-white hover:bg-brand-cobalt-400"
              >
                <Link href="/sign-up?role=supplier">{t("pilot.ctaSupplier")}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/categories">{t("pilot.ctaBrowse")}</Link>
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {brand("name")} · {t("comingSoon")}
        </p>
      </section>
    </main>
  );
}
