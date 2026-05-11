import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, FileText } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { StatusPill } from "@/components/ui-ext/StatusPill";
import type { StatusPillStatus } from "@/components/ui-ext/StatusPill";
import {
  fmtDateTime as fmtDateTimeHelper,
  type SupportedLocale,
} from "@/lib/domain/formatDate";
import { segmentNameFor } from "@/lib/domain/segments";
import { cityNameFor } from "@/lib/domain/cities";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const STATUS_FILTERS = ["all", "pending", "fulfilled", "cancelled"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

type Row = {
  id: string;
  status: string;
  message: string | null;
  response_file_path: string | null;
  requested_at: string;
  responded_at: string | null;
  requested_by: string;
  quote_id: string;
  quotes: {
    id: string;
    rfq_id: string;
    supplier_id: string;
    suppliers: { id: string; business_name: string } | null;
    rfqs: {
      id: string;
      events: {
        organizer_id: string;
        event_type: string;
        city: string;
      } | null;
    } | null;
  } | null;
};

function parseStatus(raw: string | undefined): StatusFilter {
  const v = (raw ?? "all").toLowerCase();
  if ((STATUS_FILTERS as readonly string[]).includes(v)) {
    return v as StatusFilter;
  }
  return "all";
}
function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}
function statusPill(status: string): StatusPillStatus {
  switch (status) {
    case "pending":
    case "cancelled":
      return status as StatusPillStatus;
    case "fulfilled":
      return "completed";
    default:
      return "pending";
  }
}

export default async function AdminProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("admin.proposals");
  const tFilter = await getTranslations("admin.proposals.filter");
  const tPag = await getTranslations("pagination");

  const params = await searchParams;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);

  const gate = await requireRole("admin");
  if (gate.status === "unauthenticated") {
    redirect(`/sign-in?next=${encodeURIComponent("/admin/proposals")}`);
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

  const fmtDateTime = (iso: string | null): string =>
    fmtDateTimeHelper(iso, locale) || "—";

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from("quote_proposal_requests")
    .select(
      `id, status, message, response_file_path, requested_at, responded_at,
       requested_by, quote_id,
       quotes!inner (
         id, rfq_id, supplier_id,
         suppliers ( id, business_name ),
         rfqs!inner (
           id,
           events!inner ( organizer_id, event_type, city )
         )
       )`,
      { count: "exact" },
    )
    .order("requested_at", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Resolve requester (organizer) display names. Even though we already have
  // organizer_id via the event, the row's `requested_by` is the actual actor
  // — could be an agency user on the organizer's behalf in future. Use this
  // for accurate attribution.
  const requesterIds = Array.from(new Set(rows.map((r) => r.requested_by)));
  const requesterNameById = new Map<string, string>();
  if (requesterIds.length > 0) {
    const { data: profRows } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", requesterIds);
    for (const row of (profRows ?? []) as Array<{
      id: string;
      full_name: string | null;
    }>) {
      if (row.full_name) requesterNameById.set(row.id, row.full_name);
    }
  }

  // Sign URLs for fulfilled rows only (300s TTL — matches the existing
  // doc-preview path under supplier-docs/{supplier_id}/proposal-responses/...).
  const signedByRowId = new Map<string, string>();
  const fulfilled = rows.filter(
    (r) => r.status === "fulfilled" && r.response_file_path,
  );
  if (fulfilled.length > 0) {
    const results = await Promise.all(
      fulfilled.map(async (r) => {
        try {
          const { data: signed } = await admin.storage
            .from(STORAGE_BUCKETS.docs)
            .createSignedUrl(r.response_file_path as string, 300);
          return { id: r.id, url: signed?.signedUrl ?? null };
        } catch {
          return { id: r.id, url: null };
        }
      }),
    );
    for (const r of results) {
      if (r.url) signedByRowId.set(r.id, r.url);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* Status pills */}
      <nav
        aria-label={tFilter("all")}
        className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1"
      >
        {STATUS_FILTERS.map((key) => {
          const active = key === status;
          const params = new URLSearchParams();
          if (key !== "all") params.set("status", key);
          const href = params.toString()
            ? `/admin/proposals?${params.toString()}`
            : "/admin/proposals";
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tFilter(key)}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <EmptyState icon={FileText} title={t("list.empty")} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("list.col.organizer")}</TableHead>
                  <TableHead>{t("list.col.supplier")}</TableHead>
                  <TableHead>{t("list.col.event")}</TableHead>
                  <TableHead>{t("list.col.status")}</TableHead>
                  <TableHead>{t("list.col.requested")}</TableHead>
                  <TableHead>{t("list.col.responded")}</TableHead>
                  <TableHead>{t("list.col.file")}</TableHead>
                  <TableHead className="text-end">
                    {t("list.col.action")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const quote = r.quotes;
                  const rfq = quote?.rfqs;
                  const event = rfq?.events;
                  const url = signedByRowId.get(r.id) ?? null;
                  const requesterName =
                    requesterNameById.get(r.requested_by) ?? "—";
                  const eventType = event?.event_type
                    ? segmentNameFor(event.event_type, locale)
                    : "—";
                  const city = event?.city
                    ? cityNameFor(event.city, locale)
                    : "—";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-foreground">
                        {requesterName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {quote?.suppliers?.business_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {eventType} · {city}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          status={statusPill(r.status)}
                          label={t(`status.${r.status}` as never)}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDateTime(r.requested_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDateTime(r.responded_at)}
                      </TableCell>
                      <TableCell>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-cobalt-500 hover:underline"
                          >
                            {t("list.openFile")}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t("list.noFile")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        {rfq?.id ? (
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              href={`/admin/rfqs/${rfq.id}#quote-${quote?.id}`}
                            >
                              {t("list.viewRfq")}
                              <ArrowRight
                                aria-hidden
                                className="rtl:-scale-x-100"
                              />
                            </Link>
                          </Button>
                        ) : null}
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
                  pathname: "/admin/proposals",
                  query:
                    status !== "all"
                      ? { status, page: page - 1 }
                      : { page: page - 1 },
                }}
              >
                {tPag("previous")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            {tPag("pageOf", { page, totalPages })}
          </span>
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={{
                  pathname: "/admin/proposals",
                  query:
                    status !== "all"
                      ? { status, page: page + 1 }
                      : { page: page + 1 },
                }}
              >
                {tPag("next")}
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
