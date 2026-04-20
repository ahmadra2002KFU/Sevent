import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/server";

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

export default async function OrganizerDashboardPage() {
  const t = await getTranslations("organizer.dashboard");
  const rfqT = await getTranslations("organizer.rfqs");
  const eventFormT = await getTranslations("organizer.eventForm");

  const gate = await requireRole(["organizer", "agency", "admin"]);
  if (gate.status === "unauthenticated") redirect("/sign-in?next=/organizer/dashboard");
  if (gate.status === "forbidden") redirect("/");
  const { user, admin } = gate;

  // Service-role reads with ownership enforced by organizer_id / event joins
  // (SSR JWT-forwarding gap — matches the rest of the organizer surface).
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
  const openRfqs = allRfqs.filter((r) => r.status === "sent").length;
  const awaitingQuotes = allRfqs.filter(
    (r) => r.status === "sent" || r.status === "draft",
  ).length;

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

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/organizer/events/new"
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-muted)]"
          >
            {t("newEvent")}
          </Link>
          <Link
            href="/organizer/rfqs/new"
            className="rounded-md bg-[var(--color-primary,#111)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            New RFQ
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("statTotalEvents")} value={totalEvents} href="/organizer/events" />
        <StatCard label={t("statOpenRfqs")} value={openRfqs} href="/organizer/rfqs" />
        <StatCard label={t("statAwaitingQuotes")} value={awaitingQuotes} href="/organizer/rfqs" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("latestRfqs")}</h2>
            <Link
              href="/organizer/rfqs"
              className="text-sm text-[var(--color-sevent-green,#0a7)] hover:underline"
            >
              {t("viewAll")}
            </Link>
          </div>
          {latest.length === 0 ? (
            <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
              No RFQs yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {latest.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/organizer/rfqs/${r.id}`}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-white px-4 py-3 text-sm transition hover:border-[var(--color-sevent-green)] hover:shadow-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {r.sub?.name_en ?? "RFQ"}
                      </span>
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        {r.events?.city ?? ""}
                        {" · "}
                        {r.rfq_invites?.length ?? 0} invites
                        {" · "}
                        {fmtDate(r.sent_at ?? r.created_at)}
                      </span>
                    </div>
                    <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium">
                      {rfqT(`status.${r.status}` as never)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Upcoming events</h2>
            <Link
              href="/organizer/events"
              className="text-sm text-[var(--color-sevent-green,#0a7)] hover:underline"
            >
              {t("viewAll")}
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
              {t("noEvents")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/organizer/events/${e.id}`}
                    className="flex flex-col rounded-md border border-[var(--color-border)] bg-white px-4 py-3 text-sm transition hover:border-[var(--color-sevent-green)] hover:shadow-sm"
                  >
                    <span className="font-medium">
                      {eventFormT(`eventType.${e.event_type}` as never)}
                      {e.client_name ? ` · ${e.client_name}` : ""}
                    </span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {e.city} · {fmtDate(e.starts_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-white p-5 transition hover:border-[var(--color-sevent-green)] hover:shadow-sm"
    >
      <span className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </span>
      <span className="text-3xl font-semibold">{value}</span>
    </Link>
  );
}
