import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { formatHalalas } from "@/lib/domain/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

type EventDetail = {
  id: string;
  organizer_id: string;
  event_type: string;
  client_name: string | null;
  city: string;
  venue_address: string | null;
  starts_at: string;
  ends_at: string;
  guest_count: number | null;
  budget_range_min_halalas: number | null;
  budget_range_max_halalas: number | null;
  notes: string | null;
  currency: string;
};

type EventRfq = {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  categories: { id: string; slug: string; name_en: string } | null;
  rfq_invites: Array<{ id: string; status: string }>;
};

function fmtDateTime(iso: string): string {
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

export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations("organizer.events");
  const eventFormT = await getTranslations("organizer.eventForm");
  const rfqT = await getTranslations("organizer.rfqs");

  const supabase = await createSupabaseServerClient();

  const { data: eventData } = await supabase
    .from("events")
    .select(
      "id, organizer_id, event_type, client_name, city, venue_address, starts_at, ends_at, guest_count, budget_range_min_halalas, budget_range_max_halalas, notes, currency",
    )
    .eq("id", id)
    .maybeSingle();

  const event = eventData as EventDetail | null;
  if (!event) notFound();

  const { data: rfqsData } = await supabase
    .from("rfqs")
    .select(
      `id, status, sent_at, created_at,
       categories:categories!rfqs_subcategory_id_fkey ( id, slug, name_en ),
       rfq_invites ( id, status )`,
    )
    .eq("event_id", id)
    .order("created_at", { ascending: false });

  const rfqs = (rfqsData ?? []) as unknown as EventRfq[];

  const budget =
    event.budget_range_min_halalas !== null || event.budget_range_max_halalas !== null
      ? `${event.budget_range_min_halalas !== null ? formatHalalas(event.budget_range_min_halalas) : "—"} – ${event.budget_range_max_halalas !== null ? formatHalalas(event.budget_range_max_halalas) : "—"}`
      : null;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t("detailTitle")}
          </p>
          <h1 className="text-2xl font-semibold">
            {eventFormT(`eventType.${event.event_type}` as never)}
            {event.client_name ? ` · ${event.client_name}` : ""}
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {event.city} · {fmtDateTime(event.starts_at)} → {fmtDateTime(event.ends_at)}
          </p>
        </div>
        <Link
          href={`/organizer/rfqs/new?event_id=${event.id}`}
          className="rounded-md bg-[var(--color-primary,#111)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          New RFQ from this event
        </Link>
      </header>

      <section className="rounded-lg border border-[var(--color-border)] bg-white p-5">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Detail label={eventFormT("venueAddressLabel")}>
            {event.venue_address ?? "—"}
          </Detail>
          <Detail label={eventFormT("guestCountLabel")}>
            {event.guest_count ?? "—"}
          </Detail>
          <Detail label="Budget">{budget ?? "—"}</Detail>
          <Detail label={eventFormT("notesLabel")}>{event.notes ?? "—"}</Detail>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">RFQs</h2>
        </div>
        {rfqs.length === 0 ? (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
            No RFQs yet for this event.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rfqs.map((rfq) => (
              <li key={rfq.id}>
                <Link
                  href={`/organizer/rfqs/${rfq.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-white px-4 py-3 text-sm transition hover:border-[var(--color-sevent-green)] hover:shadow-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {rfq.categories?.name_en ?? "RFQ"}
                    </span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {rfq.sent_at ? `Sent ${fmtDateTime(rfq.sent_at)}` : `Created ${fmtDateTime(rfq.created_at)}`}
                      {" · "}
                      {rfq.rfq_invites?.length ?? 0} invites
                    </span>
                  </div>
                  <StatusBadge label={rfqT(`status.${rfq.status}` as never)} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1 text-xs font-medium">
      {label}
    </span>
  );
}
