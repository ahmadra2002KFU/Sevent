import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const supabase = await createSupabaseServerClient();

  const { data: rfqData } = await supabase
    .from("rfqs")
    .select(
      `id, status, sent_at, created_at, requirements_jsonb,
       events ( id, event_type, client_name, city, starts_at, ends_at, guest_count ),
       parent:categories!rfqs_category_id_fkey ( id, name_en ),
       sub:categories!rfqs_subcategory_id_fkey ( id, name_en )`,
    )
    .eq("id", id)
    .maybeSingle();

  const rfq = rfqData as unknown as RfqDetail | null;
  if (!rfq) notFound();

  const { data: invitesData } = await supabase
    .from("rfq_invites")
    .select(
      `id, source, status, sent_at, response_due_at, responded_at, decline_reason_code,
       suppliers ( id, business_name, slug, base_city )`,
    )
    .eq("rfq_id", id)
    .order("sent_at", { ascending: true });

  const invites = (invitesData ?? []) as unknown as InviteDetail[];

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
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1 text-xs font-medium">
          {t(`status.${rfq.status}` as never)}
        </span>
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
              <thead className="bg-[var(--color-muted)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
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
