import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { FileText, Hourglass, Inbox, MapPin, Users } from "lucide-react";
import { requireAccess } from "@/lib/auth/access";
import { fmtDateTime, type SupportedLocale } from "@/lib/domain/formatDate";
import { cityNameFor } from "@/lib/domain/cities";
import { categoryName } from "@/lib/domain/taxonomy";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type InviteStatus = "invited" | "declined" | "quoted" | "withdrawn";

type InviteRow = {
  id: string;
  status: InviteStatus;
  sent_at: string;
  response_due_at: string;
  responded_at: string | null;
  decline_reason_code: string | null;
  rfqs: {
    id: string;
    subcategory_id: string;
    events: {
      id: string;
      city: string;
      starts_at: string;
      ends_at: string;
      guest_count: number | null;
    } | null;
    categories: {
      id: string;
      slug: string;
      name_en: string;
      name_ar: string | null;
    } | null;
  } | null;
};

function countdownLabel(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  responseDueAt: string,
): string {
  const diffMs = Date.parse(responseDueAt) - Date.now();
  if (Number.isNaN(diffMs)) return "";
  if (diffMs <= 0) return t("expired");
  const hours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));
  return t("countdownHours", { hours });
}

function countdownTone(responseDueAt: string): "warning" | "danger" | "info" {
  const diffMs = Date.parse(responseDueAt) - Date.now();
  if (Number.isNaN(diffMs) || diffMs <= 0) return "danger";
  const hours = diffMs / (60 * 60 * 1000);
  if (hours < 4) return "danger";
  if (hours < 12) return "warning";
  return "info";
}

function formatSentRelative(iso: string): string {
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

function mapInviteToStatusPill(status: InviteStatus) {
  switch (status) {
    case "quoted":
      return "quoted" as const;
    case "declined":
      return "declined" as const;
    case "withdrawn":
      return "withdrawn" as const;
    case "invited":
    default:
      return "invited" as const;
  }
}

type PendingRfpRequest = {
  request_id: string;
  quote_id: string;
  rfq_id: string;
  invite_id: string;
  requested_at: string;
  message: string | null;
  category_label: string;
  city_label: string;
  event_starts_at: string | null;
};

export default async function SupplierRfqInboxPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("supplier.rfqInbox");
  const tRfp = await getTranslations("supplier.rfp");
  const formatEventDate = (iso: string): string => fmtDateTime(iso, locale);

  const { decision, admin } = await requireAccess("supplier.rfqs.view");
  const supplierId = decision.supplierId;
  if (!supplierId) {
    return (
      <section className="flex flex-col gap-6">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <EmptyState icon={Inbox} title={t("empty")} />
      </section>
    );
  }

  const { data: invitesData } = await admin
    .from("rfq_invites")
    .select(
      `id, status, sent_at, response_due_at, responded_at, decline_reason_code,
       rfqs (
         id, subcategory_id,
         events ( id, city, starts_at, ends_at, guest_count ),
         categories!rfqs_subcategory_id_fkey ( id, slug, name_en, name_ar )
       )`,
    )
    .eq("supplier_id", supplierId)
    .order("sent_at", { ascending: false });

  const rawInvites = (invitesData ?? []) as unknown as InviteRow[];

  // Open invites come first — they're the only actionable rows. Everything
  // else (quoted / declined / withdrawn) surfaces below as past activity so
  // suppliers can still find responses they already sent.
  const invited = rawInvites.filter((row) => row.status === "invited");
  const past = rawInvites.filter((row) => row.status !== "invited");

  // Pending RFP requests for this supplier. We surface them as their own
  // "Action required" section above open invites — without this, a supplier
  // who has already quoted has to dig through past activity to discover that
  // the organizer asked for a technical proposal.
  const inviteByRfq = new Map<string, InviteRow>();
  for (const inv of rawInvites) {
    if (inv.rfqs?.id) inviteByRfq.set(inv.rfqs.id, inv);
  }

  const { data: pendingRfpRows } = await admin
    .from("quote_proposal_requests")
    .select(
      `id, quote_id, requested_at, message,
       quotes!inner ( id, rfq_id, supplier_id )`,
    )
    .eq("status", "pending")
    .eq("quotes.supplier_id", supplierId)
    .order("requested_at", { ascending: false });

  type RfpJoinRow = {
    id: string;
    quote_id: string;
    requested_at: string;
    message: string | null;
    quotes:
      | { id: string; rfq_id: string; supplier_id: string }
      | { id: string; rfq_id: string; supplier_id: string }[];
  };
  const actionRequired: PendingRfpRequest[] = [];
  for (const row of (pendingRfpRows ?? []) as unknown as RfpJoinRow[]) {
    const q = Array.isArray(row.quotes) ? row.quotes[0] : row.quotes;
    if (!q) continue;
    const invite = inviteByRfq.get(q.rfq_id);
    if (!invite) continue;
    actionRequired.push({
      request_id: row.id,
      quote_id: q.id,
      rfq_id: q.rfq_id,
      invite_id: invite.id,
      requested_at: row.requested_at,
      message: row.message,
      category_label: categoryName(invite.rfqs?.categories ?? null, locale) || "RFQ",
      city_label: invite.rfqs?.events?.city
        ? cityNameFor(invite.rfqs.events.city, locale)
        : "—",
      event_starts_at: invite.rfqs?.events?.starts_at ?? null,
    });
  }

  return (
    <section className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {actionRequired.length > 0 ? (
              <Badge
                variant="outline"
                className="gap-1.5 border-semantic-warning-500/50 bg-semantic-warning-100 text-semantic-warning-500"
              >
                <Hourglass className="size-3.5" aria-hidden />
                {tRfp("inboxBadge", { count: actionRequired.length })}
              </Badge>
            ) : null}
            <Badge variant="outline" className="gap-1.5">
              <Inbox className="size-3.5" aria-hidden />
              {t("openCount", { count: invited.length })}
            </Badge>
          </div>
        }
      />

      {actionRequired.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-semantic-warning-500">
            <Hourglass className="size-4" aria-hidden />
            {tRfp("inboxSectionHeading")}
          </h2>
          <ul className="flex flex-col gap-3">
            {actionRequired.map((item) => (
              <li key={item.request_id}>
                <Card className="border-semantic-warning-500/40 bg-semantic-warning-100/30">
                  <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-brand-navy-900">
                          {item.category_label}
                        </h3>
                        <span className="inline-flex items-center gap-1 rounded-full bg-semantic-warning-500 px-2 py-0.5 text-xs font-medium text-white">
                          <Hourglass className="size-3" aria-hidden />
                          {tRfp("pending")}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" aria-hidden />
                          {item.city_label}
                        </span>
                        {item.event_starts_at ? (
                          <span>{formatEventDate(item.event_starts_at)}</span>
                        ) : null}
                      </div>
                      <p className="text-sm text-foreground">
                        {item.message
                          ? item.message
                          : tRfp("bannerBodyDefault")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tRfp("requestedRelative", {
                          time: formatSentRelative(item.requested_at),
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0">
                      <Button asChild>
                        <Link
                          href={`/supplier/rfqs/${item.invite_id}/proposal-upload`}
                        >
                          <FileText aria-hidden />
                          {tRfp("uploadCta")}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {invited.length === 0 ? (
        <EmptyState icon={Inbox} title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {invited.map((invite) => {
            const event = invite.rfqs?.events;
            const subcategory = invite.rfqs?.categories;
            const tone = countdownTone(invite.response_due_at);
            return (
              <li key={invite.id}>
                <Link
                  href={`/supplier/rfqs/${invite.id}`}
                  className="group block focus:outline-none"
                >
                  <Card className="transition-all hover:ring-brand-cobalt-500/40 group-focus-visible:ring-brand-cobalt-500">
                    <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-brand-navy-900">
                            {categoryName(subcategory, locale) || "RFQ"}
                          </h3>
                          <StatusPill status="invited" label={t("status.invited")} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" aria-hidden />
                            {event?.city ? cityNameFor(event.city, locale) : "—"}
                          </span>
                          {event?.starts_at ? (
                            <span>{formatEventDate(event.starts_at)}</span>
                          ) : null}
                          {event?.guest_count ? (
                            <span className="inline-flex items-center gap-1">
                              <Users className="size-3.5" aria-hidden />
                              {t("guests", { count: event.guest_count })}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t("sentRelative", {
                            time: formatSentRelative(invite.sent_at),
                          })}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                        <span
                          className={
                            tone === "danger"
                              ? "inline-flex items-center rounded-full bg-semantic-danger-100 px-2.5 py-1 text-xs font-semibold text-semantic-danger-500"
                              : tone === "warning"
                                ? "inline-flex items-center rounded-full bg-semantic-warning-100 px-2.5 py-1 text-xs font-semibold text-semantic-warning-500"
                                : "inline-flex items-center rounded-full bg-brand-cobalt-100 px-2.5 py-1 text-xs font-semibold text-brand-cobalt-500"
                          }
                          aria-label={t("expiresIn", {
                            time: countdownLabel(t, invite.response_due_at),
                          })}
                        >
                          {countdownLabel(t, invite.response_due_at)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {past.length > 0 ? (
        <Card>
          <details className="group">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-brand-navy-900 [&::-webkit-details-marker]:hidden">
              {t("pastHeading", { count: past.length })}
              <span className="text-xs font-normal text-muted-foreground transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <ul className="flex flex-col divide-y divide-border border-t border-border">
              {past.map((invite) => {
                const event = invite.rfqs?.events;
                const subcategory = invite.rfqs?.categories;
                const isQuoted = invite.status === "quoted";
                return (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <div className="flex min-w-0 flex-col">
                      <Link
                        href={`/supplier/rfqs/${invite.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {categoryName(subcategory, locale) || "RFQ"}
                        {event?.city ? ` · ${cityNameFor(event.city, locale)}` : ""}
                      </Link>
                      {event?.starts_at ? (
                        <span className="text-xs text-muted-foreground">
                          {formatEventDate(event.starts_at)}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill
                        status={mapInviteToStatusPill(invite.status)}
                        label={t(`status.${invite.status}`)}
                      />
                      {isQuoted ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/supplier/rfqs/${invite.id}/quote`}>
                            {t("revise")}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
        </Card>
      ) : null}
    </section>
  );
}
