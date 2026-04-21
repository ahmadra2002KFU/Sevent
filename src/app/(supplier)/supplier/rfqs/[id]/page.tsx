import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight, ClipboardList, FileText, MapPin } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { formatHalalas } from "@/lib/domain/money";
import type { QuoteSnapshot } from "@/lib/domain/quote";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DeclineInviteForm } from "./decline-form";
import { declineInviteAction } from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

type DetailRow = {
  id: string;
  supplier_id: string;
  status: "invited" | "declined" | "quoted" | "withdrawn";
  sent_at: string;
  response_due_at: string;
  responded_at: string | null;
  decline_reason_code: string | null;
  rfqs: {
    id: string;
    subcategory_id: string;
    requirements_jsonb: unknown;
    events: {
      id: string;
      city: string;
      venue_address: string | null;
      starts_at: string;
      ends_at: string;
      guest_count: number | null;
      budget_range_min_halalas: number | null;
      budget_range_max_halalas: number | null;
      notes: string | null;
    } | null;
    categories: {
      id: string;
      slug: string;
      name_en: string;
    } | null;
  } | null;
};

type QuoteRow = {
  id: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "withdrawn";
  sent_at: string | null;
  expires_at: string | null;
  current_revision_id: string | null;
};

type RevisionRow = {
  id: string;
  version: number;
  snapshot_jsonb: unknown;
  created_at: string;
};

const TERMINAL_QUOTE_STATUSES = new Set<QuoteRow["status"]>([
  "accepted",
  "rejected",
  "expired",
  "withdrawn",
]);

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatBudget(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${formatHalalas(min)} – ${formatHalalas(max)}`;
  if (min != null) return `≥ ${formatHalalas(min)}`;
  if (max != null) return `≤ ${formatHalalas(max)}`;
  return "—";
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function RequirementsBlock({
  requirements,
  t,
}: {
  requirements: unknown;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  if (!requirements || typeof requirements !== "object") {
    return (
      <p className="text-sm text-muted-foreground">
        {t("noStructuredRequirements")}
      </p>
    );
  }
  const r = requirements as { kind?: string } & Record<string, unknown>;
  const rows: Array<{ label: string; value: string }> = [];

  switch (r.kind) {
    case "venues": {
      const seating = r.seating_style as string | undefined;
      const io = r.indoor_outdoor as string | undefined;
      const parking = r.needs_parking as boolean | undefined;
      const kitchen = r.needs_kitchen as boolean | undefined;
      if (seating) rows.push({ label: t("requirements.seatingStyle"), value: seating });
      if (io) rows.push({ label: t("requirements.indoorOutdoor"), value: io });
      rows.push({
        label: t("requirements.needsParking"),
        value: parking ? t("requirements.yes") : t("requirements.no"),
      });
      rows.push({
        label: t("requirements.needsKitchen"),
        value: kitchen ? t("requirements.yes") : t("requirements.no"),
      });
      break;
    }
    case "catering": {
      const meal = r.meal_type as string | undefined;
      const dietary = r.dietary as string[] | undefined;
      const style = r.service_style as string | undefined;
      if (meal) rows.push({ label: t("requirements.mealType"), value: meal });
      if (dietary && dietary.length > 0)
        rows.push({ label: t("requirements.dietary"), value: dietary.join(", ") });
      if (style) rows.push({ label: t("requirements.serviceStyle"), value: style });
      break;
    }
    case "photography": {
      const hours = r.coverage_hours as number | undefined;
      const deliverables = r.deliverables as string[] | undefined;
      const crew = r.crew_size as number | undefined;
      if (hours != null)
        rows.push({ label: t("requirements.coverageHours"), value: String(hours) });
      if (deliverables && deliverables.length > 0)
        rows.push({
          label: t("requirements.deliverables"),
          value: deliverables.join(", "),
        });
      if (crew != null)
        rows.push({ label: t("requirements.crewSize"), value: String(crew) });
      break;
    }
    case "generic": {
      const notes = r.notes as string | undefined;
      if (notes) rows.push({ label: t("requirements.notes"), value: notes });
      break;
    }
    default:
      return (
        <p className="text-sm text-muted-foreground">
          {t("unknownRequirements")}
        </p>
      );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("noStructuredRequirements")}
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {rows.map((row) => (
        <Field key={row.label} label={row.label} value={row.value} />
      ))}
    </dl>
  );
}

export default async function SupplierRfqDetailPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations("supplier.rfqInbox");

  const gate = await requireRole("supplier");
  if (gate.status === "unauthenticated") redirect(`/sign-in?next=/supplier/rfqs/${id}`);
  if (gate.status === "forbidden") redirect("/supplier/onboarding");
  const { user, admin } = gate;

  const { data: supplierRow } = await admin
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!supplierRow) notFound();

  const { data: inviteData } = await admin
    .from("rfq_invites")
    .select(
      `id, supplier_id, status, sent_at, response_due_at, responded_at, decline_reason_code,
       rfqs (
         id, subcategory_id, requirements_jsonb,
         events (
           id, city, venue_address, starts_at, ends_at, guest_count,
           budget_range_min_halalas, budget_range_max_halalas, notes
         ),
         categories!rfqs_subcategory_id_fkey ( id, slug, name_en )
       )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!inviteData) notFound();
  const invite = inviteData as unknown as DetailRow;

  // Belt-and-suspenders — RLS should already scope this, but make the server
  // action flow fail closed when any UI fetches a sibling invite by id.
  const supplierId = (supplierRow as { id: string }).id;
  if (invite.supplier_id !== supplierId) notFound();

  const rfq = invite.rfqs;
  const event = rfq?.events ?? null;
  const subcategory = rfq?.categories ?? null;

  // Load the supplier's quote on this RFQ (if any) — mirrors the quote
  // builder's loader. Any non-null quote means the supplier has responded
  // and the decline form should disappear.
  let quote: QuoteRow | null = null;
  let latestRevision: RevisionRow | null = null;
  if (rfq?.id) {
    const { data: quoteRow } = await admin
      .from("quotes")
      .select("id, status, sent_at, expires_at, current_revision_id")
      .eq("rfq_id", rfq.id)
      .eq("supplier_id", supplierId)
      .maybeSingle();
    quote = (quoteRow as QuoteRow | null) ?? null;

    if (quote?.current_revision_id) {
      const { data: revRow } = await admin
        .from("quote_revisions")
        .select("id, version, snapshot_jsonb, created_at")
        .eq("id", quote.current_revision_id)
        .maybeSingle();
      latestRevision = (revRow as RevisionRow | null) ?? null;
    }
  }

  const snapshot = latestRevision
    ? (latestRevision.snapshot_jsonb as QuoteSnapshot | null)
    : null;
  const quoteIsTerminal = quote ? TERMINAL_QUOTE_STATUSES.has(quote.status) : false;
  const hasActiveQuote = quote !== null && !quoteIsTerminal;

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <StatusPill
        status={
          invite.status === "invited"
            ? "invited"
            : invite.status === "quoted"
              ? "quoted"
              : invite.status === "declined"
                ? "declined"
                : "withdrawn"
        }
        label={t(`status.${invite.status}`)}
      />
    </div>
  );

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={subcategory?.name_en ?? t("detailTitle")}
        description={
          event?.starts_at
            ? `${event.city ?? ""} · ${formatDate(event.starts_at)}`
            : t("detailSubtitle")
        }
        actions={headerActions}
      />

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b">
          <MapPin className="size-4 text-brand-cobalt-500" aria-hidden />
          <CardTitle>{t("eventCardHeading")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label={t("cityLabel")} value={event?.city ?? "—"} />
            <Field
              label={t("venueAddressLabel")}
              value={event?.venue_address ?? "—"}
            />
            <Field label={t("startsLabel")} value={formatDate(event?.starts_at)} />
            <Field label={t("endsLabel")} value={formatDate(event?.ends_at)} />
            <Field
              label={t("guestCountLabel")}
              value={event?.guest_count != null ? event.guest_count : "—"}
            />
            <Field
              label={t("budgetLabel")}
              value={formatBudget(
                event?.budget_range_min_halalas,
                event?.budget_range_max_halalas,
              )}
            />
            {event?.notes ? (
              <Field
                className="sm:col-span-2"
                label={t("organizerNotes")}
                value={event.notes}
              />
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b">
          <ClipboardList className="size-4 text-brand-cobalt-500" aria-hidden />
          <CardTitle>{t("requirementsHeading")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <RequirementsBlock requirements={rfq?.requirements_jsonb} t={t} />
        </CardContent>
      </Card>

      {hasActiveQuote && quote && snapshot ? (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b">
            <FileText className="size-4 text-brand-cobalt-500" aria-hidden />
            <div className="flex-1">
              <CardTitle>{t("yourQuoteTitle")}</CardTitle>
              <CardDescription>
                {t("yourQuoteSubtitle", {
                  version: latestRevision?.version ?? 1,
                  sentAt: formatDate(
                    quote.sent_at ?? latestRevision?.created_at ?? null,
                  ),
                })}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={t("totalLabel")}
                value={
                  <span className="text-lg font-semibold text-brand-navy-900">
                    {formatHalalas(snapshot.total_halalas)}
                  </span>
                }
              />
              <Field
                label={t("validUntil", {
                  expiresAt: formatDate(quote.expires_at ?? snapshot.expires_at),
                })}
                value=""
              />
            </dl>
            <Separator className="my-4" />
            <Button asChild>
              <Link href={`/supplier/rfqs/${invite.id}/quote`}>
                {t("revise")}
                <ArrowUpRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : quote && quoteIsTerminal ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("yourQuoteTitle")}</CardTitle>
            <CardDescription>
              {t("terminalStatus", { status: quote.status })}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : invite.status === "declined" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("respondHeading")}</CardTitle>
            <CardDescription>{t("declinedNote")}</CardDescription>
          </CardHeader>
        </Card>
      ) : invite.status !== "invited" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("respondHeading")}</CardTitle>
            <CardDescription>{t(`status.${invite.status}`)}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{t("respondHeading")}</CardTitle>
            <CardDescription>
              {t("respondDueBy", { date: formatDate(invite.response_due_at) })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button asChild size="lg" className="sm:w-auto">
              <Link href={`/supplier/rfqs/${invite.id}/quote`}>
                {t("quoteCta")}
                <ArrowUpRight />
              </Link>
            </Button>
            <DeclineInviteForm
              inviteId={invite.id}
              action={declineInviteAction}
              labels={{
                trigger: t("decline"),
                heading: t("declineConfirmHeading"),
                body: t("declineConfirmBody"),
                reasonLabel: t("declineReasonLabel"),
                noteLabel: t("noteOptional"),
                cancel: t("cancel"),
                confirm: t("declineConfirmCta"),
                reasons: {
                  too_busy: t("declineReason.too_busy"),
                  out_of_area: t("declineReason.out_of_area"),
                  price_mismatch: t("declineReason.price_mismatch"),
                  other: t("declineReason.other"),
                },
              }}
            />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
