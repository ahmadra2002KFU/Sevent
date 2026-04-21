import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Clock3,
  Inbox,
  Package,
  Palette,
  PercentCircle,
  Rocket,
  ShieldCheck,
  Send,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  QuoteStatus,
  RfqInviteStatus,
  SupplierDocStatus,
  SupplierVerificationStatus,
} from "@/lib/supabase/types";
import { authenticateAndGetAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { MetricCard } from "@/components/ui-ext/MetricCard";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RESPONSE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MIN_RESPONSE_SAMPLE = 5;
const MIN_WIN_RATE_SAMPLE = 3;
const TERMINAL_QUOTE_STATUSES: QuoteStatus[] = [
  "accepted",
  "rejected",
  "expired",
  "withdrawn",
];

type SupplierSummaryRow = {
  id: string;
  verification_status: SupplierVerificationStatus;
};

type RecentInviteRow = {
  id: string;
  status: RfqInviteStatus;
  response_due_at: string;
  rfq: {
    event: {
      city: string;
      starts_at: string;
    } | null;
    category: {
      name_en: string;
    } | null;
  } | null;
};

type RecentInviteQueryRow = {
  id: string;
  status: RfqInviteStatus;
  response_due_at: string;
  rfqs: Array<{
    events: Array<{
      city: string;
      starts_at: string;
    }>;
    categories: Array<{
      name_en: string;
    }>;
  }>;
};

function buildThirtyDayCutoffIso(): string {
  return new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
}

function formatDateTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
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

function formatPercentage(value: number | null, emptyValue: string): string {
  if (value === null) return emptyValue;
  return `${Math.round(value * 100)}%`;
}

function computeResponseRateFromRows(
  rows: Array<{ sent_at: string; responded_at: string | null }>,
): number | null {
  if (rows.length < MIN_RESPONSE_SAMPLE) return null;

  let respondedInWindow = 0;
  for (const row of rows) {
    if (!row.responded_at) continue;
    const sent = Date.parse(row.sent_at);
    const responded = Date.parse(row.responded_at);
    if (Number.isNaN(sent) || Number.isNaN(responded)) continue;
    if (responded - sent < RESPONSE_WINDOW_MS) {
      respondedInWindow += 1;
    }
  }

  return respondedInWindow / rows.length;
}

function computeWinRate(rows: Array<{ status: QuoteStatus }>): number | null {
  if (rows.length < MIN_WIN_RATE_SAMPLE) return null;
  const accepted = rows.filter((row) => row.status === "accepted").length;
  return accepted / rows.length;
}

function verificationStatusPill(
  status: SupplierVerificationStatus,
  t: (key: string) => string,
) {
  if (status === "approved") {
    return <StatusPill status="approved" label={t(`verification.approved`)} />;
  }
  if (status === "rejected") {
    return <StatusPill status="rejected" label={t(`verification.rejected`)} />;
  }
  return <StatusPill status="pending" label={t(`verification.pending`)} />;
}

function inviteStatusPill(
  status: RfqInviteStatus,
  t: (key: string) => string,
) {
  const key = `status.${status}` as const;
  switch (status) {
    case "quoted":
      return <StatusPill status="quoted" label={t(key)} />;
    case "declined":
    case "withdrawn":
      return <StatusPill status="declined" label={t(key)} />;
    case "invited":
    default:
      return <StatusPill status="invited" label={t(key)} />;
  }
}

function countdownLabel(
  responseDueAt: string,
  formatHours: (hours: number) => string,
  expiredLabel: string,
): string {
  const diffMs = Date.parse(responseDueAt) - Date.now();
  if (Number.isNaN(diffMs) || diffMs <= 0) return expiredLabel;
  const hours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));
  return formatHours(hours);
}

function normalizeRecentInvites(rows: RecentInviteQueryRow[]): RecentInviteRow[] {
  return rows.map((row) => {
    const rfq = row.rfqs?.[0];
    return {
      id: row.id,
      status: row.status,
      response_due_at: row.response_due_at,
      rfq: rfq
        ? {
            event: rfq.events?.[0] ?? null,
            category: rfq.categories?.[0] ?? null,
          }
        : null,
    };
  });
}

function WelcomeState({
  title,
  subtitle,
  heading,
  body,
  cta,
}: {
  title: string;
  subtitle: string;
  heading: string;
  body: string;
  cta: string;
}) {
  return (
    <section className="flex flex-col gap-8">
      <PageHeader title={title} description={subtitle} />
      <Card>
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg">
            <Link href="/supplier/onboarding">{cta}</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

export default async function SupplierDashboardPage() {
  const t = await getTranslations("supplier.dashboard");
  const rfqInboxT = await getTranslations("supplier.rfqInbox");
  const locale = await getLocale();
  const dateLocale = locale === "ar" ? "ar-SA" : "en-SA";

  const auth = await authenticateAndGetAdminClient();
  if (!auth) {
    return (
      <WelcomeState
        title={t("title")}
        subtitle={t("subtitle")}
        heading={t("welcome.heading")}
        body={t("welcome.body")}
        cta={t("welcome.cta")}
      />
    );
  }
  const { user, admin } = auth;

  const { data: supplier } = await admin
    .from("suppliers")
    .select("id, verification_status")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!supplier) {
    return (
      <WelcomeState
        title={t("title")}
        subtitle={t("subtitle")}
        heading={t("welcome.heading")}
        body={t("welcome.body")}
        cta={t("welcome.cta")}
      />
    );
  }

  const supplierSummary = supplier as SupplierSummaryRow;
  const cutoffIso = buildThirtyDayCutoffIso();

  const [
    invitesCountRes,
    responseRateRes,
    quotesRes,
    docsRes,
    recentInvitesRes,
    bookingsRes,
    activePackagesRes,
    categoriesCountRes,
  ] = await Promise.all([
    admin
      .from("rfq_invites")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierSummary.id)
      .eq("status", "invited")
      .gt("sent_at", cutoffIso),
    admin
      .from("rfq_invites")
      .select("sent_at, responded_at")
      .eq("supplier_id", supplierSummary.id)
      .gt("sent_at", cutoffIso),
    admin
      .from("quotes")
      .select("status")
      .eq("supplier_id", supplierSummary.id)
      .in("status", TERMINAL_QUOTE_STATUSES),
    admin
      .from("supplier_docs")
      .select("id, status")
      .eq("supplier_id", supplierSummary.id),
    admin
      .from("rfq_invites")
      .select(
        `id, status, response_due_at,
         rfqs (
           events ( city, starts_at ),
           categories!rfqs_subcategory_id_fkey ( name_en )
         )`,
      )
      .eq("supplier_id", supplierSummary.id)
      .order("sent_at", { ascending: false })
      .limit(5),
    admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierSummary.id)
      .in("confirmation_status", ["confirmed", "awaiting_supplier"]),
    admin
      .from("packages")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierSummary.id)
      .eq("is_active", true),
    admin
      .from("supplier_categories")
      .select("subcategory_id", { count: "exact", head: true })
      .eq("supplier_id", supplierSummary.id),
  ]);

  const invitesReceived = invitesCountRes.count ?? 0;
  const responseRate = computeResponseRateFromRows(
    (responseRateRes.data ?? []) as Array<{
      sent_at: string;
      responded_at: string | null;
    }>,
  );
  const winRate = computeWinRate(
    (quotesRes.data ?? []) as Array<{ status: QuoteStatus }>,
  );
  const docs = (docsRes.data ?? []) as Array<{
    id: string;
    status: SupplierDocStatus;
  }>;
  const recentInvites = normalizeRecentInvites(
    (recentInvitesRes.data ?? []) as unknown as RecentInviteQueryRow[],
  );
  const upcomingBookings = bookingsRes.count ?? 0;
  const activePackages = activePackagesRes.count ?? 0;
  const subcategoriesCount = categoriesCountRes.count ?? 0;

  // Onboarding completeness signal.
  //   - step 2 deliverable = ≥1 supplier_docs row
  //   - step 3 deliverable = ≥1 supplier_categories row
  // If both are present the user has walked the full wizard, so a pending
  // status means "under review" — not "continue registration".
  const hasDocs = docs.length > 0;
  const hasCategories = subcategoriesCount > 0;
  const hasSubmittedApplication = hasDocs && hasCategories;

  const verification = supplierSummary.verification_status;
  const journeyState: "submitting" | "reviewing" | "live" | "rejected" =
    verification === "approved"
      ? "live"
      : verification === "rejected"
        ? "rejected"
        : hasSubmittedApplication
          ? "reviewing"
          : "submitting";

  const statusCard: {
    title: string;
    body: string;
    cta: { label: string; href: string } | null;
    tone: "info" | "warning" | "danger";
    icon: LucideIcon;
  } | null =
    journeyState === "submitting"
      ? {
          title: t("resubmit.title"),
          body: t("resubmit.body"),
          cta: { label: t("resubmit.cta"), href: "/supplier/onboarding" },
          tone: "info",
          icon: ShieldCheck,
        }
      : journeyState === "reviewing"
        ? {
            title: t("underReview.title"),
            body: t("underReview.body"),
            cta: {
              label: t("underReview.editCta"),
              href: "/supplier/onboarding",
            },
            tone: "warning",
            icon: Clock3,
          }
        : journeyState === "rejected"
          ? {
              title: t("rejected.title"),
              body: t("rejected.body"),
              cta: { label: t("rejected.cta"), href: "/supplier/onboarding" },
              tone: "danger",
              icon: XCircle,
            }
          : null;
  const locked = journeyState !== "live";

  return (
    <section className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={verificationStatusPill(supplierSummary.verification_status, t)}
      />

      <JourneyStrip
        state={journeyState}
        heading={t("journey.heading")}
        labels={{
          submit: t("journey.steps.submit"),
          submitHintDone: t("journey.steps.submitHintDone"),
          submitHintPending: t("journey.steps.submitHintPending"),
          review: t("journey.steps.review"),
          reviewHintPending: t("journey.steps.reviewHintPending"),
          reviewHintActive: t("journey.steps.reviewHintActive"),
          reviewHintDone: t("journey.steps.reviewHintDone"),
          live: t("journey.steps.live"),
          liveHintPending: t("journey.steps.liveHintPending"),
          liveHintActive: t("journey.steps.liveHintActive"),
        }}
      />

      {statusCard ? <StatusCard card={statusCard} /> : null}

      <div
        className={cn(
          "grid gap-4 sm:grid-cols-2 lg:grid-cols-4 transition-opacity",
          locked && "opacity-60",
        )}
      >
        <MetricCard
          label={t("stats.invitesOpen")}
          value={invitesReceived}
          icon={Inbox}
          tone="info"
        />
        <MetricCard
          label={t("stats.responseRate")}
          value={formatPercentage(responseRate, t("stats.emptyValue"))}
          icon={PercentCircle}
          tone="default"
        />
        <MetricCard
          label={t("upcomingBookings.heading")}
          value={upcomingBookings}
          icon={CalendarDays}
          tone="success"
        />
        <MetricCard
          label={t("stats.activePackages")}
          value={activePackages}
          icon={Package}
          tone="warning"
        />
      </div>

      <div
        className={cn(
          "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] transition-opacity",
          locked && "opacity-70",
        )}
      >
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>{t("recentInvites.heading")}</CardTitle>
                <CardDescription>
                  {t("stats.winRate")}:{" "}
                  {formatPercentage(winRate, t("stats.emptyValue"))}
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/supplier/rfqs">
                  {t("recentInvites.openInbox")}
                  <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentInvites.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={t("recentInvites.empty")}
              />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {recentInvites.map((invite) => (
                  <li key={invite.id}>
                    <Link
                      href={`/supplier/rfqs/${invite.id}`}
                      className="flex flex-wrap items-start justify-between gap-3 py-3 transition-colors hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {invite.rfq?.category?.name_en ?? "RFQ"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {invite.rfq?.event?.city ?? "—"}
                          {" · "}
                          {invite.rfq?.event?.starts_at
                            ? formatDateTime(
                                invite.rfq.event.starts_at,
                                dateLocale,
                              )
                            : "—"}
                          {invite.status === "invited" ? (
                            <>
                              {" · "}
                              {countdownLabel(
                                invite.response_due_at,
                                (hours) =>
                                  rfqInboxT("countdownHours", { hours }),
                                t("recentInvites.expired"),
                              )}
                            </>
                          ) : null}
                        </p>
                      </div>
                      {inviteStatusPill(invite.status, rfqInboxT)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("quickLinks.heading")}</CardTitle>
            <CardDescription>{t("quickLinks.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline" className="justify-between">
              <Link href="/supplier/catalog">
                <span className="inline-flex items-center gap-2">
                  <Package className="size-4" aria-hidden />
                  {t("quickLinks.catalog")}
                </span>
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-between">
              <Link href="/supplier/calendar">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="size-4" aria-hidden />
                  {t("quickLinks.calendar")}
                </span>
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-between">
              <Link href="/supplier/bookings">
                <span className="inline-flex items-center gap-2">
                  <ClipboardList className="size-4" aria-hidden />
                  {t("quickLinks.bookings")}
                </span>
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
            {/*
              "Customize your profile" — visible to every supplier so the
              option is discoverable pre-approval, but shows a subtle state
              hint when they aren't live yet. Matches the outline-style tile
              of its siblings instead of introducing a new visual pattern.
              When not live we render a non-link visual so clicks don't lead
              to an editor for a profile the public can't see yet.
            */}
            {journeyState === "live" ? (
              <Button asChild variant="outline" className="justify-between">
                <Link href="/supplier/profile">
                  <span className="inline-flex items-center gap-2">
                    <Palette className="size-4" aria-hidden />
                    {t("quickLinks.customizeProfile")}
                  </span>
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="justify-between opacity-60"
                aria-disabled
                disabled
              >
                <span className="inline-flex items-center gap-2">
                  <Palette className="size-4" aria-hidden />
                  {t("quickLinks.customizeProfile")}
                  <span className="ms-1 text-xs font-normal text-muted-foreground">
                    {t("quickLinks.customizeProfileLockedHint")}
                  </span>
                </span>
                <ArrowUpRight className="size-4" aria-hidden />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Journey strip — three-tile progress header.
// ---------------------------------------------------------------------------

type JourneyState = "submitting" | "reviewing" | "live" | "rejected";
type TileState = "active" | "done" | "pending" | "failed";

type JourneyLabels = {
  submit: string;
  submitHintDone: string;
  submitHintPending: string;
  review: string;
  reviewHintPending: string;
  reviewHintActive: string;
  reviewHintDone: string;
  live: string;
  liveHintPending: string;
  liveHintActive: string;
};

function tilesForState(
  state: JourneyState,
  labels: JourneyLabels,
): Array<{ title: string; hint: string; state: TileState; icon: LucideIcon }> {
  switch (state) {
    case "submitting":
      return [
        { title: labels.submit, hint: labels.submitHintPending, state: "active", icon: Send },
        { title: labels.review, hint: labels.reviewHintPending, state: "pending", icon: Clock3 },
        { title: labels.live, hint: labels.liveHintPending, state: "pending", icon: Rocket },
      ];
    case "reviewing":
      return [
        { title: labels.submit, hint: labels.submitHintDone, state: "done", icon: CheckCircle2 },
        { title: labels.review, hint: labels.reviewHintActive, state: "active", icon: Clock3 },
        { title: labels.live, hint: labels.liveHintPending, state: "pending", icon: Rocket },
      ];
    case "live":
      return [
        { title: labels.submit, hint: labels.submitHintDone, state: "done", icon: CheckCircle2 },
        { title: labels.review, hint: labels.reviewHintDone, state: "done", icon: CheckCircle2 },
        { title: labels.live, hint: labels.liveHintActive, state: "active", icon: Rocket },
      ];
    case "rejected":
      return [
        { title: labels.submit, hint: labels.submitHintDone, state: "done", icon: CheckCircle2 },
        { title: labels.review, hint: labels.reviewHintDone, state: "failed", icon: XCircle },
        { title: labels.live, hint: labels.liveHintPending, state: "pending", icon: Rocket },
      ];
  }
}

const TILE_CLASSES: Record<TileState, string> = {
  active:
    "bg-brand-cobalt-100/70 ring-1 ring-inset ring-brand-cobalt-500/30 text-brand-navy-900",
  done:
    "bg-semantic-success-100/50 ring-1 ring-inset ring-semantic-success-500/30 text-brand-navy-900",
  pending:
    "bg-neutral-100 ring-1 ring-inset ring-border text-muted-foreground",
  failed:
    "bg-semantic-danger-100/50 ring-1 ring-inset ring-semantic-danger-500/40 text-brand-navy-900",
};

const TILE_ICON_CLASSES: Record<TileState, string> = {
  active: "bg-brand-cobalt-500 text-white",
  done: "bg-semantic-success-500 text-white",
  pending: "bg-neutral-200 text-muted-foreground",
  failed: "bg-semantic-danger-500 text-white",
};

function JourneyStrip({
  state,
  heading,
  labels,
}: {
  state: JourneyState;
  heading: string;
  labels: JourneyLabels;
}) {
  const tiles = tilesForState(state, labels);
  return (
    <div>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {heading}
      </h2>
      <ol className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile, idx) => {
          const Icon = tile.icon;
          const isActive = tile.state === "active";
          return (
            <li
              key={idx}
              className={cn(
                "relative flex items-start gap-3 rounded-xl p-4 transition-colors",
                TILE_CLASSES[tile.state],
              )}
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  TILE_ICON_CLASSES[tile.state],
                )}
                aria-hidden
              >
                {tile.state === "pending" ? (
                  <CircleDashed className="size-5" />
                ) : (
                  <Icon className={cn("size-5", isActive && "animate-pulse")} />
                )}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold leading-tight">
                  {tile.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tile.hint}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status card — single "Continue registration" / "Under review" surface.
// ---------------------------------------------------------------------------

const STATUS_CARD_TONES = {
  info: {
    wrap: "bg-brand-cobalt-100/40 ring-brand-cobalt-500/30",
    iconWrap: "bg-brand-cobalt-500 text-white",
  },
  warning: {
    wrap: "bg-semantic-warning-100/50 ring-semantic-warning-500/40",
    iconWrap: "bg-semantic-warning-500 text-white",
  },
  danger: {
    wrap: "bg-semantic-danger-100/50 ring-semantic-danger-500/40",
    iconWrap: "bg-semantic-danger-500 text-white",
  },
} as const;

function StatusCard({
  card,
}: {
  card: {
    title: string;
    body: string;
    cta: { label: string; href: string } | null;
    tone: "info" | "warning" | "danger";
    icon: LucideIcon;
  };
}) {
  const Icon = card.icon;
  const tone = STATUS_CARD_TONES[card.tone];
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl p-5 ring-1 ring-inset sm:flex-row sm:items-center sm:gap-5",
        tone.wrap,
      )}
    >
      <div
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full",
          tone.iconWrap,
        )}
        aria-hidden
      >
        <Icon className="size-6" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-base font-semibold text-brand-navy-900">
          {card.title}
        </h3>
        <p className="text-sm text-muted-foreground">{card.body}</p>
      </div>
      {card.cta ? (
        <Button
          asChild
          variant={card.tone === "info" ? "default" : "outline"}
          size="sm"
          className="self-start sm:self-auto"
        >
          <Link href={card.cta.href}>
            {card.cta.label}
            <ArrowUpRight className="rtl:-scale-x-100" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
