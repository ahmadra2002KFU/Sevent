import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { authenticateAndGetAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

type RfqDetail = {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  requirements_jsonb: unknown;
  events: {
    id: string;
    event_type: string;
    client_name: string | null;
    city: string;
    starts_at: string;
    ends_at: string;
    guest_count: number | null;
  } | null;
  parent: { id: string; name_en: string } | null;
  sub: { id: string; name_en: string } | null;
};

type InviteDetail = {
  id: string;
  source: string;
  status: string;
  sent_at: string;
  response_due_at: string;
  responded_at: string | null;
  decline_reason_code: string | null;
  suppliers: { id: string; business_name: string; slug: string; base_city: string } | null;
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
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

function prettyRequirements(req: unknown): React.ReactNode {
  if (!req || typeof req !== "object") return <p className="text-sm">—</p>;
  const obj = req as Record<string, unknown>;
  const kind = typeof obj.kind === "string" ? obj.kind : "unknown";

  const rows: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key === "kind") continue;
    let display: string;
    if (Array.isArray(value)) {
      display = value.length === 0 ? "—" : value.join(", ");
    } else if (typeof value === "boolean") {
      display = value ? "Yes" : "No";
    } else if (value === null || value === undefined || value === "") {
      display = "—";
    } else {
      display = String(value);
    }
    rows.push([key, display]);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {kind}
      </p>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="text-xs text-[var(--color-muted-foreground)]">{k}</dt>
            <dd className="text-sm">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function OrganizerRfqDetailPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations("organizer.rfqs");
  const eventFormT = await getTranslations("organizer.eventForm");

  const auth = await authenticateAndGetAdminClient();
  if (!auth) redirect(`/sign-in?next=/organizer/rfqs/${id}`);
  const { user, admin } = auth;

  // Service-role read because @supabase/ssr + new key format doesn't forward
  // the user JWT reliably for RLS. Ownership is enforced in code below.
  const { data: rfqData } = await admin
    .from("rfqs")
    .select(
      `id, status, sent_at, created_at, requirements_jsonb,
       events ( id, event_type, client_name, city, starts_at, ends_at, guest_count, organizer_id ),
       parent:categories!rfqs_category_id_fkey ( id, name_en ),
       sub:categories!rfqs_subcategory_id_fkey ( id, name_en )`,
    )
    .eq("id", id)
    .maybeSingle();

  const rfq = rfqData as unknown as (RfqDetail & { events: RfqDetail["events"] & { organizer_id?: string } | null }) | null;
  if (!rfq) notFound();

  // Enforce ownership: only the organizer who owns the parent event, or an admin,
  // may view the RFQ. Admins get a free pass via their profile role lookup.
  const ownsEvent = rfq.events?.organizer_id === user.id;
  if (!ownsEvent) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role: string } | null)?.role;
    if (role !== "admin") notFound();
  }

  const { data: invitesData } = await admin
    .from("rfq_invites")
    .select(
      `id, source, status, sent_at, response_due_at, responded_at, decline_reason_code,
       suppliers ( id, business_name, slug, base_city )`,
    )
    .eq("rfq_id", id)
    .order("sent_at", { ascending: true });

  const invites = (invitesData ?? []) as unknown as InviteDetail[];

  // Count sent quotes so we can surface a "Compare quotes" CTA when there is
  // at least one. The comparison page itself is scoped to status='sent'.
  const { count: sentQuoteCount } = await admin
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("rfq_id", id)
    .eq("status", "sent");

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            RFQ detail
          </p>
          <h1 className="text-2xl font-semibold">
            {rfq.parent?.name_en ?? "RFQ"}
            {rfq.sub ? ` · ${rfq.sub.name_en}` : ""}
          </h1>
          {rfq.events ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {eventFormT(`eventType.${rfq.events.event_type}` as never)}
              {rfq.events.client_name ? ` · ${rfq.events.client_name}` : ""}
              {" · "}
              {rfq.events.city}
              {" · "}
              {fmt(rfq.events.starts_at)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sentQuoteCount && sentQuoteCount > 0 ? (
            <Link
              href={`/organizer/rfqs/${id}/quotes`}
              className="rounded-md bg-[var(--color-sevent-green,#0a7)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Compare quotes ({sentQuoteCount})
            </Link>
          ) : null}
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1 text-xs font-medium">
            {t(`status.${rfq.status}` as never)}
          </span>
        </div>
      </header>

      {rfq.events ? (
        <Link
          href={`/organizer/events/${rfq.events.id}`}
          className="w-fit text-sm text-[var(--color-sevent-green,#0a7)] hover:underline"
        >
          ← Back to event
        </Link>
      ) : null}

      <section className="rounded-lg border border-[var(--color-border)] bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">Requirements</h2>
        {prettyRequirements(rfq.requirements_jsonb)}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Invites</h2>
        {invites.length === 0 ? (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
            No invites sent yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-muted)] text-start text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Sent</th>
                  <th className="px-4 py-3 font-medium">Response due</th>
                  <th className="px-4 py-3 font-medium">Responded</th>
                  <th className="px-4 py-3 font-medium">Decline reason</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {inv.suppliers?.business_name ?? "—"}
                        </span>
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          {inv.suppliers?.base_city ?? ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {inv.source.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium">
                        {t(`inviteStatus.${inv.status}` as never)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{fmt(inv.sent_at)}</td>
                    <td className="px-4 py-3">{fmt(inv.response_due_at)}</td>
                    <td className="px-4 py-3">{fmt(inv.responded_at)}</td>
                    <td className="px-4 py-3">{inv.decline_reason_code ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
