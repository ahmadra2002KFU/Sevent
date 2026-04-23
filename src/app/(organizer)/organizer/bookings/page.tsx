import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarCheck, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui-ext/EmptyState";
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

  const { admin, user } = await requireAccess("organizer.bookings");

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
      <PageHeader title={t("listTitle")} description={t("listIntro")} />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="status"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {t("filterLabel")}
          </label>
          <Select name="status" defaultValue={filter}>
            <SelectTrigger id="status" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterAll")}</SelectItem>
              <SelectItem value="awaiting_supplier">
                {t("statusAwaitingSupplier")}
              </SelectItem>
              <SelectItem value="confirmed">
                {t("statusConfirmed")}
              </SelectItem>
              <SelectItem value="cancelled">
                {t("statusCancelled")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="outline">
          {t("filterLabel")}
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title={t("noBookings")}
          description={t("listIntro")}
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">
                  {t("table.supplier")}
                </TableHead>
                <TableHead className="px-4">{t("table.event")}</TableHead>
                <TableHead className="px-4">{t("table.status")}</TableHead>
                <TableHead className="px-4">
                  {t("table.deadline")}
                </TableHead>
                <TableHead className="px-4 text-end">
                  {t("table.total")}
                </TableHead>
                <TableHead className="px-4 text-end" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const supplierName = row.suppliers?.business_name ?? "—";
                const event = row.rfqs?.events ?? null;
                const total = getSnapshotTotal(
                  row.quote_revisions?.snapshot_jsonb,
                );
                return (
                  <TableRow key={row.id}>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-cobalt-100 text-brand-cobalt-500">
                          <CalendarCheck
                            className="size-4"
                            aria-hidden
                          />
                        </div>
                        <span className="font-medium text-brand-navy-900">
                          {supplierName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {event?.city ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {event?.starts_at
                            ? formatEventDate(event.starts_at, locale)
                            : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusPill
                        status={confirmationToPill(row.confirmation_status)}
                        label={statusLabel(t, row.confirmation_status)}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDeadlineCell(t, row.confirm_deadline)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-end font-semibold tabular-nums text-brand-navy-900">
                      {total !== null ? formatHalalas(total) : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-end">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/organizer/bookings/${row.id}`}>
                          {t("table.view")}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between gap-3 text-sm"
        >
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={{
                  pathname: "/organizer/bookings",
                  query: { status: filter, page: page - 1 },
                }}
              >
                {t("pagination.previous")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            {t("pagination.pageOf", { page, totalPages })}
          </span>
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={{
                  pathname: "/organizer/bookings",
                  query: { status: filter, page: page + 1 },
                }}
              >
                {t("pagination.next")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
