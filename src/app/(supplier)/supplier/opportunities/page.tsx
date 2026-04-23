import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { requireAccess } from "@/lib/auth/access";
import { fmtDateTime, type SupportedLocale } from "@/lib/domain/formatDate";
import { cityNameFor, cityOptions } from "@/lib/domain/cities";
import { categoryName } from "@/lib/domain/taxonomy";
import { formatHalalas } from "@/lib/domain/money";
import { segmentNameFor, MARKET_SEGMENT_SLUGS } from "@/lib/domain/segments";
import {
  listMarketplaceOpportunities,
  type MarketplaceFilters,
  type MarketplaceOpportunity,
} from "@/lib/domain/marketplace";
import type { EventType } from "@/lib/supabase/types";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readFilter(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const v = params[key];
  if (typeof v === "string" && v.length > 0) return v;
  if (Array.isArray(v) && v[0] && typeof v[0] === "string") return v[0];
  return null;
}

function parseHalalas(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default async function OpportunitiesPage({ searchParams }: PageProps) {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("supplier.opportunities");
  const tPublic = await getTranslations("public.supplier");

  const { decision } = await requireAccess("supplier.opportunities.browse");
  const supplierId = decision.supplierId;
  if (!supplierId) {
    // Shouldn't happen — `supplier.opportunities.browse` is only granted to
    // `supplier.approved`, which requires a supplier row. Fall-through renders
    // an empty state rather than crashing.
    return (
      <section className="flex flex-col gap-6">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <EmptyState
          icon={Search}
          title={t("empty.title")}
          description={t("empty.subtitle")}
        />
      </section>
    );
  }

  const sp = await searchParams;
  const filters: MarketplaceFilters = {
    category_id: readFilter(sp, "category"),
    subcategory_id: readFilter(sp, "subcategory"),
    city: readFilter(sp, "city"),
    segment: readFilter(sp, "segment") as EventType | null,
    startsFrom: readFilter(sp, "from"),
    startsTo: readFilter(sp, "to"),
    budgetMinHalalas: parseHalalas(readFilter(sp, "min")),
    budgetMaxHalalas: parseHalalas(readFilter(sp, "max")),
  };

  const opportunities = await listMarketplaceOpportunities({
    supplier_id: supplierId,
    filters,
  });

  const cities = cityOptions(locale === "ar" ? "ar" : "en");

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* Filters — URL-driven form. GET submission keeps the filters shareable
          and lets the page stay a server component. */}
      <form
        method="get"
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t("filters.city")}
          <select
            name="city"
            defaultValue={filters.city ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            <option value="">{t("filters.anyCity")}</option>
            {cities.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t("filters.segment")}
          <select
            name="segment"
            defaultValue={filters.segment ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            <option value="">{t("filters.anySegment")}</option>
            {MARKET_SEGMENT_SLUGS.map((s) => (
              <option key={s} value={s}>
                {segmentNameFor(s, locale)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t("filters.startsFrom")}
          <input
            type="date"
            name="from"
            defaultValue={filters.startsFrom ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t("filters.startsTo")}
          <input
            type="date"
            name="to"
            defaultValue={filters.startsTo ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t("filters.budgetMin")}
          <input
            type="number"
            name="min"
            inputMode="numeric"
            min={0}
            placeholder="0"
            defaultValue={
              filters.budgetMinHalalas !== null &&
              filters.budgetMinHalalas !== undefined
                ? String(filters.budgetMinHalalas)
                : ""
            }
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t("filters.budgetMax")}
          <input
            type="number"
            name="max"
            inputMode="numeric"
            min={0}
            placeholder="0"
            defaultValue={
              filters.budgetMaxHalalas !== null &&
              filters.budgetMaxHalalas !== undefined
                ? String(filters.budgetMaxHalalas)
                : ""
            }
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          />
        </label>

        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit" size="sm">
            {t("filters.apply")}
          </Button>
          <Button type="reset" size="sm" variant="ghost" asChild>
            <Link href="/supplier/opportunities">{t("filters.clear")}</Link>
          </Button>
        </div>
      </form>

      {opportunities.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t("empty.title")}
          description={t("empty.subtitle")}
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label={t("title")}>
          {opportunities.map((op) => (
            <li key={op.rfq_id}>
              <OpportunityCard
                op={op}
                locale={locale}
                servesAllKsaLabel={tPublic("servesAllKsaLabel")}
                tLabels={{
                  applyCta: t("applyCta"),
                  guestsLabel: t("guestsLabel"),
                  budgetLabel: t("budgetLabel"),
                  budgetNotDisclosed: t("budgetNotDisclosed"),
                  postedLabel: t("postedLabel"),
                  dueLabel: t("dueLabel"),
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type OpportunityCardProps = {
  op: MarketplaceOpportunity;
  locale: SupportedLocale;
  servesAllKsaLabel: string;
  tLabels: {
    applyCta: string;
    guestsLabel: string;
    budgetLabel: string;
    budgetNotDisclosed: string;
    postedLabel: string;
    dueLabel: string;
  };
};

function OpportunityCard({ op, locale, tLabels }: OpportunityCardProps) {
  const categoryLabel = categoryName(op.category, locale);
  const subLabel = categoryName(op.subcategory, locale);
  const budget = formatBudget(op.event.budget_min_halalas, op.event.budget_max_halalas);
  const cityLabel = cityNameFor(op.event.city, locale);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {categoryLabel ? (
              <Badge variant="secondary">{categoryLabel}</Badge>
            ) : null}
            {subLabel ? (
              <span className="text-xs text-muted-foreground">{subLabel}</span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              · {segmentNameFor(op.event.event_type, locale)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />
              <span className="font-medium text-foreground">{cityLabel}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden />
              <span className="text-foreground">
                {fmtDateTime(op.event.starts_at, locale)}
              </span>
            </span>
            {op.event.guest_count ? (
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" aria-hidden />
                {tLabels.guestsLabel}:{" "}
                <span className="font-medium text-foreground">
                  {op.event.guest_count}
                </span>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="size-4" aria-hidden />
              {tLabels.budgetLabel}:{" "}
              <span className="font-medium text-foreground">
                {budget ?? tLabels.budgetNotDisclosed}
              </span>
            </span>
          </div>
          {op.expires_at ? (
            <p className="text-xs text-muted-foreground">
              {tLabels.dueLabel}: {fmtDateTime(op.expires_at, locale)}
            </p>
          ) : null}
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link href={`/supplier/opportunities/${op.rfq_id}`}>
            {tLabels.applyCta}
            <ArrowRight className="rtl:rotate-180" aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function formatBudget(
  min: number | null,
  max: number | null,
): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    return `${formatHalalas(min)} – ${formatHalalas(max)}`;
  }
  if (min !== null) return `≥ ${formatHalalas(min)}`;
  if (max !== null) return `≤ ${formatHalalas(max)}`;
  return null;
}
