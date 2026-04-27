import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarPlus, CalendarDays, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fmtDate, type SupportedLocale } from "@/lib/domain/formatDate";
import { segmentNameFor } from "@/lib/domain/segments";
import { cityNameFor } from "@/lib/domain/cities";
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
import { requireAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

type EventListRow = {
  id: string;
  event_type: string;
  client_name: string | null;
  city: string;
  starts_at: string;
  ends_at: string;
  guest_count: number | null;
  rfqs: Array<{ id: string }>;
};

function formatDateRange(
  starts: string,
  ends: string,
  locale: SupportedLocale,
): string {
  try {
    const s = new Date(starts);
    const e = new Date(ends);
    const sameDay =
      s.getFullYear() === e.getFullYear() &&
      s.getMonth() === e.getMonth() &&
      s.getDate() === e.getDate();
    return sameDay
      ? fmtDate(starts, locale)
      : `${fmtDate(starts, locale)} → ${fmtDate(ends, locale)}`;
  } catch {
    return starts;
  }
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrganizerEventsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("organizer.events");
  const tPag = await getTranslations("pagination");

  const { user, admin } = await requireAccess("organizer.events");

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await admin
    .from("events")
    .select(
      "id, event_type, client_name, city, starts_at, ends_at, guest_count, rfqs(id)",
      { count: "exact" },
    )
    .eq("organizer_id", user.id)
    .order("starts_at", { ascending: false })
    .range(from, to);

  const rows = (data ?? []) as unknown as EventListRow[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button size="lg" asChild>
            <Link href="/organizer/events/new">
              <CalendarPlus aria-hidden />
              {t("newEvent")}
            </Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t("empty")}
          description={t("emptyDescription")}
          action={
            <Button asChild>
              <Link href="/organizer/events/new">
                <CalendarPlus aria-hidden />
                {t("createFirst")}
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">{t("table.event")}</TableHead>
                <TableHead className="px-4">{t("table.city")}</TableHead>
                <TableHead className="px-4">{t("table.date")}</TableHead>
                <TableHead className="px-4">{t("table.guests")}</TableHead>
                <TableHead className="px-4">{t("table.rfqs")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="group">
                  <TableCell className="px-4 py-3">
                    <Link
                      href={`/organizer/events/${row.id}`}
                      className="flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                    >
                      <span className="font-medium text-brand-navy-900 group-hover:text-brand-cobalt-500">
                        {segmentNameFor(row.event_type, locale)}
                      </span>
                      {row.client_name ? (
                        <span className="text-xs text-muted-foreground">
                          {row.client_name}
                        </span>
                      ) : null}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <MapPin
                        className="size-3.5 text-muted-foreground"
                        aria-hidden
                      />
                      {cityNameFor(row.city, locale)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm">
                    {formatDateRange(row.starts_at, row.ends_at, locale)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {row.guest_count ? (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <Users
                          className="size-3.5 text-muted-foreground"
                          aria-hidden
                        />
                        {row.guest_count}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-brand-cobalt-100 px-2.5 py-0.5 text-xs font-medium text-brand-cobalt-500">
                      {row.rfqs?.length ?? 0}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
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
                  pathname: "/organizer/events",
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
                  pathname: "/organizer/events",
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
