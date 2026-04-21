import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import {
  formatConfirmDeadline,
  type ConfirmationStatus,
} from "@/lib/domain/booking";
import { formatHalalas } from "@/lib/domain/money";
import type { QuoteSnapshot } from "@/lib/domain/quote";
import { requireRole } from "@/lib/supabase/server";

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
  suppliers: { id: string; business_name: string; base_city: string | null } | null;
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

function statusBadgeClass(status: ConfirmationStatus): string {
  switch (status) {
    case "confirmed":
      return "border-[#BDE3CB] bg-[#E2F4EA] text-[var(--color-sevent-green)]";
    case "cancelled":
      return "border-[#F2C2C2] bg-[#FCE9E9] text-[#9F1A1A]";
    case "awaiting_supplier":
    default:
      return "border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]";
  }
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

export default async function OrganizerBookingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("booking");
  const eventFormT = await getTranslations("organizer.eventForm");

  const gate = await requireRole("organizer");
  if (gate.status === "unauthenticated") {
    redirect(`/sign-in?next=/organizer/bookings/${id}`);
  }
  if (gate.status === "forbidden") redirect("/");
  const { admin, user } = gate;

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

  const deadline = row.confirm_deadline
    ? formatEventDateTime(row.confirm_deadline, locale)
    : null;

  return (
    <section className="flex flex-col gap-6">
      <Link
        href="/organizer/bookings"
        className="w-fit text-sm text-[var(--color-sevent-green,#0a7)] hover:underline"
      >
        {t("detail.backToList")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("detailTitle")}</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {supplier?.business_name ?? "—"}
            {event?.city ? ` · ${event.city}` : ""}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(
            row.confirmation_status,
          )}`}
        >
          {statusLabel(t, row.confirmation_status)}
        </span>
      </header>

      {row.confirmation_status === "awaiting_supplier" ? (
        <div className="rounded-md border border-[var(--color-border)] bg-[#FFF8E8] p-4 text-sm">
          <p className="font-medium text-[var(--color-foreground)]">
            {t("banner.awaitingOrganizer")}
          </p>
          <p className="mt-1 text-[var(--color-muted-foreground)]">
            {t("confirmDeadline")}: {deadline ?? "—"}
            {" · "}
            {deadlineText(t, row.confirm_deadline)}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-[var(--color-border)] bg-white p-5">
          <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
            {t("detailSupplier")}
          </h2>
          <p className="mt-2 text-base font-medium">
            {supplier?.business_name ?? "—"}
          </p>
          {supplier?.base_city ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {supplier.base_city}
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-[var(--color-border)] bg-white p-5">
          <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
            {t("detailEvent")}
          </h2>
          <p className="mt-2 text-base font-medium">
            {event
              ? eventFormT(`eventType.${event.event_type}` as never)
              : "—"}
          </p>
          {event?.client_name ? (
            <p className="text-sm">{event.client_name}</p>
          ) : null}
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {event?.city ?? "—"}
            {event?.starts_at
              ? ` · ${formatEventDateTime(event.starts_at, locale)}`
              : ""}
          </p>
          {event?.guest_count ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {event.guest_count} guests
            </p>
          ) : null}
        </section>
      </div>

      <section className="rounded-lg border border-[var(--color-border)] bg-white">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-5 py-3">
          <h2 className="text-base font-semibold">
            {t("detailAcceptedRevision")}
          </h2>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {t("detail.revision")} #{row.quote_revisions?.version ?? "—"}
          </span>
        </header>
        {snapshot ? (
          <BookingSnapshotBody snapshot={snapshot} t={t} />
        ) : (
          <p className="p-5 text-sm text-[var(--color-muted-foreground)]">—</p>
        )}
      </section>
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
    <div className="flex flex-col gap-5 p-5">
      {snapshot.line_items.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
            {t("detail.lineItemsHeading")}
          </h3>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {snapshot.line_items.map((item, idx) => (
                <tr
                  key={`${item.label}-${idx}`}
                  className="border-t border-[var(--color-border)] first:border-t-0"
                >
                  <td className="py-2 pe-3">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      {item.qty} × {formatHalalas(item.unit_price_halalas)}{" "}
                      ({item.unit})
                    </div>
                  </td>
                  <td className="py-2 text-end font-medium">
                    {formatHalalas(item.total_halalas)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
          {t("detail.totalsHeading")}
        </h3>
        <dl className="mt-2 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--color-muted-foreground)]">
              {t("detail.subtotal")}
            </dt>
            <dd>{formatHalalas(snapshot.subtotal_halalas)}</dd>
          </div>
          {snapshot.travel_fee_halalas > 0 ? (
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted-foreground)]">
                {t("detail.travelFee")}
              </dt>
              <dd>{formatHalalas(snapshot.travel_fee_halalas)}</dd>
            </div>
          ) : null}
          {snapshot.setup_fee_halalas > 0 ? (
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted-foreground)]">
                {t("detail.setupFee")}
              </dt>
              <dd>{formatHalalas(snapshot.setup_fee_halalas)}</dd>
            </div>
          ) : null}
          {snapshot.teardown_fee_halalas > 0 ? (
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted-foreground)]">
                {t("detail.teardownFee")}
              </dt>
              <dd>{formatHalalas(snapshot.teardown_fee_halalas)}</dd>
            </div>
          ) : null}
          {snapshot.vat_amount_halalas > 0 ? (
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted-foreground)]">
                {t("detail.vat", { pct: snapshot.vat_rate_pct })}
              </dt>
              <dd>{formatHalalas(snapshot.vat_amount_halalas)}</dd>
            </div>
          ) : null}
          <div className="mt-1 flex justify-between border-t border-[var(--color-border)] pt-2 text-base font-semibold">
            <dt>{t("detail.total")}</dt>
            <dd>{formatHalalas(snapshot.total_halalas)}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
          {t("detail.termsHeading")}
        </h3>
        <dl className="mt-2 flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--color-muted-foreground)]">
              {t("detail.depositPct")}
            </dt>
            <dd>{snapshot.deposit_pct}%</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-[var(--color-muted-foreground)]">
              {t("detail.paymentSchedule")}
            </dt>
            <dd>{snapshot.payment_schedule}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-[var(--color-muted-foreground)]">
              {t("detail.cancellationTerms")}
            </dt>
            <dd>{snapshot.cancellation_terms}</dd>
          </div>
          {snapshot.inclusions.length > 0 ? (
            <div className="flex flex-col gap-1">
              <dt className="text-[var(--color-muted-foreground)]">
                {t("detail.inclusions")}
              </dt>
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
              <dt className="text-[var(--color-muted-foreground)]">
                {t("detail.exclusions")}
              </dt>
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
              <dt className="text-[var(--color-muted-foreground)]">
                {t("detail.notes")}
              </dt>
              <dd>{snapshot.notes}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  );
}
