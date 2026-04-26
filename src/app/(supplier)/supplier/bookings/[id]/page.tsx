import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ReceiptText, Users } from "lucide-react";
import {
  formatConfirmDeadline,
  type ConfirmationStatus,
} from "@/lib/domain/booking";
import { formatHalalas } from "@/lib/domain/money";
import type { QuoteSnapshot } from "@/lib/domain/quote";
import { fmtDateTime, type SupportedLocale } from "@/lib/domain/formatDate";
import { segmentNameFor } from "@/lib/domain/segments";
import { cityNameFor } from "@/lib/domain/cities";
import { requireAccess } from "@/lib/auth/access";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BookingActions } from "./BookingActions";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

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
  profiles: { id: string; full_name: string | null } | null;
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

function statusPillFor(
  t: (key: string) => string,
  status: ConfirmationStatus,
) {
  switch (status) {
    case "confirmed":
      return <StatusPill status="confirmed" label={t("statusConfirmed")} />;
    case "cancelled":
      return <StatusPill status="cancelled" label={t("statusCancelled")} />;
    case "awaiting_supplier":
    default:
      return (
        <StatusPill
          status="awaiting_supplier"
          label={t("statusAwaitingSupplier")}
        />
      );
  }
}

function deadlineText(
  t: (key: string, values?: Record<string, string | number>) => string,
  deadlineIso: string | null,
): string {
  const result = formatConfirmDeadline(deadlineIso);
  if (result.kind === "none") return "—";
  if (result.kind === "expired") return t("confirmDeadlineExpired");
  if (result.hours === 1) return t("countdownHoursSingular");
  return t("countdownHours", { hours: result.hours });
}

type PageProps = { params: Promise<{ id: string }> };

export default async function SupplierBookingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("booking");

  const { decision, admin } = await requireAccess("supplier.bookings");
  const supplierId = decision.supplierId;
  if (!supplierId) notFound();

  const { data } = await admin
    .from("bookings")
    .select(
      `id, rfq_id, quote_id, accepted_quote_revision_id, organizer_id,
       supplier_id, confirmation_status, confirm_deadline, confirmed_at, created_at,
       profiles:organizer_id ( id, full_name ),
       rfqs ( id, events ( id, city, starts_at, ends_at, event_type, client_name, guest_count ) ),
       quote_revisions:accepted_quote_revision_id ( id, version, snapshot_jsonb )`,
    )
    .eq("id", id)
    .eq("supplier_id", supplierId)
    .maybeSingle();

  if (!data) notFound();
  const row = data as unknown as BookingDetailRow;
  const snapshot = (row.quote_revisions?.snapshot_jsonb ?? null) as
    | QuoteSnapshot
    | null;
  const event = row.rfqs?.events ?? null;
  const organizerName = row.profiles?.full_name ?? "—";

  const deadlineFormatted = row.confirm_deadline
    ? fmtDateTime(row.confirm_deadline, locale)
    : null;
  const cityLabel = event?.city ? cityNameFor(event.city, locale) : null;
  const deadlineResult = formatConfirmDeadline(row.confirm_deadline);

  return (
    <section className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/supplier/bookings">
          <ArrowLeft className="rtl:rotate-180" />
          {t("detail.backToList")}
        </Link>
      </Button>

      <PageHeader
        title={t("detailTitle")}
        description={`${organizerName}${cityLabel ? ` · ${cityLabel}` : ""}`}
        actions={statusPillFor(t, row.confirmation_status)}
      />

      {row.confirmation_status === "awaiting_supplier" ? (
        <Alert
          variant={deadlineResult.kind === "expired" ? "destructive" : "default"}
        >
          <CalendarClock />
          <AlertTitle>{t("banner.awaitingSupplier")}</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col gap-1">
              <span>
                {t("confirmDeadline")}: {deadlineFormatted ?? "—"}
              </span>
              <span className="font-medium text-foreground">
                {deadlineText(t, row.confirm_deadline)}
              </span>
              {deadlineResult.kind === "expired" ? null : (
                <BookingActions bookingId={row.id} />
              )}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>{t("detailOrganizer")}</CardDescription>
            <CardTitle>{organizerName}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{t("detailEvent")}</CardDescription>
            <CardTitle>
              {event ? segmentNameFor(event.event_type, locale) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            {event?.client_name ? (
              <p className="text-foreground">{event.client_name}</p>
            ) : null}
            <p>
              {cityLabel ?? "—"}
              {event?.starts_at
                ? ` · ${fmtDateTime(event.starts_at, locale)}`
                : ""}
            </p>
            {event?.guest_count ? (
              <p className="inline-flex items-center gap-1">
                <Users className="size-3.5" aria-hidden />
                {event.guest_count} guests
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b">
          <div className="flex items-center gap-2">
            <ReceiptText
              className="size-4 text-brand-cobalt-500"
              aria-hidden
            />
            <CardTitle>{t("detailAcceptedRevision")}</CardTitle>
          </div>
          <Badge variant="outline">
            {t("detail.revision")} #{row.quote_revisions?.version ?? "—"}
          </Badge>
        </CardHeader>
        <CardContent className="pt-6">
          {snapshot ? (
            <BookingSnapshotBody snapshot={snapshot} t={t} />
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
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
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {snapshot.line_items.length > 0 ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("detail.lineItemsHeading")}
          </h3>
          <Table className="mt-2">
            <TableBody>
              {snapshot.line_items.map((item, idx) => (
                <TableRow key={`${item.label}-${idx}`}>
                  <TableCell className="whitespace-normal">
                    <div className="font-medium text-foreground">
                      {item.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.qty} × {formatHalalas(item.unit_price_halalas)}{" "}
                      ({item.unit})
                    </div>
                  </TableCell>
                  <TableCell className="text-end font-medium">
                    {formatHalalas(item.total_halalas)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("detail.totalsHeading")}
        </h3>
        <dl className="mt-2 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("detail.subtotal")}</dt>
            <dd>{formatHalalas(snapshot.subtotal_halalas)}</dd>
          </div>
          {snapshot.travel_fee_halalas > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("detail.travelFee")}</dt>
              <dd>{formatHalalas(snapshot.travel_fee_halalas)}</dd>
            </div>
          ) : null}
          {snapshot.setup_fee_halalas > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("detail.setupFee")}</dt>
              <dd>{formatHalalas(snapshot.setup_fee_halalas)}</dd>
            </div>
          ) : null}
          {snapshot.teardown_fee_halalas > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("detail.teardownFee")}</dt>
              <dd>{formatHalalas(snapshot.teardown_fee_halalas)}</dd>
            </div>
          ) : null}
          {snapshot.vat_amount_halalas > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {t("detail.vat", { pct: snapshot.vat_rate_pct })}
              </dt>
              <dd>{formatHalalas(snapshot.vat_amount_halalas)}</dd>
            </div>
          ) : null}
          <Separator className="my-2" />
          <div className="flex justify-between text-base font-semibold text-brand-navy-900">
            <dt>{t("detail.total")}</dt>
            <dd>{formatHalalas(snapshot.total_halalas)}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("detail.termsHeading")}
        </h3>
        <dl className="mt-2 flex flex-col gap-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("detail.depositPct")}</dt>
            <dd>{snapshot.deposit_pct}%</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">
              {t("detail.paymentSchedule")}
            </dt>
            <dd>{snapshot.payment_schedule}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">
              {t("detail.cancellationTerms")}
            </dt>
            <dd>{snapshot.cancellation_terms}</dd>
          </div>
          {snapshot.inclusions.length > 0 ? (
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{t("detail.inclusions")}</dt>
              <dd>
                <ul className="list-inside list-disc">
                  {snapshot.inclusions.map((item, idx) => (
                    <li key={`${item}-${idx}`}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {snapshot.exclusions.length > 0 ? (
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{t("detail.exclusions")}</dt>
              <dd>
                <ul className="list-inside list-disc">
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
              <dd>{snapshot.notes}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  );
}
