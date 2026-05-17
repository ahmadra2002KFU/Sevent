import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Inbox } from "lucide-react";
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
  fmtDate as fmtDateHelper,
  fmtDateTime as fmtDateTimeHelper,
  type SupportedLocale,
} from "@/lib/domain/formatDate";
import {
  inviteDisplayStatus,
  type RfqInviteSource,
  type RfqInviteStatus,
} from "@/lib/domain/rfq";
import { segmentNameFor } from "@/lib/domain/segments";
import { cityNameFor } from "@/lib/domain/cities";
import { categoryName } from "@/lib/domain/taxonomy";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const SOURCE_FILTERS = [
  "all",
  "auto_match",
  "organizer_picked",
  "self_applied",
] as const;
type SourceFilter = (typeof SOURCE_FILTERS)[number];

const STATUS_FILTERS = [
  "all",
  "invited",
  "declined",
  "quoted",
  "withdrawn",
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

type FilterState = {
  source: SourceFilter;
  status: StatusFilter;
  from: string;
  to: string;
};

type ApplicationRow = {
  id: string;
  source: string;
  status: string;
  sent_at: string | null;
  response_due_at: string | null;
  responded_at: string | null;
  suppliers: {
    id: string;
    business_name: string;
    base_city: string | null;
    verification_status: string;
  } | null;
  rfqs: {
    id: string;
    status: string;
    is_published_to_marketplace: boolean | null;
    events: {
      id: string;
      event_type: string;
      city: string;
      starts_at: string;
      organizer_id: string;
    } | null;
    cat: { id: string; name_en: string; name_ar: string | null } | null;
  } | null;
};

function parseSource(raw: string | undefined): SourceFilter {
  const v = (raw ?? "all").toLowerCase();
  if ((SOURCE_FILTERS as readonly string[]).includes(v)) {
    return v as SourceFilter;
  }
  return "all";
}
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

/**
 * Validates a YYYY-MM-DD date string from a search param. Returns `""` for
 * anything malformed so PostgREST never sees `?from=abc` (which would error
 * the query and silently render an empty page). open-review flag, 2026-05-11.
 */
function parseDateParam(raw: unknown): string {
  if (typeof raw !== "string") return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return raw;
}
function statusPill(status: string): StatusPillStatus {
  switch (status) {
    case "invited":
    case "applied":
    case "declined":
    case "quoted":
    case "withdrawn":
      return status as StatusPillStatus;
    default:
      return "pending";
  }
}

function buildHref(state: FilterState, overrides: Partial<FilterState>): string {
  const merged = { ...state, ...overrides };
  const params = new URLSearchParams();
  if (merged.source !== "all") params.set("source", merged.source);
  if (merged.status !== "all") params.set("status", merged.status);
  if (merged.from) params.set("from", merged.from);
  if (merged.to) params.set("to", merged.to);
  const qs = params.toString();
  return qs ? `/admin/applications?${qs}` : "/admin/applications";
}

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("admin.applications");
  const tFilter = await getTranslations("admin.applications.filter");
  const tRfq = await getTranslations("admin.rfqs");
  const tPag = await getTranslations("pagination");

  const params = await searchParams;
  const state: FilterState = {
    source: parseSource(params.source),
    status: parseStatus(params.status),
    from: parseDateParam(params.from),
    to: parseDateParam(params.to),
  };
  const page = parsePage(params.page);

  const gate = await requireRole("admin");
  if (gate.status === "unauthenticated") {
    redirect(`/sign-in?next=${encodeURIComponent("/admin/applications")}`);
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

  const fmtDate = (iso: string | null): string =>
    fmtDateHelper(iso, locale) || "—";
  const fmtDateTime = (iso: string | null): string =>
    fmtDateTimeHelper(iso, locale) || "—";

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from("rfq_invites")
    .select(
      `id, source, status, sent_at, response_due_at, responded_at,
       suppliers!inner ( id, business_name, base_city, verification_status ),
       rfqs!inner ( id, status, is_published_to_marketplace,
                    events!inner ( id, event_type, city, starts_at, organizer_id ),
                    cat:categories!rfqs_category_id_fkey ( id, name_en, name_ar ) )`,
      { count: "exact" },
    )
    .order("sent_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (state.source !== "all") {
    query = query.eq("source", state.source);
  }
  if (state.status !== "all") {
    query = query.eq("status", state.status);
  }
  if (state.from) {
    query = query.gte("sent_at", `${state.from}T00:00:00Z`);
  }
  if (state.to) {
    query = query.lte("sent_at", `${state.to}T23:59:59Z`);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as ApplicationRow[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Organizer names (one batched lookup over distinct organizer_ids).
  const organizerIds = Array.from(
    new Set(
      rows
        .map((r) => r.rfqs?.events?.organizer_id ?? null)
        .filter((x): x is string => x !== null),
    ),
  );
  const organizerNameById = new Map<string, string>();
  if (organizerIds.length > 0) {
    const { data: orgRows } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", organizerIds);
    for (const row of (orgRows ?? []) as Array<{
      id: string;
      full_name: string | null;
    }>) {
      if (row.full_name) organizerNameById.set(row.id, row.full_name);
    }
  }

  // Quote lookup keyed on (rfq_id, supplier_id) so each row can deep-link to
  // its quote anchor (or show "no quote yet"). Constrain by BOTH the visible
  // rfq_ids AND supplier_ids — without the supplier constraint a popular RFQ
  // would pull every quote on it even when only one (rfq, supplier) pair is
  // visible on the page (open-review flag, 2026-05-11).
  const rfqIds = Array.from(
    new Set(
      rows
        .map((r) => r.rfqs?.id ?? null)
        .filter((x): x is string => x !== null),
    ),
  );
  const supplierIdsForQuotes = Array.from(
    new Set(
      rows
        .map((r) => r.suppliers?.id ?? null)
        .filter((x): x is string => x !== null),
    ),
  );
  const quoteByPair = new Map<string, { id: string; status: string }>();
  if (rfqIds.length > 0 && supplierIdsForQuotes.length > 0) {
    const { data: quoteRows } = await admin
      .from("quotes")
      .select("id, rfq_id, supplier_id, status")
      .in("rfq_id", rfqIds)
      .in("supplier_id", supplierIdsForQuotes);
    for (const row of (quoteRows ?? []) as Array<{
      id: string;
      rfq_id: string;
      supplier_id: string;
      status: string;
    }>) {
      quoteByPair.set(`${row.rfq_id}|${row.supplier_id}`, {
        id: row.id,
        status: row.status,
      });
    }
  }

  const FilterPill = ({
    active,
    href,
    children,
  }: {
    active: boolean;
    href: string;
    children: React.ReactNode;
  }) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* Source pills */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          {tFilter("sourceLabel")}
        </span>
        <nav
          aria-label={tFilter("sourceLabel")}
          className="inline-flex w-fit flex-wrap items-center gap-1 rounded-lg bg-muted p-1"
        >
          {SOURCE_FILTERS.map((key) => {
            const labelKey =
              key === "all" ? "sourceAll" : (`source_${key}` as const);
            return (
              <FilterPill
                key={key}
                active={key === state.source}
                href={buildHref(state, { source: key })}
              >
                {tFilter(labelKey)}
              </FilterPill>
            );
          })}
        </nav>
      </div>

      {/* Status pills */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          {tFilter("statusLabel")}
        </span>
        <nav
          aria-label={tFilter("statusLabel")}
          className="inline-flex w-fit flex-wrap items-center gap-1 rounded-lg bg-muted p-1"
        >
          {STATUS_FILTERS.map((key) => {
            const labelKey =
              key === "all" ? "statusAll" : (`status_${key}` as const);
            return (
              <FilterPill
                key={key}
                active={key === state.status}
                href={buildHref(state, { status: key })}
              >
                {tFilter(labelKey)}
              </FilterPill>
            );
          })}
        </nav>
      </div>

      {/* Date range */}
      <form
        method="get"
        action="/admin/applications"
        className="flex flex-wrap items-end gap-3 text-sm"
      >
        {state.source !== "all" ? (
          <input type="hidden" name="source" value={state.source} />
        ) : null}
        {state.status !== "all" ? (
          <input type="hidden" name="status" value={state.status} />
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {tFilter("dateFrom")}
          </span>
          <input
            type="date"
            name="from"
            defaultValue={state.from}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {tFilter("dateTo")}
          </span>
          <input
            type="date"
            name="to"
            defaultValue={state.to}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
        >
          {tRfq("search.submit")}
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={Inbox} title={t("list.empty")} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("list.col.supplier")}</TableHead>
                  <TableHead>{t("list.col.opportunity")}</TableHead>
                  <TableHead>{t("list.col.source")}</TableHead>
                  <TableHead>{t("list.col.status")}</TableHead>
                  <TableHead>{t("list.col.applied")}</TableHead>
                  <TableHead>{t("list.col.due")}</TableHead>
                  <TableHead>{t("list.col.quote")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const event = r.rfqs?.events;
                  const supplier = r.suppliers;
                  const rfq = r.rfqs;
                  const eventType = event?.event_type
                    ? segmentNameFor(event.event_type, locale)
                    : "—";
                  const city = event?.city
                    ? cityNameFor(event.city, locale)
                    : "—";
                  const category = categoryName(rfq?.cat ?? null, locale) || "—";
                  const organizerName =
                    (event?.organizer_id
                      ? organizerNameById.get(event.organizer_id)
                      : null) ?? tRfq("list.organizerUnknown");
                  const quote =
                    rfq && supplier
                      ? quoteByPair.get(`${rfq.id}|${supplier.id}`)
                      : undefined;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {supplier?.business_name ?? "—"}
                          </span>
                          {supplier?.base_city ? (
                            <span className="text-xs text-muted-foreground">
                              {cityNameFor(supplier.base_city, locale)}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {rfq ? (
                          <Link
                            href={`/admin/rfqs/${rfq.id}`}
                            className="flex flex-col hover:underline"
                          >
                            <span className="text-sm text-foreground">
                              {eventType} · {city}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {category} · {organizerName}
                              {event?.starts_at
                                ? ` · ${fmtDate(event.starts_at)}`
                                : null}
                            </span>
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tFilter(`source_${r.source as never}` as never)}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const displayStatus = inviteDisplayStatus(
                            r.status as RfqInviteStatus,
                            r.source as RfqInviteSource,
                          );
                          return (
                            <StatusPill
                              status={statusPill(displayStatus)}
                              label={tRfq(
                                `inviteStatus.${displayStatus}` as never,
                              )}
                            />
                          );
                        })()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDateTime(r.sent_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDateTime(r.response_due_at)}
                      </TableCell>
                      <TableCell>
                        {quote && rfq ? (
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              href={`/admin/rfqs/${rfq.id}#quote-${quote.id}`}
                            >
                              {t("list.viewQuote")}
                              <ArrowRight
                                aria-hidden
                                className="rtl:-scale-x-100"
                              />
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t("list.noQuote")}
                          </span>
                        )}
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
              <Link href={`${buildHref(state, {})}${buildHref(state, {}).includes("?") ? "&" : "?"}page=${page - 1}`}>
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
              <Link href={`${buildHref(state, {})}${buildHref(state, {}).includes("?") ? "&" : "?"}page=${page + 1}`}>
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
