import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { authenticateAndGetAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
  parent: { id: string; slug: string; name_en: string } | null;
  sub: { id: string; slug: string; name_en: string } | null;
  rfq_invites: Array<{ id: string; response_due_at: string }>;
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
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

export default async function OrganizerRfqsPage() {
  const t = await getTranslations("organizer.rfqs");
  const eventFormT = await getTranslations("organizer.eventForm");

  const auth = await authenticateAndGetAdminClient();
  if (!auth) redirect("/sign-in?next=/organizer/rfqs");
  const { user, admin } = auth;

  // Service-role read because of the @supabase/ssr JWT-forwarding gap;
  // scope ownership by filtering on events.organizer_id = user.id.
  const { data } = await admin
    .from("rfqs")
    .select(
      `id, status, sent_at, created_at,
       events!inner ( id, event_type, client_name, starts_at, city, organizer_id ),
       parent:categories!rfqs_category_id_fkey ( id, slug, name_en ),
       sub:categories!rfqs_subcategory_id_fkey ( id, slug, name_en ),
       rfq_invites ( id, response_due_at )`,
    )
    .eq("events.organizer_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as RfqRow[];

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
          href="/organizer/rfqs/new"
          className="rounded-md bg-[var(--color-primary,#111)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          New RFQ
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
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Invites</th>
                <th className="px-4 py-3 font-medium">Response due</th>
                <th className="px-4 py-3 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const dueAt = row.rfq_invites?.[0]?.response_due_at ?? null;
                return (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-muted)]/60"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/organizer/rfqs/${row.id}`} className="flex flex-col">
                        <span className="font-medium">
                          {row.events
                            ? eventFormT(
                                `eventType.${row.events.event_type}` as never,
                              )
                            : "—"}
                        </span>
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          {row.events ? fmtDate(row.events.starts_at) : ""}
                          {row.events?.city ? ` · ${row.events.city}` : ""}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {row.parent?.name_en ?? "—"}
                        </span>
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          {row.sub?.name_en ?? ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1 text-xs font-medium">
                        {t(`status.${row.status}` as never)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.rfq_invites?.length ?? 0}</td>
                    <td className="px-4 py-3">{fmtDate(dueAt)}</td>
                    <td className="px-4 py-3">{fmtDate(row.sent_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
