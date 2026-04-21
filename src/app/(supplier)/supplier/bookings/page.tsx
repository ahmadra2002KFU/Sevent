import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import {
  formatConfirmDeadline,
  type ConfirmationStatus,
} from "@/lib/domain/booking";
import { formatHalalas } from "@/lib/domain/money";
import type { QuoteSnapshot } from "@/lib/domain/quote";
import { requireRole } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  profiles: { id: string; full_name: string | null } | null;
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

export default async function SupplierBookingsListPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const filter = parseFilter(params.status);
  const page = parsePage(params.page);
  const locale = await getLocale();

  const t = await getTranslations("booking");

  const gate = await requireRole("supplier");
  if (gate.status === "unauthenticated") redirect("/sign-in?next=/supplier/bookings");
  if (gate.status === "forbidden") redirect("/");
  const { admin, user } = gate;

  // Resolve supplier_id (suppliers.profile_id = user.id), then filter bookings
  // by that supplier_id. Service-role bypasses RLS; these explicit filters ARE
  // the security boundary.
  const { data: supplierRow } = await admin
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!supplierRow) {
    return (
      <section className="flex flex-col gap-6">
        <PageHeader title={t("listTitle")} description={t("listIntro")} />
        <EmptyState icon={ClipboardList} title={t("noBookings")} />
      </section>
    );
  }

  const supplierId = (supplierRow as { id: string }).id;

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from("bookings")
    .select(
      `id, confirmation_status, confirm_deadline, created_at,
       profiles:organizer_id ( id, full_name ),
       rfqs ( id, events ( id, city, starts_at ) ),
       quote_revisions:accepted_quote_revision_id ( id, snapshot_jsonb )`,
      { count: "exact" },
    )
    .eq("supplier_id", supplierId)
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

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
      >
        <Label className="flex flex-col items-start gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("filterLabel")}
          <select
            name="status"
            defaultValue={filter}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground shadow-sm focus:outline-none focus:ring-3 focus:ring-ring/50"
          >
            <option value="all">{t("filterAll")}</option>
            <option value="awaiting_supplier">
              {t("statusAwaitingSupplier")}
            </option>
            <option value="confirmed">{t("statusConfirmed")}</option>
            <option value="cancelled">{t("statusCancelled")}</option>
          </select>
        </Label>
        <Button type="submit" variant="outline">
          {t("filterLabel")}
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t("noBookings")} />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>{t("table.organizer")}</TableHead>
                <TableHead>{t("table.event")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead>{t("table.deadline")}</TableHead>
                <TableHead>{t("table.total")}</TableHead>
                <TableHead aria-hidden />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const organizerName = row.profiles?.full_name ?? "—";
                const event = row.rfqs?.events ?? null;
                const total = getSnapshotTotal(
                  row.quote_revisions?.snapshot_jsonb,
                );
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-brand-navy-900">
                      {organizerName}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {event?.city ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {event?.starts_at
                            ? formatEventDate(event.starts_at, locale)
                            : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {statusPillFor(t, row.confirmation_status)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDeadlineCell(t, row.confirm_deadline)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {total !== null ? formatHalalas(total) : "—"}
                    </TableCell>
                    <TableCell className="text-end">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/supplier/bookings/${row.id}`}>
                          {t("table.view")}
                          <ArrowUpRight />
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
        <nav className="flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={{
                  pathname: "/supplier/bookings",
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
            <Button asChild variant="outline" size="sm">
              <Link
                href={{
                  pathname: "/supplier/bookings",
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
