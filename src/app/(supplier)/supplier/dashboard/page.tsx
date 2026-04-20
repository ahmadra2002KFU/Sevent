import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type {
  QuoteStatus,
  RfqInviteStatus,
  SupplierDocStatus,
  SupplierVerificationStatus,
} from "@/lib/supabase/types";
import { authenticateAndGetAdminClient } from "@/lib/supabase/server";

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

function verificationBadgeClass(status: SupplierVerificationStatus): string {
  switch (status) {
    case "approved":
      return "border-[#BDE3CB] bg-[#E2F4EA] text-[var(--color-sevent-green)]";
    case "rejected":
      return "border-[#F2C2C2] bg-[#FCE9E9] text-[#9F1A1A]";
    default:
      return "border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]";
  }
}

function inviteBadgeClass(status: RfqInviteStatus): string {
  switch (status) {
    case "quoted":
      return "border-[#BDE3CB] bg-[#E2F4EA] text-[var(--color-sevent-green)]";
    case "declined":
    case "withdrawn":
      return "border-[#F2C2C2] bg-[#FCE9E9] text-[#9F1A1A]";
    default:
      return "border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]";
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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {subtitle}
          </p>
        </div>
      </header>

      <section className="rounded-lg border border-[var(--color-border)] bg-white p-6">
        <h2 className="text-lg font-semibold">{heading}</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted-foreground)]">
          {body}
        </p>
        <Link
          href="/supplier/onboarding"
          className="mt-4 inline-flex w-fit rounded-md bg-[var(--color-primary,#111)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {cta}
        </Link>
      </section>
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
  const hasUpcomingBookings = (bookingsRes.count ?? 0) > 0;
  const shouldShowOnboardingCta =
    supplierSummary.verification_status === "pending" &&
    (docs.length === 0 || docs.some((doc) => doc.status !== "approved"));

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t("subtitle")}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${verificationBadgeClass(
            supplierSummary.verification_status,
          )}`}
        >
          {t(
            `verification.${supplierSummary.verification_status}` as "verification.pending",
          )}
        </span>
      </header>

      {shouldShowOnboardingCta ? (
        <Link
          href="/supplier/onboarding"
          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-white px-5 py-4 text-sm transition hover:border-[var(--color-sevent-green)] hover:shadow-sm"
        >
          <span className="font-medium">{t("completeOnboardingCta")}</span>
          <span className="text-[var(--color-sevent-green)]">{">"}</span>
        </Link>
      ) : null}

      <section className="rounded-lg border border-[var(--color-border)] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-md bg-[var(--color-muted)]/50 p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t("stats.invitesOpen")}
            </div>
            <div className="mt-2 text-3xl font-semibold">{invitesReceived}</div>
          </div>
          <div className="rounded-md bg-[var(--color-muted)]/50 p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t("stats.responseRate")}
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {formatPercentage(responseRate, t("stats.emptyValue"))}
            </div>
          </div>
          <div className="rounded-md bg-[var(--color-muted)]/50 p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t("stats.winRate")}
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {formatPercentage(winRate, t("stats.emptyValue"))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("recentInvites.heading")}</h2>
            <Link
              href="/supplier/rfqs"
              className="text-sm text-[var(--color-sevent-green,#0a7)] hover:underline"
            >
              {t("recentInvites.openInbox")}
            </Link>
          </div>
          {recentInvites.length === 0 ? (
            <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
              {t("recentInvites.empty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentInvites.map((invite) => (
                <li key={invite.id}>
                  <Link
                    href={`/supplier/rfqs/${invite.id}`}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-white px-4 py-3 text-sm transition hover:border-[var(--color-sevent-green)] hover:shadow-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {invite.rfq?.category?.name_en ?? "RFQ"}
                      </span>
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        {invite.rfq?.event?.city ?? "-"}
                        {" | "}
                        {invite.rfq?.event?.starts_at
                          ? formatDateTime(invite.rfq.event.starts_at, dateLocale)
                          : "-"}
                        {invite.status === "invited" ? (
                          <>
                            {" | "}
                            {countdownLabel(
                              invite.response_due_at,
                              (hours) => rfqInboxT("countdownHours", { hours }),
                              t("recentInvites.expired"),
                            )}
                          </>
                        ) : null}
                      </span>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${inviteBadgeClass(
                        invite.status,
                      )}`}
                    >
                      {rfqInboxT(`status.${invite.status}` as "status.invited")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {t("upcomingBookings.heading")}
            </h2>
          </div>
          {!hasUpcomingBookings ? (
            <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
              {t("upcomingBookings.empty")}
            </p>
          ) : (
            <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
              {t("upcomingBookings.empty")}
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
