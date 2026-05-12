import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Gavel } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  fmtDateTime as fmtDateTimeHelper,
  type SupportedLocale,
} from "@/lib/domain/formatDate";
import {
  DISPUTE_REASON_CODES,
  DISPUTE_STATUSES,
  type DisputeReasonCode,
  type DisputeStatus,
} from "@/lib/domain/disputes";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const STATUS_FILTERS = ["all", ...DISPUTE_STATUSES] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function parseStatus(raw: string | undefined): StatusFilter {
  const v = (raw ?? "all").toLowerCase();
  if ((STATUS_FILTERS as readonly string[]).includes(v)) {
    return v as StatusFilter;
  }
  return "all";
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

type DisputeListRow = {
  id: string;
  booking_id: string;
  raised_by: string;
  reason_code: string;
  status: DisputeStatus;
  opened_at: string;
  bookings: {
    id: string;
    organizer_id: string;
    supplier_id: string;
    suppliers: { id: string; business_name: string } | null;
  } | null;
};

export default async function AdminDisputesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("admin.disputes");
  const tStatuses = await getTranslations("admin.disputes.filter");
  const tReason = await getTranslations("disputes.reason");
  const tStatus = await getTranslations("disputes.status");

  const params = await searchParams;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);

  const gate = await requireRole("admin");
  if (gate.status === "unauthenticated") {
    redirect(`/sign-in?next=${encodeURIComponent("/admin/disputes")}`);
  }
  if (gate.status === "forbidden") {
    return (
      <section className="flex flex-col gap-3">
        <PageHeader title={t("title")} />
        <p className="text-sm text-semantic-danger-500">
          {t("errorAdminRequired")}
        </p>
      </section>
    );
  }
  const { admin } = gate;

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from("disputes")
    .select(
      `id, booking_id, raised_by, reason_code, status, opened_at,
       bookings ( id, organizer_id, supplier_id,
         suppliers ( id, business_name ) )`,
      { count: "exact" },
    )
    .order("opened_at", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as DisputeListRow[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Resolve raiser names in one batch.
  const raiserIds = Array.from(new Set(rows.map((r) => r.raised_by)));
  const nameById = new Map<string, string>();
  if (raiserIds.length > 0) {
    const { data: profileRows } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", raiserIds);
    for (const p of (profileRows ?? []) as Array<{
      id: string;
      full_name: string | null;
    }>) {
      if (p.full_name) nameById.set(p.id, p.full_name);
    }
  }

  const reasonLabel = (code: string): string => {
    if ((DISPUTE_REASON_CODES as readonly string[]).includes(code)) {
      const c = code as DisputeReasonCode;
      const key =
        c === "service_not_delivered"
          ? "serviceNotDelivered"
          : c === "service_below_spec"
            ? "serviceBelowSpec"
            : c === "no_show"
              ? "noShow"
              : c === "damaged_or_unsafe"
                ? "damagedOrUnsafe"
                : c === "billing_dispute"
                  ? "billingDispute"
                  : c === "schedule_conflict"
                    ? "scheduleConflict"
                    : "other";
      return tReason(key as never);
    }
    return code;
  };

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* Status filter chips. Plain links keep the page server-rendered. */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((s) => {
          const active = status === s;
          return (
            <Button
              key={s}
              asChild
              variant={active ? "default" : "outline"}
              size="sm"
            >
              <Link href={s === "all" ? "/admin/disputes" : `/admin/disputes?status=${s}`}>
                {tStatuses(s as never)}
              </Link>
            </Button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Gavel} title={t("list.empty")} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("list.col.booking")}</TableHead>
                  <TableHead>{t("list.col.raisedBy")}</TableHead>
                  <TableHead>{t("list.col.reason")}</TableHead>
                  <TableHead>{t("list.col.status")}</TableHead>
                  <TableHead>{t("list.col.opened")}</TableHead>
                  <TableHead className="text-end">
                    {t("list.col.action")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const supplierName =
                    r.bookings?.suppliers?.business_name ?? "—";
                  const raiserName = nameById.get(r.raised_by) ?? "—";
                  const isActive =
                    r.status === "open" || r.status === "investigating";
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/admin/disputes/${r.id}`}
                          className="flex flex-col hover:underline"
                        >
                          <span className="font-medium text-foreground">
                            {supplierName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {r.booking_id.slice(0, 8)}…
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {raiserName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {reasonLabel(r.reason_code)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isActive ? "destructive" : "secondary"}
                          className="capitalize"
                        >
                          {tStatus(r.status as never)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDateTimeHelper(r.opened_at, locale)}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/disputes/${r.id}`}>
                            {t("list.viewDetail")}
                            <ArrowRight aria-hidden className="rtl:-scale-x-100" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
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
                  pathname: "/admin/disputes",
                  query: { status, page: page - 1 },
                }}
              >
                ‹
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={{
                  pathname: "/admin/disputes",
                  query: { status, page: page + 1 },
                }}
              >
                ›
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
