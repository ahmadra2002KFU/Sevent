import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  CalendarDays,
  ClockAlert,
  Hash,
  MapPin,
  Users,
  Wallet,
} from "lucide-react";
import { requireAccess } from "@/lib/auth/access";
import { fmtDateTime, type SupportedLocale } from "@/lib/domain/formatDate";
import { cityNameFor } from "@/lib/domain/cities";
import { categoryName } from "@/lib/domain/taxonomy";
import { formatHalalas } from "@/lib/domain/money";
import { segmentNameFor } from "@/lib/domain/segments";
import {
  getExistingInviteForMarketplaceOpportunity,
  getMarketplaceOpportunity,
} from "@/lib/domain/marketplace";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { applyToOpportunity } from "./apply";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function OpportunityDetailPage({ params }: PageProps) {
  const { id } = await params;
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("supplier.opportunities");

  const { decision } = await requireAccess("supplier.opportunities.browse");
  const supplierId = decision.supplierId;
  if (!supplierId) notFound();

  const opportunity = await getMarketplaceOpportunity({
    rfq_id: id,
    supplier_id: supplierId,
  });
  if (!opportunity) {
    const existingInvite = await getExistingInviteForMarketplaceOpportunity({
      rfq_id: id,
      supplier_id: supplierId,
    });
    if (existingInvite) redirect(`/supplier/rfqs/${existingInvite.id}/quote`);
    notFound();
  }

  const categoryLabel = categoryName(opportunity.category, locale);
  const subLabel = categoryName(opportunity.subcategory, locale);
  const budget = formatBudget(
    opportunity.event.budget_min_halalas,
    opportunity.event.budget_max_halalas,
  );
  const qty = readQty(opportunity.requirements_jsonb);

  return (
    <section className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/supplier/opportunities">
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t("backToList")}
        </Link>
      </Button>

      <PageHeader
        title={categoryLabel || t("detail.fallbackTitle")}
        description={
          [subLabel, segmentNameFor(opportunity.event.event_type, locale)]
            .filter(Boolean)
            .join(" · ")
        }
      />

      {opportunity.expires_at ? (
        <Alert>
          <ClockAlert aria-hidden />
          <AlertDescription>
            {t("detail.dueAt", {
              date: fmtDateTime(opportunity.expires_at, locale),
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoTile
          icon={MapPin}
          label={t("detail.cityLabel")}
          value={cityNameFor(opportunity.event.city, locale)}
        />
        <InfoTile
          icon={CalendarDays}
          label={t("detail.startsAtLabel")}
          value={`${fmtDateTime(opportunity.event.starts_at, locale)} → ${fmtDateTime(opportunity.event.ends_at, locale)}`}
        />
        <InfoTile
          icon={Users}
          label={t("detail.guestsLabel")}
          value={
            opportunity.event.guest_count
              ? String(opportunity.event.guest_count)
              : t("detail.notDisclosed")
          }
        />
        <InfoTile
          icon={Wallet}
          label={t("detail.budgetLabel")}
          value={budget ?? t("detail.notDisclosed")}
        />
        {qty > 1 ? (
          <InfoTile
            icon={Hash}
            label={t("detail.qtyLabel")}
            value={String(qty)}
          />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("detail.requirements")}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <RequirementsBlock
            requirements={opportunity.requirements_jsonb}
            emDash={t("detail.noRequirements")}
          />
        </CardContent>
      </Card>

      <form
        action={async () => {
          "use server";
          await applyToOpportunity(opportunity.rfq_id);
        }}
        className="flex justify-end"
      >
        <Button type="submit" size="lg">
          {t("detail.applyCta")}
        </Button>
      </form>
    </section>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <Icon className="mt-0.5 size-5 text-brand-cobalt-500" aria-hidden />
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-sm font-medium text-foreground">{value}</span>
      </div>
    </div>
  );
}

function RequirementsBlock({
  requirements,
  emDash,
}: {
  requirements: unknown;
  emDash: string;
}) {
  if (!requirements || typeof requirements !== "object") {
    return <p className="text-sm text-muted-foreground">{emDash}</p>;
  }
  const entries = Object.entries(requirements as Record<string, unknown>).filter(
    // `qty` is surfaced as a prominent info tile above; suppress it here so the
    // requirements block stays focused on free-text/structured organizer notes.
    ([k]) => k !== "kind" && k !== "qty",
  );
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emDash}</p>;
  }
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex flex-col">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="text-sm">{renderRequirementValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderRequirementValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.map(String).join(", ") || "—";
  if (typeof v === "boolean") return v ? "✓" : "—";
  return String(v);
}

function readQty(requirements: unknown): number {
  if (!requirements || typeof requirements !== "object") return 1;
  const raw = (requirements as { qty?: unknown }).qty;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
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
