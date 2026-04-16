import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { authenticateAndGetAdminClient } from "@/lib/supabase/server";

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

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function OrganizerEventsPage() {
  const t = await getTranslations("organizer.events");
  const eventFormT = await getTranslations("organizer.eventForm");

  const auth = await authenticateAndGetAdminClient();
  if (!auth) redirect("/sign-in?next=/organizer/events");
  const { user, admin } = auth;

  // Service-role + explicit organizer_id filter (SSR JWT-forwarding gap).
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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t("subtitle")}
          </p>
        </div>
        <Link
          href="/organizer/events/new"
          className="rounded-md bg-[var(--color-primary,#111)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {t("newEvent")}
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-6 text-sm text-[var(--color-muted-foreground)]">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("table.event")}</th>
                <th className="px-4 py-3 font-medium">{t("table.city")}</th>
                <th className="px-4 py-3 font-medium">{t("table.date")}</th>
                <th className="px-4 py-3 font-medium">{t("table.guests")}</th>
                <th className="px-4 py-3 font-medium">{t("table.rfqs")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[var(--color-border)] hover:bg-[var(--color-muted)]/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/organizer/events/${row.id}`}
                      className="flex flex-col"
                    >
                      <span className="font-medium">
                        {eventFormT(`eventType.${row.event_type}` as never)}
                      </span>
                      {row.client_name ? (
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          {row.client_name}
                        </span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.city}</td>
                  <td className="px-4 py-3">{formatDate(row.starts_at)}</td>
                  <td className="px-4 py-3">{row.guest_count ?? "—"}</td>
                  <td className="px-4 py-3">{row.rfqs?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
