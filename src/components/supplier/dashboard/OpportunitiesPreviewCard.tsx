import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { fmtDateTime, type SupportedLocale } from "@/lib/domain/formatDate";
import { cityNameFor } from "@/lib/domain/cities";
import { categoryName } from "@/lib/domain/taxonomy";
import { formatHalalas } from "@/lib/domain/money";
import {
  listMarketplaceOpportunities,
  type MarketplaceOpportunity,
} from "@/lib/domain/marketplace";

const PREVIEW_LIMIT = 4;

export async function OpportunitiesPreviewCard({
  supplierId,
  locale,
}: {
  supplierId: string;
  locale: SupportedLocale;
}) {
  const t = await getTranslations("supplier.opportunities");
  const opportunities = await listMarketplaceOpportunities({
    supplier_id: supplierId,
    filters: {
      category_id: null,
      subcategory_id: null,
      city: null,
      segment: null,
      startsFrom: null,
      startsTo: null,
      budgetMinHalalas: null,
      budgetMaxHalalas: null,
    },
  });

  const top = opportunities.slice(0, PREVIEW_LIMIT);

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/supplier/opportunities">
              {t("backToList")}
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {top.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={t("empty.title")}
            description={t("empty.subtitle")}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {top.map((op) => (
              <li key={op.rfq_id}>
                <Link
                  href={`/supplier/opportunities/${op.rfq_id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/60"
                >
                  <PreviewRow op={op} locale={locale} />
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-cobalt-500">
                    {t("applyCta")}
                    <ArrowUpRight className="size-3.5 rtl:rotate-180" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewRow({
  op,
  locale,
}: {
  op: MarketplaceOpportunity;
  locale: SupportedLocale;
}) {
  const categoryLabel = categoryName(op.category, locale);
  const subLabel = categoryName(op.subcategory, locale);
  const cityLabel = cityNameFor(op.event.city, locale);
  const budget = formatBudget(
    op.event.budget_min_halalas,
    op.event.budget_max_halalas,
  );

  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        {categoryLabel ? (
          <Badge variant="secondary">{categoryLabel}</Badge>
        ) : null}
        {subLabel ? (
          <span className="text-xs text-muted-foreground">{subLabel}</span>
        ) : null}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" aria-hidden />
          <span className="font-medium text-foreground">{cityLabel}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3.5" aria-hidden />
          <span className="text-foreground">
            {fmtDateTime(op.event.starts_at, locale)}
          </span>
        </span>
        {budget ? (
          <span className="inline-flex items-center gap-1">
            <Wallet className="size-3.5" aria-hidden />
            <span className="font-medium text-foreground">{budget}</span>
          </span>
        ) : null}
      </p>
    </div>
  );
}

function formatBudget(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    return `${formatHalalas(min)} – ${formatHalalas(max)}`;
  }
  if (min !== null) return `≥ ${formatHalalas(min)}`;
  if (max !== null) return `≤ ${formatHalalas(max)}`;
  return null;
}
