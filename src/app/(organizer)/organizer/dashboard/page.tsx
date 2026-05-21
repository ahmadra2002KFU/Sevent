import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  CalendarDays,
  ClipboardCheck,
  Handshake,
  Send,
  Plus,
  ArrowRight,
  AlertTriangle,
  Hourglass,
  Bell,
  Sparkles,
} from "lucide-react";
import { fmtDate, type SupportedLocale } from "@/lib/domain/formatDate";
import { segmentNameFor } from "@/lib/domain/segments";
import { cityNameFor } from "@/lib/domain/cities";
import { categoryName } from "@/lib/domain/taxonomy";
import { formatConfirmDeadline } from "@/lib/domain/booking";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { MetricCard } from "@/components/ui-ext/MetricCard";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { StatusPill, type StatusPillStatus } from "@/components/ui-ext/StatusPill";
import { requireAccess } from "@/lib/auth/access";
import { CelebrationBanner } from "@/components/supplier/onboarding/CelebrationBanner";
import { OrganizerOnboardingBanner } from "./OrganizerOnboardingBanner";
import { CompanyMetaLine } from "./CompanyMetaLine";
import { InviteTeammatesPrompt } from "./InviteTeammatesPrompt";
import { AttentionPanel, type AttentionItem } from "./AttentionPanel";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const RISK_WINDOW_DAYS = 14;
const UPCOMING_WINDOW_DAYS = 30;

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type DashboardRfq = {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  events: { id: string; city: string } | null;
  sub: { id: string; name_en: string; name_ar: string | null } | null;
  rfq_invites: Array<{ id: string }>;
};

type UpcomingEvent = {
  id: string;
  event_type: string;
  client_name: string | null;
  city: string;
  starts_at: string;
  ends_at: string;
  rfqs: Array<{ id: string; status: string }> | null;
};

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

function eventHasBookedSupplier(event: UpcomingEvent): boolean {
  return (event.rfqs ?? []).some((r) => r.status === "booked");
}

export default async function OrganizerDashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const showWelcome = params.welcome === "1";
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("organizer.dashboard");
  const rfqT = await getTranslations("organizer.rfqs");
  const tSuccess = await getTranslations("organizer.onboarding.success");

  const { user, admin, decision } = await requireAccess("organizer.dashboard");

  const nowDate = new Date();
  const nowMs = nowDate.getTime();
  const nowIso = nowDate.toISOString();
  const upcomingCutoffIso = new Date(
    nowMs + UPCOMING_WINDOW_DAYS * DAY_MS,
  ).toISOString();
  const riskCutoffMs = nowMs + RISK_WINDOW_DAYS * DAY_MS;
  const activeCompanyId = decision.activeCompanyId;
  const companyRole = decision.companyRole;

  // Profile-side onboarding state: surface the choice banner when the user
  // hasn't declared a legal_type yet.
  const profilePromise = admin
    .from("profiles")
    .select("organizer_legal_type")
    .eq("id", user.id)
    .maybeSingle();

  // Active-company metadata (name + member count) for the meta-line strip.
  const companyMetaPromise = activeCompanyId
    ? Promise.all([
        admin
          .from("organizer_companies")
          .select("name")
          .eq("id", activeCompanyId)
          .maybeSingle(),
        admin
          .from("organizer_memberships")
          .select("profile_id", { count: "exact", head: true })
          .eq("company_id", activeCompanyId)
          .is("removed_at", null),
      ])
    : Promise.resolve(null);

  // Activity queries. Scope every query to the signed-in organizer's own rows
  // via `organizer_id` (events/bookings) / the joined event's `organizer_id`
  // (rfqs) — IDENTICAL to the events / RFQs / bookings list pages, so the
  // dashboard numbers always match what those lists show.
  //
  // Deliberately NOT company-scoped: the write path never sets `company_id`
  // (createEventAction inserts events with company_id = NULL; the company
  // backfill was explicitly out of scope — see migration 20260518111000), so
  // `company_id = activeCompanyId` matches nothing and would hide a company
  // organizer's events entirely. `activeCompanyId` below is used only for the
  // company meta-line / invite prompt, not for data scoping.
  //
  // The `admin` client is service-role and bypasses RLS, so these owner
  // filters are load-bearing — without the rfqs event-join filter an organizer
  // would see every organizer's RFQs.
  const upcomingEventsQ = admin
    .from("events")
    .select(
      "id, event_type, client_name, city, starts_at, ends_at, rfqs(id, status)",
    )
    .gt("starts_at", nowIso)
    .lte("starts_at", upcomingCutoffIso)
    .order("starts_at", { ascending: true })
    .limit(50);
  const rfqStatusQ = admin
    .from("rfqs")
    .select("id, status, events!inner(organizer_id)");
  const awaitingBookingsQ = admin
    .from("bookings")
    .select("id, confirm_deadline")
    .eq("confirmation_status", "awaiting_supplier");
  const confirmedBookingsQ = admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("confirmation_status", "confirmed");
  const latestRfqsQ = admin
    .from("rfqs")
    .select(
      `id, status, sent_at, created_at,
           events!inner ( id, city, organizer_id ),
           sub:categories!rfqs_subcategory_id_fkey ( id, name_en, name_ar ),
           rfq_invites ( id )`,
    )
    .order("created_at", { ascending: false })
    .limit(5);

  upcomingEventsQ.eq("organizer_id", user.id);
  awaitingBookingsQ.eq("organizer_id", user.id);
  confirmedBookingsQ.eq("organizer_id", user.id);
  rfqStatusQ.eq("events.organizer_id", user.id);
  latestRfqsQ.eq("events.organizer_id", user.id);

  const [
    profileRes,
    companyMetaRes,
    upcomingRes,
    rfqStatusRes,
    awaitingRes,
    confirmedRes,
    latestRes,
  ] = await Promise.all([
    profilePromise,
    companyMetaPromise,
    upcomingEventsQ,
    rfqStatusQ,
    awaitingBookingsQ,
    confirmedBookingsQ,
    latestRfqsQ,
  ]);

  const legalType =
    (profileRes.data as { organizer_legal_type?: string | null } | null)
      ?.organizer_legal_type ?? null;
  const showOnboardingBanner = legalType === null;

  let companyName: string | null = null;
  let memberCount = 0;
  if (companyMetaRes) {
    const [companyRow, membershipsRow] = companyMetaRes;
    companyName = (companyRow.data as { name?: string } | null)?.name ?? null;
    memberCount = membershipsRow.count ?? 0;
  }
  const showInvitePrompt =
    activeCompanyId !== null &&
    (companyRole === "owner" || companyRole === "admin") &&
    memberCount <= 1;

  const upcoming = (upcomingRes.data ?? []) as unknown as UpcomingEvent[];
  const allRfqs = (rfqStatusRes.data ?? []) as Array<{
    id: string;
    status: string;
  }>;
  const awaitingBookings = (awaitingRes.data ?? []) as Array<{
    id: string;
    confirm_deadline: string | null;
  }>;
  const latest = (latestRes.data ?? []) as unknown as DashboardRfq[];

  // KPI values — mutually exclusive states, no double-counting.
  const upcomingCount = upcoming.length;
  const awaitingResponses = allRfqs.filter((r) => r.status === "sent").length;
  const quotesToReview = allRfqs.filter((r) => r.status === "quoted").length;
  const confirmedBookings = confirmedRes.count ?? 0;

  // Action signals.
  const awaitingConfirmation = awaitingBookings.length;
  let nearestDeadlineHours: number | null = null;
  for (const b of awaitingBookings) {
    const d = formatConfirmDeadline(b.confirm_deadline, nowDate);
    if (d.kind === "countdown") {
      nearestDeadlineHours =
        nearestDeadlineHours === null
          ? d.hours
          : Math.min(nearestDeadlineHours, d.hours);
    }
  }
  const atRiskEventIds = new Set(
    upcoming
      .filter(
        (e) =>
          new Date(e.starts_at).getTime() <= riskCutoffMs &&
          !eventHasBookedSupplier(e),
      )
      .map((e) => e.id),
  );
  const eventsAtRisk = atRiskEventIds.size;

  const attentionItems: AttentionItem[] = [];
  if (eventsAtRisk > 0) {
    attentionItems.push({
      id: "events-at-risk",
      icon: AlertTriangle,
      tone: "danger",
      text: t("attention.eventsAtRisk", { count: eventsAtRisk }),
      ctaLabel: t("attention.eventsAtRiskCta"),
      href: "/organizer/events",
    });
  }
  if (awaitingConfirmation > 0) {
    attentionItems.push({
      id: "awaiting-confirmation",
      icon: Hourglass,
      tone: "warning",
      text: t("attention.awaitingConfirmation", { count: awaitingConfirmation }),
      meta:
        nearestDeadlineHours !== null
          ? t("attention.awaitingConfirmationDeadline", {
              hours: nearestDeadlineHours,
            })
          : null,
      ctaLabel: t("attention.awaitingConfirmationCta"),
      href: "/organizer/bookings?status=awaiting_supplier",
    });
  }
  if (quotesToReview > 0) {
    attentionItems.push({
      id: "quotes-to-review",
      icon: ClipboardCheck,
      tone: "info",
      text: t("attention.quotesToReview", { count: quotesToReview }),
      ctaLabel: t("attention.quotesToReviewCta"),
      href: "/organizer/rfqs",
    });
  }

  const hasAnyData =
    upcoming.length > 0 ||
    latest.length > 0 ||
    confirmedBookings > 0 ||
    awaitingResponses > 0 ||
    quotesToReview > 0 ||
    awaitingConfirmation > 0;

  const upcomingForList = upcoming.slice(0, 5);

  return (
    <section className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button size="lg" asChild>
            <Link href="/organizer/events/new">
              <Plus aria-hidden />
              {t("newEvent")}
            </Link>
          </Button>
        }
      />

      {showWelcome && companyName ? (
        <CelebrationBanner
          supplierName={companyName}
          labels={{
            smallLabel: tSuccess("smallLabel", { name: companyName }),
            title: tSuccess("title"),
            body: tSuccess("body"),
            ctaPrimary: tSuccess("ctaPrimary"),
            ctaPrimaryHref: "/organizer/events/new",
            ctaSecondary: tSuccess("ctaSecondary"),
            ctaSecondaryHref: "/organizer/dashboard",
          }}
        />
      ) : null}

      {activeCompanyId && companyName && companyRole ? (
        <CompanyMetaLine
          companyName={companyName}
          memberCount={memberCount}
          role={companyRole}
        />
      ) : null}

      {showOnboardingBanner ? <OrganizerOnboardingBanner /> : null}

      {showInvitePrompt &&
      (companyRole === "owner" || companyRole === "admin") ? (
        <InviteTeammatesPrompt role={companyRole} />
      ) : null}

      {!hasAnyData ? (
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
        <>
          <AttentionPanel
            title={t("attention.title")}
            subtitle={t("attention.subtitle")}
            items={attentionItems}
            caughtUp={{
              title: t("attention.allCaughtUpTitle"),
              body: t("attention.allCaughtUpBody"),
            }}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/organizer/events"
              className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <MetricCard
                icon={CalendarDays}
                tone="info"
                label={t("statUpcomingEvents")}
                value={upcomingCount}
                hint={t("statUpcomingEventsHint")}
              />
            </Link>
            <Link
              href="/organizer/rfqs"
              className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <MetricCard
                icon={Send}
                tone="default"
                label={t("statAwaitingResponses")}
                value={awaitingResponses}
                hint={t("statAwaitingResponsesHint")}
              />
            </Link>
            <Link
              href="/organizer/rfqs"
              className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <MetricCard
                icon={ClipboardCheck}
                tone="warning"
                label={t("statQuotesToReview")}
                value={quotesToReview}
                hint={t("statQuotesToReviewHint")}
              />
            </Link>
            <Link
              href="/organizer/bookings?status=confirmed"
              className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <MetricCard
                icon={Handshake}
                tone="success"
                label={t("statConfirmedBookings")}
                value={confirmedBookings}
                hint={t("statConfirmedBookingsHint")}
              />
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                <CardTitle className="text-lg">
                  {t("upcomingEvents")}
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/organizer/events">
                    {t("viewAll")}
                    <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {upcomingForList.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    {t("noEvents")}
                  </p>
                ) : (
                  <ul className="divide-y">
                    {upcomingForList.map((e) => {
                      const atRisk = atRiskEventIds.has(e.id);
                      return (
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
                                {segmentNameFor(e.event_type, locale)}
                                {e.client_name ? ` · ${e.client_name}` : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {cityNameFor(e.city, locale)} ·{" "}
                                {fmtDate(e.starts_at, locale)}
                              </p>
                            </div>
                            {atRisk ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-semantic-danger-100 px-2.5 py-0.5 text-xs font-medium text-semantic-danger-500">
                                <AlertTriangle className="size-3" aria-hidden />
                                {t("eventNoSupplierBadge")}
                              </span>
                            ) : (
                              <ArrowRight
                                className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
                                aria-hidden
                              />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                  <CardTitle className="text-lg">{t("latestRfqs")}</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/organizer/rfqs">
                      {t("viewAllRfqs")}
                      <ArrowRight
                        className="size-4 rtl:rotate-180"
                        aria-hidden
                      />
                    </Link>
                  </Button>
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
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate font-medium text-brand-navy-900">
                                {categoryName(r.sub, locale) || "RFQ"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {r.events?.city
                                  ? `${cityNameFor(r.events.city, locale)} · `
                                  : ""}
                                {t("invitesCount", {
                                  count: r.rfq_invites?.length ?? 0,
                                })}
                                {" · "}
                                {fmtDate(r.sent_at ?? r.created_at, locale)}
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

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                    {t("quickActions")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 px-4 pb-4">
                  <Button variant="ghost" className="justify-start" asChild>
                    <Link href="/organizer/bookings">
                      <Handshake aria-hidden />
                      {t("bookings")}
                    </Link>
                  </Button>
                  <Button variant="ghost" className="justify-start" asChild>
                    <Link href="/organizer/notifications">
                      <Bell aria-hidden />
                      {t("notifications")}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
