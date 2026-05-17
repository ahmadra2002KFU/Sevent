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
import { MARKET_SEGMENTS, segmentNameFor } from "@/lib/domain/segments";
import { KSA_CITIES, cityNameFor } from "@/lib/domain/cities";
import { categoryName } from "@/lib/domain/taxonomy";
import {
  RFQ_STATUS_FILTERS,
  PUBLISHED_FILTERS,
  RfqFilters,
  type RfqFilterState,
  type RfqStatusFilter,
  type PublishedFilter,
} from "./_components/RfqFilters";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type AdminRfqListRow = {
  id: string;
  status: string;
  is_published_to_marketplace: boolean | null;
  sent_at: string | null;
  created_at: string;
  events: {
    id: string;
    city: string;
    event_type: string;
    starts_at: string;
    organizer_id: string;
  } | null;
  cat: { id: string; name_en: string; name_ar: string | null } | null;
  sub: { id: string; name_en: string; name_ar: string | null } | null;
};

function parseStatus(raw: string | undefined): RfqStatusFilter {
  const v = (raw ?? "all").toLowerCase();
  if ((RFQ_STATUS_FILTERS as readonly string[]).includes(v)) {
    return v as RfqStatusFilter;
  }
  return "all";
}

function parsePublished(raw: string | undefined): PublishedFilter {
  const v = (raw ?? "all").toLowerCase();
  if ((PUBLISHED_FILTERS as readonly string[]).includes(v)) {
    return v as PublishedFilter;
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

function rfqStatusPill(status: string): StatusPillStatus {
  switch (status) {
    case "draft":
    case "pending":
    case "sent":
    case "quoted":
    case "expired":
    case "booked":
    case "cancelled":
      return status as StatusPillStatus;
    default:
      return "pending";
  }
}

/**
 * Sanitize a free-text search term before splicing it into a PostgREST `or()`
 * filter. The library treats commas + parentheses as filter separators, so we
 * strip them. Length is capped to avoid pathological queries.
 */
function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()]/g, " ").trim().slice(0, 80);
}

/**
 * Maps a free-text search term (possibly localized Arabic / English display
 * name, or the raw slug itself) to the set of `event_type` and `city` slugs it
 * matches. PostgREST stores slugs only in those columns, so Arabic search
 * terms like "الرياض" would otherwise miss every row. We normalize both sides
 * to NFC + lower-case and do a substring match against the slug, the English
 * name, and the Arabic name from `MARKET_SEGMENTS` / `KSA_CITIES`.
 *
 * Returns:
 *   - `eventTypeSlugs`: segment slugs whose en/ar/slug contain the search term.
 *   - `citySlugs`: city slugs whose en/ar/slug contain the search term.
 */
function resolveSlugMatches(q: string): {
  eventTypeSlugs: string[];
  citySlugs: string[];
} {
  const needle = q.normalize("NFC").toLowerCase();
  const matches = (haystacks: ReadonlyArray<string | null | undefined>) =>
    haystacks.some((h) => {
      if (!h) return false;
      return h.normalize("NFC").toLowerCase().includes(needle);
    });
  const eventTypeSlugs = MARKET_SEGMENTS.filter((s) =>
    matches([s.slug, s.name_en, s.name_ar]),
  ).map((s) => s.slug);
  const citySlugs = KSA_CITIES.filter((c) =>
    matches([c.slug, c.name_en, c.name_ar]),
  ).map((c) => c.slug);
  return { eventTypeSlugs, citySlugs };
}

export default async function AdminRfqsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    published?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("admin.rfqs");
  const tPag = await getTranslations("pagination");

  const params = await searchParams;
  const filterState: RfqFilterState = {
    status: parseStatus(params.status),
    published: parsePublished(params.published),
    q: typeof params.q === "string" ? params.q : "",
    from: parseDateParam(params.from),
    to: parseDateParam(params.to),
  };
  const page = parsePage(params.page);

  const gate = await requireRole("admin");
  if (gate.status === "unauthenticated") {
    redirect(`/sign-in?next=${encodeURIComponent("/admin/rfqs")}`);
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

  // If the operator typed a search term, first resolve which event IDs match.
  // The search covers `events.event_type` + `events.city`. supabase-js doesn't
  // support cross-table OR filters in a single PostgREST request, so we do a
  // two-step lookup. The 500-cap matches the seeded data scale and avoids
  // unbounded `.in()` payloads.
  //
  // PostgREST stores slugs ("riyadh", "private_occasions"), not localized
  // labels. An Arabic operator searching "الرياض" would miss every row with a
  // raw ilike. So we normalize the term back to candidate slugs via the
  // bilingual constants (`MARKET_SEGMENTS`, `KSA_CITIES`) and OR those in
  // alongside the literal-pattern ilike that still catches operators who type
  // the slug or English label directly.
  let eventIdFilter: string[] | null = null;
  const q = sanitizeSearch(filterState.q);
  if (q.length > 0) {
    const pattern = `%${q}%`;
    const { eventTypeSlugs, citySlugs } = resolveSlugMatches(q);
    const orClauses: string[] = [
      `event_type.ilike.${pattern}`,
      `city.ilike.${pattern}`,
    ];
    if (eventTypeSlugs.length > 0) {
      orClauses.push(`event_type.in.(${eventTypeSlugs.join(",")})`);
    }
    if (citySlugs.length > 0) {
      orClauses.push(`city.in.(${citySlugs.join(",")})`);
    }
    const { data: eventRows } = await admin
      .from("events")
      .select("id")
      .or(orClauses.join(","))
      .limit(500);
    eventIdFilter = ((eventRows ?? []) as Array<{ id: string }>).map(
      (e) => e.id,
    );
    if (eventIdFilter.length === 0) {
      // Short-circuit: no events matched, so no RFQs can match.
      return renderEmptyState({
        t,
        filterState,
        page,
        totalPages: 1,
        tPag,
        rows: [],
      });
    }
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from("rfqs")
    .select(
      `id, status, is_published_to_marketplace, sent_at, created_at,
       events ( id, city, event_type, starts_at, organizer_id ),
       cat:categories!rfqs_category_id_fkey ( id, name_en, name_ar ),
       sub:categories!rfqs_subcategory_id_fkey ( id, name_en, name_ar )`,
      { count: "exact" },
    )
    .order("sent_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filterState.status !== "all") {
    query = query.eq("status", filterState.status);
  }
  if (filterState.published === "yes") {
    query = query.eq("is_published_to_marketplace", true);
  } else if (filterState.published === "no") {
    query = query.eq("is_published_to_marketplace", false);
  }
  if (filterState.from) {
    query = query.gte("created_at", `${filterState.from}T00:00:00Z`);
  }
  if (filterState.to) {
    query = query.lte("created_at", `${filterState.to}T23:59:59Z`);
  }
  if (eventIdFilter) {
    query = query.in("event_id", eventIdFilter);
  }

  const { data: rfqData, count } = await query;
  const rfqs = (rfqData ?? []) as unknown as AdminRfqListRow[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Resolve organizer names (one batch query keyed on distinct organizer_ids).
  const organizerIds = Array.from(
    new Set(
      rfqs
        .map((r) => r.events?.organizer_id ?? null)
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
      if (row.full_name) {
        organizerNameById.set(row.id, row.full_name);
      }
    }
  }

  // Invite + quote counts: two batch queries reduced into Maps client-side.
  const rfqIds = rfqs.map((r) => r.id);
  const inviteCountByRfq = new Map<string, number>();
  const quoteCountByRfq = new Map<string, number>();
  if (rfqIds.length > 0) {
    const [invitesRes, quotesRes] = await Promise.all([
      admin.from("rfq_invites").select("rfq_id").in("rfq_id", rfqIds),
      admin.from("quotes").select("rfq_id").in("rfq_id", rfqIds),
    ]);
    for (const row of (invitesRes.data ?? []) as Array<{ rfq_id: string }>) {
      inviteCountByRfq.set(
        row.rfq_id,
        (inviteCountByRfq.get(row.rfq_id) ?? 0) + 1,
      );
    }
    for (const row of (quotesRes.data ?? []) as Array<{ rfq_id: string }>) {
      quoteCountByRfq.set(
        row.rfq_id,
        (quoteCountByRfq.get(row.rfq_id) ?? 0) + 1,
      );
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <RfqFilters state={filterState} />

      {rfqs.length === 0 ? (
        <EmptyState icon={Inbox} title={t("list.empty")} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("list.col.event")}</TableHead>
                  <TableHead>{t("list.col.organizer")}</TableHead>
                  <TableHead>{t("list.col.category")}</TableHead>
                  <TableHead>{t("list.col.status")}</TableHead>
                  <TableHead className="text-end">
                    {t("list.col.invites")}
                  </TableHead>
                  <TableHead className="text-end">
                    {t("list.col.quotes")}
                  </TableHead>
                  <TableHead>{t("list.col.published")}</TableHead>
                  <TableHead>{t("list.col.sent")}</TableHead>
                  <TableHead className="text-end">
                    {t("list.col.action")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rfqs.map((r) => {
                  const eventType = r.events?.event_type
                    ? segmentNameFor(r.events.event_type, locale)
                    : "—";
                  const city = r.events?.city
                    ? cityNameFor(r.events.city, locale)
                    : "—";
                  const category = categoryName(r.cat, locale) || "—";
                  const subcategory = categoryName(r.sub, locale) || "—";
                  const organizerName =
                    (r.events?.organizer_id
                      ? organizerNameById.get(r.events.organizer_id)
                      : null) ?? t("list.organizerUnknown");
                  const invites = inviteCountByRfq.get(r.id) ?? 0;
                  const quotes = quoteCountByRfq.get(r.id) ?? 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/admin/rfqs/${r.id}`}
                          className="flex flex-col hover:underline"
                        >
                          <span className="font-medium text-foreground">
                            {eventType}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {city} · {fmtDate(r.events?.starts_at ?? null)}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {organizerName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {category}
                        {" · "}
                        {subcategory}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          status={rfqStatusPill(r.status)}
                          label={t(`status.${r.status}` as never)}
                        />
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {invites}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {quotes}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.is_published_to_marketplace
                          ? t("list.publishedYes")
                          : t("list.publishedNo")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDateTime(r.sent_at)}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/rfqs/${r.id}`}>
                            {t("list.viewDetail")}
                            <ArrowRight
                              aria-hidden
                              className="rtl:-scale-x-100"
                            />
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
        <Pagination
          page={page}
          totalPages={totalPages}
          filterState={filterState}
          tPag={tPag}
        />
      ) : null}
    </section>
  );
}

function Pagination({
  page,
  totalPages,
  filterState,
  tPag,
}: {
  page: number;
  totalPages: number;
  filterState: RfqFilterState;
  tPag: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const baseParams: Record<string, string> = {};
  if (filterState.status !== "all") baseParams.status = filterState.status;
  if (filterState.published !== "all")
    baseParams.published = filterState.published;
  if (filterState.q) baseParams.q = filterState.q;
  if (filterState.from) baseParams.from = filterState.from;
  if (filterState.to) baseParams.to = filterState.to;

  return (
    <nav
      aria-label={tPag("ariaLabel")}
      className="flex items-center justify-between gap-3 text-sm"
    >
      {page > 1 ? (
        <Button variant="outline" size="sm" asChild>
          <Link
            href={{
              pathname: "/admin/rfqs",
              query: { ...baseParams, page: page - 1 },
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
              pathname: "/admin/rfqs",
              query: { ...baseParams, page: page + 1 },
            }}
          >
            {tPag("next")}
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}

function renderEmptyState({
  t,
  filterState,
  page,
  totalPages,
  tPag,
  rows,
}: {
  t: Awaited<ReturnType<typeof getTranslations>>;
  filterState: RfqFilterState;
  page: number;
  totalPages: number;
  tPag: Awaited<ReturnType<typeof getTranslations>>;
  rows: AdminRfqListRow[];
}) {
  void rows;
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <RfqFilters state={filterState} />
      <EmptyState icon={Inbox} title={t("list.empty")} />
      {totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          filterState={filterState}
          tPag={tPag}
        />
      ) : null}
    </section>
  );
}
