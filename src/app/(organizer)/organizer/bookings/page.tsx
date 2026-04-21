import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  formatConfirmDeadline,
  type ConfirmationStatus,
} from "@/lib/domain/booking";
import { formatHalalas } from "@/lib/domain/money";
import type { QuoteSnapshot } from "@/lib/domain/quote";
import { requireRole } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type FilterValue = ConfirmationStatus | "all";

const FILTER_VALUES: FilterValue[] = [
  "all",
  "awaiting_supplier",
  "confirmed",
  "cancelled",
];

type BookingListRow = {
  id: string;
  confirmation_status: ConfirmationStatus;
  confirm_deadline: string | null;
  created_at: string;
  suppliers: { id: string; business_name: string } | null;
  rfqs: {
    id: string;
    events: {
      id: string;
      city: string;
      starts_at: string;
    } | null;
  } | null;
  quote_revisions: {
    id: string;
    snapshot_jsonb: unknown;
  } | null;
};

function parseFilter(value: string | string[] | undefined): FilterValue {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return "all";
  if ((FILTER_VALUES as string[]).includes(raw)) return raw as FilterValue;
  return "all";
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

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

function formatEventDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDeadlineCell(
  t: (key: string, values?: Record<string, string | number>) => string,
  deadlineIso: string | null,
): string {
  const result = formatConfirmDeadline(deadlineIso);
  if (result.kind === "none") return "—";
  if (result.kind === "expired") return t("confirmDeadlineExpired");
  if (result.hours === 1) return t("countdownHoursSingular");
  return t("countdownHours", { hours: result.hours });
}

function getSnapshotTotal(snapshot: unknown): number | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const s = snapshot as Partial<QuoteSnapshot>;
  if (typeof s.total_halalas !== "number") return null;
  return s.total_halalas;
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrganizerBookingsListPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const filter = parseFilter(params.status);
  const page = parsePage(params.page);
  const locale = await getLocale();

  const t = await getTranslations("booking");

  const gate = await requireRole("organizer");
  if (gate.status === "unauthenticated") redirect("/sign-in?next=/organizer/bookings");
  if (gate.status === "forbidden") redirect("/");
  const { admin, user } = gate;

  // Service-role + explicit organizer_id filter. RLS is bypassed; the
  // .eq("organizer_id", user.id) below IS the security boundary.
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from("bookings")
    .select(
      `id, confirmation_status, confirm_deadline, created_at,
       suppliers ( id, business_name ),
       rfqs ( id, events ( id, city, starts_at ) ),
       quote_revisions:accepted_quote_revision_id ( id, snapshot_jsonb )`,
      { count: "exact" },
    )
    .eq("organizer_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filter !== "all") {
    query = query.eq("confirmation_status", filter);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as BookingListRow[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("listTitle")}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t("listIntro")}
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t("filterLabel")}
          <select
            name="status"
            defaultValue={filter}
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-normal text-[var(--color-foreground)]"
          >
            <option value="all">{t("filterAll")}</option>
            <option value="awaiting_supplier">
              {t("statusAwaitingSupplier")}
            </option>
            <option value="confirmed">{t("statusConfirmed")}</option>
            <option value="cancelled">{t("statusCancelled")}</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md border border-[var(--color-border)] bg-white px-4 py-2 text-sm hover:bg-[var(--color-muted)]"
        >
          {t("filterLabel")}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-6 text-sm text-[var(--color-muted-foreground)]">
          {t("noBookings")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)] text-start text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("table.supplier")}</th>
                <th className="px-4 py-3 font-medium">{t("table.event")}</th>
                <th className="px-4 py-3 font-medium">{t("table.status")}</th>
                <th className="px-4 py-3 font-medium">{t("table.deadline")}</th>
                <th className="px-4 py-3 font-medium">{t("table.total")}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const supplierName = row.suppliers?.business_name ?? "—";
                const event = row.rfqs?.events ?? null;
                const total = getSnapshotTotal(
                  row.quote_revisions?.snapshot_jsonb,
                );
                return (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-muted)]/60"
                  >
                    <td className="px-4 py-3 font-medium">{supplierName}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{event?.city ?? "—"}</span>
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          {event?.starts_at
                            ? formatEventDate(event.starts_at, locale)
                            : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(
                          row.confirmation_status,
                        )}`}
                      >
                        {statusLabel(t, row.confirmation_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {formatDeadlineCell(t, row.confirm_deadline)}
                    </td>
                    <td className="px-4 py-3">
                      {total !== null ? formatHalalas(total) : "—"}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Link
                        href={`/organizer/bookings/${row.id}`}
                        className="text-sm text-[var(--color-sevent-green,#0a7)] hover:underline"
                      >
                        {t("table.view")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <Link
              href={{
                pathname: "/organizer/bookings",
                query: { status: filter, page: page - 1 },
              }}
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 hover:bg-[var(--color-muted)]"
            >
              {t("pagination.previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[var(--color-muted-foreground)]">
            {t("pagination.pageOf", { page, totalPages })}
          </span>
          {page < totalPages ? (
            <Link
              href={{
                pathname: "/organizer/bookings",
                query: { status: filter, page: page + 1 },
              }}
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 hover:bg-[var(--color-muted)]"
            >
              {t("pagination.next")}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
