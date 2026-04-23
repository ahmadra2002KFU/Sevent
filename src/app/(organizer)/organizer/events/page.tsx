import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarPlus, CalendarDays, MapPin, Users } from "lucide-react";
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
import { requireAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

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

function formatDateRange(starts: string, ends: string): string {
  try {
    const startFormatter = new Intl.DateTimeFormat("en-SA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const endFormatter = new Intl.DateTimeFormat("en-SA", {
      month: "short",
      day: "numeric",
    });
    const s = new Date(starts);
    const e = new Date(ends);
    const sameDay =
      s.getFullYear() === e.getFullYear() &&
      s.getMonth() === e.getMonth() &&
      s.getDate() === e.getDate();
    return sameDay
      ? startFormatter.format(s)
      : `${endFormatter.format(s)} → ${startFormatter.format(e)}`;
  } catch {
    return starts;
  }
}

export default async function OrganizerEventsPage() {
  const t = await getTranslations("organizer.events");
  const eventFormT = await getTranslations("organizer.eventForm");

  const { user, admin } = await requireAccess("organizer.events");

  const { data } = await admin
    .from("events")
    .select(
      "id, event_type, client_name, city, starts_at, ends_at, guest_count, rfqs(id)",
    )
    .eq("organizer_id", user.id)
    .order("starts_at", { ascending: false });

  const rows = (data ?? []) as unknown as EventListRow[];

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
                        {eventFormT(`eventType.${row.event_type}` as never)}
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
                      {row.city}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm">
                    {formatDateRange(row.starts_at, row.ends_at)}
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
    </section>
  );
}
