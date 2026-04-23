import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  AlertCircle,
  CalendarDays,
  MapPin,
  Users,
  Timer,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import {
  StatusPill,
  type StatusPillStatus,
} from "@/components/ui-ext/StatusPill";
import {
  formatConfirmDeadline,
  type ConfirmationStatus,
} from "@/lib/domain/booking";
import { formatHalalas } from "@/lib/domain/money";
import type { QuoteSnapshot } from "@/lib/domain/quote";
import { requireAccess } from "@/lib/auth/access";
import { CompanyProfileDownloadButton } from "./CompanyProfileDownloadButton";

export const dynamic = "force-dynamic";

type BookingDetailRow = {
  id: string;
  rfq_id: string;
  quote_id: string;
  accepted_quote_revision_id: string;
  organizer_id: string;
  supplier_id: string;
  confirmation_status: ConfirmationStatus;
  confirm_deadline: string | null;
  confirmed_at: string | null;
  created_at: string;
  suppliers: {
    id: string;
    business_name: string;
    base_city: string | null;
  } | null;
  rfqs: {
    id: string;
    events: {
      id: string;
      city: string;
      starts_at: string;
      ends_at: string;
      event_type: string;
      client_name: string | null;
      guest_count: number | null;
    } | null;
  } | null;
  quote_revisions: {
    id: string;
    version: number;
    snapshot_jsonb: unknown;
  } | null;
};

function confirmationToPill(
  status: ConfirmationStatus,
): StatusPillStatus {
  if (status === "confirmed") return "confirmed";
  if (status === "cancelled") return "cancelled";
  return "awaiting_supplier";
}

function statusLabel(
  t: (key: string) => string,
  status: ConfirmationStatus,
): string {
  switch (status) {
    case "confirmed":
      return t("statusConfirmed");
    case "cancelled":
      return t("statusCancelled");
    case "awaiting_supplier":
    default:
      return t("statusAwaitingSupplier");
  }
}

function formatEventDateTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", {
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

function deadlineText(
  t: (
    key: string,
    values?: Record<string, string | number>,
  ) => string,
  deadlineIso: string | null,
): string {
  const result = formatConfirmDeadline(deadlineIso);
  if (result.kind === "none") return "—";
  if (result.kind === "expired") return t("confirmDeadlineExpired");
  if (result.hours === 1) return t("countdownHoursSingular");
  return t("countdownHours", { hours: result.hours });
}

type PageProps = { params: Promise<{ id: string }> };

export default async function OrganizerBookingDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("booking");
  const eventFormT = await getTranslations("organizer.eventForm");

  const { admin, user } = await requireAccess("organizer.bookings");

  const { data } = await admin
    .from("bookings")
    .select(
      `id, rfq_id, quote_id, accepted_quote_revision_id, organizer_id,
       supplier_id, confirmation_status, confirm_deadline, confirmed_at, created_at,
       suppliers ( id, business_name, base_city ),
       rfqs ( id, events ( id, city, starts_at, ends_at, event_type, client_name, guest_count ) ),
       quote_revisions:accepted_quote_revision_id ( id, version, snapshot_jsonb )`,
    )
    .eq("id", id)
    .eq("organizer_id", user.id)
    .maybeSingle();

  if (!data) notFound();
  const row = data as unknown as BookingDetailRow;
  const snapshot = (row.quote_revisions?.snapshot_jsonb ?? null) as
    | QuoteSnapshot
    | null;
  const event = row.rfqs?.events ?? null;
  const supplier = row.suppliers;

  // Company profile PDF: only surfaced once the booking is confirmed. We
  // check for an existing doc row here so we don't render an action that
  // the server action would reject with `missing`. The signed URL itself
  // is minted lazily by the client button (click → server action → signed
  // URL → `window.open`) so RLS on `supplier-docs` stays enforced.
  let hasCompanyProfile = false;
  if (row.confirmation_status === "confirmed" && row.supplier_id) {
    const { data: doc } = await admin
      .from("supplier_docs")
      .select("id")
      .eq("supplier_id", row.supplier_id)
      .eq("doc_type", "company_profile")
      .limit(1)
      .maybeSingle();
    hasCompanyProfile = Boolean(doc);
  }

  let relativeDeadline: string | null = null;
  if (row.confirm_deadline) {
    try {
      relativeDeadline = formatDistanceToNow(new Date(row.confirm_deadline), {
        addSuffix: true,
      });
    } catch {
      relativeDeadline = null;
    }
  }

  const deadlineAbs = row.confirm_deadline
    ? formatEventDateTime(row.confirm_deadline, locale)
    : null;

  return (
    <section className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/organizer/bookings">
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t("detail.backToList")}
        </Link>
      </Button>

      <PageHeader
        title={t("detailTitle")}
        description={`${supplier?.business_name ?? "—"}${
          event?.city ? ` · ${event.city}` : ""
        }`}
        actions={
          <StatusPill
            status={confirmationToPill(row.confirmation_status)}
            label={statusLabel(t, row.confirmation_status)}
          />
        }
      />

      {row.confirmation_status === "awaiting_supplier" ? (
        <Alert>
          <Timer aria-hidden />
          <AlertTitle>{t("banner.awaitingOrganizer")}</AlertTitle>
          <AlertDescription>
            <span className="font-medium text-foreground">
              {t("confirmDeadline")}: {deadlineAbs ?? "—"}
            </span>
            {" · "}
            <span>
              {deadlineText(t, row.confirm_deadline)}
              {relativeDeadline ? ` (${relativeDeadline})` : ""}
            </span>
          </AlertDescription>
        </Alert>
      ) : row.confirmation_status === "cancelled" ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>
            This booking was cancelled — the supplier&apos;s calendar has been
            released.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("detailSupplier")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-4 pb-5">
            <p className="text-base font-semibold text-brand-navy-900">
              {supplier?.business_name ?? "—"}
            </p>
            {supplier?.base_city ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin
                  className="size-3.5 text-brand-cobalt-500"
                  aria-hidden
                />
                {supplier.base_city}
              </p>
            ) : null}
            {hasCompanyProfile ? (
              <CompanyProfileDownloadButton
                bookingId={row.id}
                labels={{
                  download: t("downloadCompanyProfile"),
                  errorGeneric: t("downloadCompanyProfileError"),
                  notReady: t("downloadCompanyProfileNotReady"),
                }}
                className="mt-1"
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("detailEvent")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 px-4 pb-5">
            <p className="text-base font-semibold text-brand-navy-900">
              {event
                ? eventFormT(`eventType.${event.event_type}` as never)
                : "—"}
            </p>
            {event?.client_name ? (
              <p className="text-sm text-foreground">{event.client_name}</p>
            ) : null}
            {event ? (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" aria-hidden /> {event.city}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" aria-hidden />
                  {formatEventDateTime(event.starts_at, locale)}
                </span>
                {event.guest_count ? (
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3" aria-hidden />
                    {event.guest_count}
                  </span>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between border-b pb-4">
          <CardTitle className="text-lg">
            {t("detailAcceptedRevision")}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {t("detail.revision")} #{row.quote_revisions?.version ?? "—"}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {snapshot ? <BookingSnapshotBody snapshot={snapshot} t={t} /> : (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              —
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function BookingSnapshotBody({
  snapshot,
  t,
}: {
  snapshot: QuoteSnapshot;
  t: (
    key: string,
    values?: Record<string, string | number>,
  ) => string;
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      {snapshot.line_items.length > 0 ? (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("detail.lineItemsHeading")}
          </h3>
          <Table>
            <TableBody>
              {snapshot.line_items.map((item, idx) => (
                <TableRow
                  key={`${item.label}-${idx}`}
                  className="border-b last:border-0"
                >
                  <TableCell className="py-2.5 pe-3">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.qty} ×{" "}
                      {formatHalalas(item.unit_price_halalas)} ({item.unit})
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 text-end font-medium tabular-nums">
                    {formatHalalas(item.total_halalas)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("detail.totalsHeading")}
        </h3>
        <dl className="flex flex-col gap-1.5 text-sm">
          <TotalRow
            label={t("detail.subtotal")}
            value={formatHalalas(snapshot.subtotal_halalas)}
          />
          {snapshot.travel_fee_halalas > 0 ? (
            <TotalRow
              label={t("detail.travelFee")}
              value={formatHalalas(snapshot.travel_fee_halalas)}
            />
          ) : null}
          {snapshot.setup_fee_halalas > 0 ? (
            <TotalRow
              label={t("detail.setupFee")}
              value={formatHalalas(snapshot.setup_fee_halalas)}
            />
          ) : null}
          {snapshot.teardown_fee_halalas > 0 ? (
            <TotalRow
              label={t("detail.teardownFee")}
              value={formatHalalas(snapshot.teardown_fee_halalas)}
            />
          ) : null}
          {snapshot.vat_amount_halalas > 0 ? (
            <TotalRow
              label={t("detail.vat", { pct: snapshot.vat_rate_pct })}
              value={formatHalalas(snapshot.vat_amount_halalas)}
            />
          ) : null}
          <div className="mt-2 flex items-baseline justify-between border-t pt-3">
            <dt className="text-base font-semibold text-brand-navy-900">
              {t("detail.total")}
            </dt>
            <dd className="text-lg font-semibold tabular-nums text-brand-navy-900">
              {formatHalalas(snapshot.total_halalas)}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("detail.termsHeading")}
        </h3>
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">
              {t("detail.depositPct")}
            </dt>
            <dd className="font-medium">{snapshot.deposit_pct}%</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">
              {t("detail.paymentSchedule")}
            </dt>
            <dd className="whitespace-pre-line">{snapshot.payment_schedule}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">
              {t("detail.cancellationTerms")}
            </dt>
            <dd className="whitespace-pre-line">
              {snapshot.cancellation_terms}
            </dd>
          </div>
          {snapshot.inclusions.length > 0 ? (
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">
                {t("detail.inclusions")}
              </dt>
              <dd>
                <ul className="list-disc space-y-0.5 ps-5">
                  {snapshot.inclusions.map((item, idx) => (
                    <li key={`${item}-${idx}`}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {snapshot.exclusions.length > 0 ? (
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">
                {t("detail.exclusions")}
              </dt>
              <dd>
                <ul className="list-disc space-y-0.5 ps-5">
                  {snapshot.exclusions.map((item, idx) => (
                    <li key={`${item}-${idx}`}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {snapshot.notes ? (
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{t("detail.notes")}</dt>
              <dd className="whitespace-pre-line">{snapshot.notes}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
