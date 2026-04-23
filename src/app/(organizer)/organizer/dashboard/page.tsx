import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  CalendarDays,
  FileText,
  MailQuestion,
  Handshake,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { MetricCard } from "@/components/ui-ext/MetricCard";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { StatusPill, type StatusPillStatus } from "@/components/ui-ext/StatusPill";
import { requireAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

type DashboardRfq = {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  events: { id: string; city: string } | null;
  sub: { id: string; name_en: string } | null;
  rfq_invites: Array<{ id: string }>;
};

type UpcomingEvent = {
  id: string;
  event_type: string;
  client_name: string | null;
  city: string;
  starts_at: string;
  ends_at: string;
};

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

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

export default async function OrganizerDashboardPage() {
  const t = await getTranslations("organizer.dashboard");
  const rfqT = await getTranslations("organizer.rfqs");
  const eventFormT = await getTranslations("organizer.eventForm");

  const { user, admin } = await requireAccess("organizer.dashboard");

  const eventsCountRes = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("organizer_id", user.id);
  const totalEvents = eventsCountRes.count ?? 0;

  const { data: rfqStatusData } = await admin
    .from("rfqs")
    .select("id, status, events!inner(organizer_id)")
    .eq("events.organizer_id", user.id);
  const allRfqs = (rfqStatusData ?? []) as Array<{ id: string; status: string }>;
  const activeRfqs = allRfqs.filter(
    (r) => r.status === "sent" || r.status === "quoted",
  ).length;
  const awaitingQuotes = allRfqs.filter((r) => r.status === "sent").length;

  const confirmedRes = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("organizer_id", user.id)
    .eq("confirmation_status", "confirmed");
  const confirmedBookings = confirmedRes.count ?? 0;

  const { data: latestData } = await admin
    .from("rfqs")
    .select(
      `id, status, sent_at, created_at,
       events!inner ( id, city, organizer_id ),
       sub:categories!rfqs_subcategory_id_fkey ( id, name_en ),
       rfq_invites ( id )`,
    )
    .eq("events.organizer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);
  const latest = (latestData ?? []) as unknown as DashboardRfq[];

  const nowIso = new Date().toISOString();
  const { data: upcomingData } = await admin
    .from("events")
    .select("id, event_type, client_name, city, starts_at, ends_at")
    .eq("organizer_id", user.id)
    .gt("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(3);
  const upcoming = (upcomingData ?? []) as UpcomingEvent[];

  const hasAnyActivity = latest.length > 0 || upcoming.length > 0;

  return (
    <section className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <Button variant="outline" size="lg" asChild>
              <Link href="/organizer/events/new">
                <Plus aria-hidden />
                {t("newEvent")}
              </Link>
            </Button>
            <Button size="lg" asChild>
              <Link href="/organizer/rfqs/new">
                <Sparkles aria-hidden />
                {t("newRfq")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={CalendarDays}
          tone="info"
          label={t("statTotalEvents")}
          value={totalEvents}
          hint={t("statTotalEventsHint")}
        />
        <MetricCard
          icon={FileText}
          tone="info"
          label={t("statOpenRfqs")}
          value={activeRfqs}
          hint={t("statActiveRfqsHint")}
        />
        <MetricCard
          icon={MailQuestion}
          tone="warning"
          label={t("statAwaitingQuotes")}
          value={awaitingQuotes}
          hint={t("statAwaitingQuotesHint")}
        />
        <MetricCard
          icon={Handshake}
          tone="success"
          label={t("statConfirmedBookings")}
          value={confirmedBookings}
          hint={t("statConfirmedBookingsHint")}
        />
      </div>

      {!hasAnyActivity ? (
        <EmptyState
          icon={Sparkles}
          title={t("noEvents")}
          description={t("noRecentActivity")}
          action={
            <Button asChild>
              <Link href="/organizer/events/new">
                <Plus aria-hidden />
                {t("newEvent")}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-lg">{t("latestRfqs")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {latest.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  {t("noRecentActivity")}
                </p>
              ) : (
                <ul className="divide-y">
                  {latest.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/organizer/rfqs/${r.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                          <span className="truncate font-medium text-brand-navy-900">
                            {r.sub?.name_en ?? "RFQ"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {r.events?.city ? `${r.events.city} · ` : ""}
                            {t("invitesCount", {
                              count: r.rfq_invites?.length ?? 0,
                            })}
                            {" · "}
                            {fmtDate(r.sent_at ?? r.created_at)}
                          </span>
                        </div>
                        <StatusPill
                          status={toPillStatus(r.status)}
                          label={rfqT(`status.${r.status}` as never)}
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-lg">
                  {t("upcomingEvents")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {upcoming.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                    {t("noEvents")}
                  </p>
                ) : (
                  <ul className="divide-y">
                    {upcoming.map((e) => (
                      <li key={e.id}>
                        <Link
                          href={`/organizer/events/${e.id}`}
                          className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-cobalt-100 text-brand-cobalt-500">
                            <CalendarDays className="size-5" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-brand-navy-900">
                              {eventFormT(`eventType.${e.event_type}` as never)}
                              {e.client_name ? ` · ${e.client_name}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {e.city} · {fmtDate(e.starts_at)}
                            </p>
                          </div>
                          <ArrowRight
                            className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  {t("quickActions")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 px-4 pb-4">
                <Button variant="ghost" className="justify-start" asChild>
                  <Link href="/organizer/events">
                    <CalendarDays aria-hidden />
                    {t("viewAll")}
                  </Link>
                </Button>
                <Button variant="ghost" className="justify-start" asChild>
                  <Link href="/organizer/bookings">
                    <Handshake aria-hidden />
                    {t("bookings")}
                  </Link>
                </Button>
                <Button variant="ghost" className="justify-start" asChild>
                  <Link href="/organizer/notifications">
                    <MailQuestion aria-hidden />
                    {t("notifications")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
