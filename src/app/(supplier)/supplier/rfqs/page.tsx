import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { Inbox, MapPin, Users } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
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

function formatEventDate(iso: string): string {
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

export default async function SupplierRfqInboxPage() {
  const t = await getTranslations("supplier.rfqInbox");

  const gate = await requireRole("supplier");
  if (gate.status === "unauthenticated") redirect("/sign-in?next=/supplier/rfqs");
  if (gate.status === "forbidden") redirect("/supplier/onboarding");
  const { user, admin } = gate;

  const { data: supplierRow } = await admin
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!supplierRow) {
    return (
      <section className="flex flex-col gap-6">
        <PageHeader title={t("title")} description={t("subtitle")} />
        <EmptyState icon={Inbox} title={t("empty")} />
      </section>
    );
  }

  const supplierId = (supplierRow as { id: string }).id;

  const { data: invitesData } = await admin
    .from("rfq_invites")
    .select(
      `id, status, sent_at, response_due_at, responded_at, decline_reason_code,
       rfqs (
         id, subcategory_id,
         events ( id, city, starts_at, ends_at, guest_count ),
         categories!rfqs_subcategory_id_fkey ( id, slug, name_en )
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

  return (
    <section className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Badge variant="outline" className="gap-1.5">
            <Inbox className="size-3.5" aria-hidden />
            {t("openCount", { count: invited.length })}
          </Badge>
        }
      />

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
                            {subcategory?.name_en ?? "RFQ"}
                          </h3>
                          <StatusPill status="invited" label={t("status.invited")} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" aria-hidden />
                            {event?.city ?? "—"}
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
                        {subcategory?.name_en ?? "RFQ"}
                        {event?.city ? ` · ${event.city}` : ""}
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
