import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { fmtDate, type SupportedLocale } from "@/lib/domain/formatDate";
import { segmentNameFor } from "@/lib/domain/segments";
import { cityNameFor } from "@/lib/domain/cities";
import { categoryName } from "@/lib/domain/taxonomy";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { requireAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

type RfqRow = {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  events: {
    id: string;
    event_type: string;
    client_name: string | null;
    starts_at: string;
    city: string;
  } | null;
  parent: {
    id: string;
    slug: string;
    name_en: string;
    name_ar: string | null;
  } | null;
  sub: {
    id: string;
    slug: string;
    name_en: string;
    name_ar: string | null;
  } | null;
  rfq_invites: Array<{
    id: string;
    response_due_at: string;
    status: string;
  }>;
};

function toPillStatus(raw: string): StatusPillStatus {
  const allowed: StatusPillStatus[] = [
    "draft",
    "pending",
    "sent",
    "quoted",
    "invited",
    "awaiting_supplier",
    "accepted",
    "confirmed",
    "booked",
    "approved",
    "paid",
    "completed",
    "declined",
    "rejected",
    "cancelled",
    "expired",
    "withdrawn",
  ];
  return (allowed as string[]).includes(raw)
    ? (raw as StatusPillStatus)
    : "draft";
}

function responseRate(
  invites: Array<{ status: string }>,
): { rate: number; responded: number; total: number } {
  const total = invites?.length ?? 0;
  if (total === 0) return { rate: 0, responded: 0, total: 0 };
  const responded = invites.filter(
    (i) => i.status === "quoted" || i.status === "declined",
  ).length;
  return { rate: Math.round((responded / total) * 100), responded, total };
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrganizerRfqsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("organizer.rfqs");
  const tPag = await getTranslations("pagination");

  const { user, admin } = await requireAccess("organizer.rfqs");

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await admin
    .from("rfqs")
    .select(
      `id, status, sent_at, created_at,
       events!inner ( id, event_type, client_name, starts_at, city, organizer_id ),
       parent:categories!rfqs_category_id_fkey ( id, slug, name_en, name_ar ),
       sub:categories!rfqs_subcategory_id_fkey ( id, slug, name_en, name_ar ),
       rfq_invites ( id, response_due_at, status )`,
      { count: "exact" },
    )
    .eq("events.organizer_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows = (data ?? []) as unknown as RfqRow[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fmt = (iso: string | null | undefined): string =>
    fmtDate(iso ?? null, locale) || "—";

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t("empty")}
          description={t("emptyDescription")}
          action={
            <Button asChild>
              <Link href="/organizer/events">{t("emptyAction")}</Link>
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">{t("table.subcategory")}</TableHead>
                <TableHead className="px-4">{t("table.event")}</TableHead>
                <TableHead className="px-4">{t("table.sentAt")}</TableHead>
                <TableHead className="px-4">{t("table.invites")}</TableHead>
                <TableHead className="px-4">
                  {t("table.responseRate")}
                </TableHead>
                <TableHead className="px-4">{t("table.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const rr = responseRate(row.rfq_invites ?? []);
                return (
                  <TableRow key={row.id} className="group">
                    <TableCell className="px-4 py-3">
                      <Link
                        href={`/organizer/rfqs/${row.id}`}
                        className="flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                      >
                        <span className="font-medium text-brand-navy-900 group-hover:text-brand-cobalt-500">
                          {categoryName(row.sub, locale) || "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {categoryName(row.parent, locale)}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {row.events
                            ? segmentNameFor(row.events.event_type, locale)
                            : "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row.events?.city
                            ? cityNameFor(row.events.city, locale)
                            : ""}
                          {row.events?.starts_at
                            ? ` · ${fmt(row.events.starts_at)}`
                            : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {fmt(row.sent_at ?? row.created_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-brand-cobalt-100 px-2.5 py-0.5 text-xs font-medium text-brand-cobalt-500">
                        {row.rfq_invites?.length ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200">
                          <div
                            className="h-full bg-brand-cobalt-500 transition-all"
                            style={{ width: `${rr.rate}%` }}
                            aria-hidden
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {rr.responded}/{rr.total}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusPill
                        status={toPillStatus(row.status)}
                        label={t(`status.${row.status}` as never)}
                      />
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
                  pathname: "/organizer/rfqs",
                  query: { page: page - 1 },
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
                  pathname: "/organizer/rfqs",
                  query: { page: page + 1 },
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
