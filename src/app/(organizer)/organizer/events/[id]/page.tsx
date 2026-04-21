import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Users,
  FileText,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import {
  StatusPill,
  type StatusPillStatus,
} from "@/components/ui-ext/StatusPill";
import { formatHalalas } from "@/lib/domain/money";
import { authenticateAndGetAdminClient } from "@/lib/supabase/server";

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

export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations("organizer.events");
  const eventFormT = await getTranslations("organizer.eventForm");
  const rfqT = await getTranslations("organizer.rfqs");

  const auth = await authenticateAndGetAdminClient();
  if (!auth) redirect(`/sign-in?next=/organizer/events/${id}`);
  const { user, admin } = auth;

  const { data: eventData } = await admin
    .from("events")
    .select(
      "id, organizer_id, event_type, client_name, city, venue_address, starts_at, ends_at, guest_count, budget_range_min_halalas, budget_range_max_halalas, notes, currency",
    )
    .eq("id", id)
    .maybeSingle();

  const event = eventData as EventDetail | null;
  if (!event) notFound();

  if (event.organizer_id !== user.id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role: string } | null)?.role;
    if (role !== "admin") notFound();
  }

  const { data: rfqsData } = await admin
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
    event.budget_range_min_halalas !== null ||
    event.budget_range_max_halalas !== null
      ? `${event.budget_range_min_halalas !== null ? formatHalalas(event.budget_range_min_halalas) : "—"} – ${event.budget_range_max_halalas !== null ? formatHalalas(event.budget_range_max_halalas) : "—"}`
      : null;

  const title = `${eventFormT(`eventType.${event.event_type}` as never)}${
    event.client_name ? ` · ${event.client_name}` : ""
  }`;

  return (
    <section className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/organizer/events">
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t("backToEvents")}
        </Link>
      </Button>

      <PageHeader
        title={title}
        description={t("detailEyebrow")}
        actions={
          <Button size="lg" asChild>
            <Link href={`/organizer/rfqs/new?event_id=${event.id}`}>
              <Plus aria-hidden />
              {t("newRfqForThisEvent")}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Chip icon={MapPin}>{event.city}</Chip>
        <Chip icon={CalendarDays}>
          {fmtDate(event.starts_at)}
          {fmtDate(event.starts_at) !== fmtDate(event.ends_at)
            ? ` → ${fmtDate(event.ends_at)}`
            : ""}
        </Chip>
        {event.guest_count ? (
          <Chip icon={Users}>
            {t("guestsCount", { count: event.guest_count })}
          </Chip>
        ) : null}
      </div>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg">{t("detailsHeading")}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Detail label={eventFormT("venueAddressLabel")}>
              {event.venue_address ?? "—"}
            </Detail>
            <Detail label={eventFormT("startsAtLabel")}>
              {fmtDateTime(event.starts_at)}
            </Detail>
            <Detail label={eventFormT("endsAtLabel")}>
              {fmtDateTime(event.ends_at)}
            </Detail>
            <Detail label={eventFormT("guestCountLabel")}>
              {event.guest_count ?? "—"}
            </Detail>
            <Detail label={t("budget")}>{budget ?? "—"}</Detail>
            <Detail label={eventFormT("notesLabel")}>
              <span className="whitespace-pre-line">{event.notes ?? "—"}</span>
            </Detail>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-4 flex-row items-center justify-between">
          <CardTitle className="text-lg">{t("rfqsHeading")}</CardTitle>
          {rfqs.length > 0 ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/organizer/rfqs/new?event_id=${event.id}`}>
                <Plus aria-hidden />
                {t("sendNewRfq")}
              </Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {rfqs.length === 0 ? (
            <EmptyState
              className="border-0 rounded-none"
              icon={FileText}
              title={t("noRfqsForEvent")}
              description={t("noRfqsDescription")}
              action={
                <Button asChild>
                  <Link href={`/organizer/rfqs/new?event_id=${event.id}`}>
                    <Plus aria-hidden />
                    {t("sendNewRfq")}
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y">
              {rfqs.map((rfq) => (
                <li key={rfq.id}>
                  <Link
                    href={`/organizer/rfqs/${rfq.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <span className="truncate font-medium text-brand-navy-900">
                        {rfq.categories?.name_en ?? "RFQ"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {rfq.sent_at
                          ? `${fmtDateTime(rfq.sent_at)}`
                          : `${t("createdAt")} ${fmtDateTime(rfq.created_at)}`}
                        {" · "}
                        {rfq.rfq_invites?.length ?? 0}{" "}
                        {rfq.rfq_invites?.length === 1
                          ? "invite"
                          : "invites"}
                      </span>
                    </div>
                    <StatusPill
                      status={toPillStatus(rfq.status)}
                      label={rfqT(`status.${rfq.status}` as never)}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function Chip({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-foreground">
      <Icon className="size-3.5 text-brand-cobalt-500" aria-hidden />
      {children}
    </span>
  );
}
