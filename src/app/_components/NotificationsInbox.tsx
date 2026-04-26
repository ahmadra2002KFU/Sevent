import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CheckCircle2,
  FileCheck,
  FileText,
  FileX,
  Hourglass,
  Info,
  MailWarning,
  MessageSquare,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotificationRow } from "@/lib/notifications/reader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Payload → human-readable sentence + link target
// ---------------------------------------------------------------------------
//
// Notifications are written from several sites in the codebase (see
// `supplier/rfqs/[id]/quote/actions.ts`, `organizer/rfqs/[id]/quotes/actions.ts`,
// `admin/verifications/actions.ts`, etc.). The payload shape is not typed at
// the DB boundary, so we defensively pull known keys per `kind` and fall back
// to a generic one-liner when something is missing.
//
// Keeping the mapping in one place (this file) prevents the three role pages
// from drifting out of sync.

type PayloadMap = Record<string, unknown>;

function pickString(
  payload: PayloadMap | null | undefined,
  key: string,
): string | null {
  if (!payload) return null;
  const v = payload[key];
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function pickNumber(
  payload: PayloadMap | null | undefined,
  key: string,
): number | null {
  if (!payload) return null;
  const v = payload[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export type NotificationLink = { href: string; label: string } | null;

/**
 * Derive the canonical deep-link for a notification based on kind + payload.
 * Returns null when the payload lacks the IDs required to build a URL.
 * The `role` argument selects role-appropriate routes for kinds that are
 * written to multiple roles (e.g. admin doesn't have a /supplier/bookings path).
 */
export function linkForNotification(
  row: NotificationRow,
  role: "organizer" | "supplier" | "admin",
): NotificationLink {
  const payload = (row.payload_jsonb ?? {}) as PayloadMap;
  const rfqId = pickString(payload, "rfq_id");
  const quoteId = pickString(payload, "quote_id");
  const bookingId = pickString(payload, "booking_id");
  const inviteId = pickString(payload, "invite_id");

  switch (row.kind) {
    case "quote.sent":
    case "quote.revised":
      if (role === "organizer" && rfqId) {
        return {
          href: quoteId
            ? `/organizer/rfqs/${rfqId}/quotes/${quoteId}`
            : `/organizer/rfqs/${rfqId}/quotes`,
          label: "view",
        };
      }
      return null;
    case "quote.accepted":
      if (role === "supplier") {
        if (bookingId)
          return { href: `/supplier/bookings/${bookingId}`, label: "view" };
        if (rfqId) return { href: `/supplier/rfqs/${rfqId}`, label: "view" };
      }
      if (role === "organizer" && bookingId) {
        return { href: `/organizer/bookings/${bookingId}`, label: "view" };
      }
      return null;
    case "quote.rejected":
      if (role === "supplier" && rfqId) {
        return { href: `/supplier/rfqs/${rfqId}`, label: "view" };
      }
      return null;
    case "quote.proposal_requested":
      // Supplier-side route is keyed by invite id, not rfq id. The writer
      // (`requestProposalAction`) looks up the supplier's invite and embeds it
      // in the payload so this link resolves; if it's absent (older rows or a
      // failed lookup), degrade to the supplier RFQ inbox.
      if (role === "supplier") {
        if (inviteId)
          return { href: `/supplier/rfqs/${inviteId}`, label: "view" };
        return { href: "/supplier/rfqs", label: "view" };
      }
      return null;
    case "quote.proposal_fulfilled":
      if (role === "organizer" && rfqId && quoteId) {
        return {
          href: `/organizer/rfqs/${rfqId}/quotes/${quoteId}`,
          label: "view",
        };
      }
      return null;
    case "booking.created":
      if (role === "organizer" && bookingId) {
        return { href: `/organizer/bookings/${bookingId}`, label: "view" };
      }
      return null;
    case "booking.awaiting_supplier":
      if (role === "supplier" && bookingId) {
        return { href: `/supplier/bookings/${bookingId}`, label: "view" };
      }
      return null;
    case "supplier.approved":
    case "supplier.rejected":
    case "supplier.doc.approved":
    case "supplier.doc.rejected":
    case "supplier.email.delivery_failed":
      if (role === "supplier") {
        return { href: "/supplier/dashboard", label: "view" };
      }
      return null;
    case "rfq_invite_declined":
      if (role === "organizer" && rfqId) {
        return { href: `/organizer/rfqs/${rfqId}`, label: "view" };
      }
      return null;
    default: {
      // Fall back to any ID we can find.
      if (role === "organizer") {
        if (bookingId)
          return { href: `/organizer/bookings/${bookingId}`, label: "view" };
        if (rfqId) return { href: `/organizer/rfqs/${rfqId}`, label: "view" };
      }
      if (role === "supplier") {
        if (bookingId)
          return { href: `/supplier/bookings/${bookingId}`, label: "view" };
        if (rfqId && inviteId)
          return { href: `/supplier/rfqs/${inviteId}`, label: "view" };
      }
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Kind → icon + tone (shared visual language across all three role inboxes).
// ---------------------------------------------------------------------------

type Tone = "success" | "danger" | "warning" | "info" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-semantic-success-100 text-semantic-success-500",
  danger: "bg-semantic-danger-100 text-semantic-danger-500",
  warning: "bg-semantic-warning-100 text-semantic-warning-500",
  info: "bg-brand-cobalt-100 text-brand-cobalt-500",
  neutral: "bg-neutral-200 text-neutral-600",
};

function iconForKind(kind: string): { icon: LucideIcon; tone: Tone } {
  switch (kind) {
    case "supplier.approved":
      return { icon: CheckCircle2, tone: "success" };
    case "supplier.rejected":
      return { icon: XCircle, tone: "danger" };
    case "supplier.doc.approved":
      return { icon: FileCheck, tone: "success" };
    case "supplier.doc.rejected":
      return { icon: FileX, tone: "danger" };
    case "supplier.email.delivery_failed":
      return { icon: MailWarning, tone: "warning" };
    case "quote.sent":
    case "quote.revised":
      return { icon: MessageSquare, tone: "info" };
    case "quote.proposal_requested":
      return { icon: Hourglass, tone: "warning" };
    case "quote.proposal_fulfilled":
      return { icon: FileText, tone: "info" };
    case "quote.accepted":
      return { icon: CheckCircle2, tone: "success" };
    case "quote.rejected":
      return { icon: XCircle, tone: "danger" };
    case "booking.created":
      return { icon: CalendarCheck, tone: "info" };
    case "booking.awaiting_supplier":
      return { icon: AlertTriangle, tone: "warning" };
    case "rfq_invite_declined":
      return { icon: XCircle, tone: "warning" };
    default:
      return { icon: Info, tone: "neutral" };
  }
}

/**
 * Human-readable one-line summary of a notification row. Falls back to the
 * raw `kind` + the first string-valued payload field when i18n keys are
 * missing (e.g. an unknown kind).
 */
function summarizeNotification(
  row: NotificationRow,
  kindLabels: Record<string, string>,
): string {
  const payload = (row.payload_jsonb ?? {}) as PayloadMap;
  const label =
    kindLabels[row.kind] ??
    // Catch-all friendly format for unknown kinds (e.g. `rfq_invite_declined`
    // which pre-dates the Sprint 4 kind union but still ends up in the inbox).
    row.kind.replace(/[._]/g, " ");

  const version = pickNumber(payload, "version");
  const preferredTitle = pickString(payload, "title");

  if (preferredTitle) return preferredTitle;

  switch (row.kind) {
    case "quote.sent":
    case "quote.revised": {
      if (version != null) return `${label} (v${version})`;
      return label;
    }
    default:
      return label;
  }
}

function bodySnippet(row: NotificationRow): string | null {
  const payload = (row.payload_jsonb ?? {}) as PayloadMap;
  const body =
    pickString(payload, "body") ??
    pickString(payload, "message") ??
    pickString(payload, "summary");
  if (!body) return null;
  return body.length > 140 ? `${body.slice(0, 137)}…` : body;
}

// ---------------------------------------------------------------------------
// Shared renderer — the three role pages all funnel through here.
// ---------------------------------------------------------------------------

export type NotificationsInboxProps = {
  role: "organizer" | "supplier" | "admin";
  rows: NotificationRow[];
  /** Server-action reference for the single-row "mark read" form. */
  markOneAction: (formData: FormData) => Promise<void>;
  /** Server-action reference for the "mark all read" form. */
  markAllAction: () => Promise<void>;
};

export default async function NotificationsInbox({
  role,
  rows,
  markOneAction,
  markAllAction,
}: NotificationsInboxProps) {
  const t = await getTranslations("notifications");

  // Map every `kinds.*` label up-front so the per-row render is pure.
  // getTranslations doesn't expose a raw object — we probe each known kind;
  // unknown kinds fall through to the raw-kind rendering path.
  const kindKeys = [
    "supplier.approved",
    "supplier.rejected",
    "supplier.doc.approved",
    "supplier.doc.rejected",
    "supplier.email.delivery_failed",
    "quote.sent",
    "quote.revised",
    "quote.accepted",
    "quote.rejected",
    "quote.proposal_requested",
    "quote.proposal_fulfilled",
    "booking.created",
    "booking.awaiting_supplier",
  ] as const;
  const kindLabels: Record<string, string> = {};
  for (const k of kindKeys) {
    kindLabels[k] = t(`kinds.${k}` as never);
  }

  const unreadRows = rows.filter((r) => r.read_at == null);
  const anyUnread = unreadRows.length > 0;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={
          rows.length > 0 && anyUnread
            ? t("unreadBadge", { count: unreadRows.length })
            : null
        }
        actions={
          anyUnread ? (
            <form action={markAllAction}>
              <Button type="submit" variant="outline" size="sm">
                {t("markAllRead")}
              </Button>
            </form>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={t("empty")}
          description={null}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const unread = row.read_at == null;
            const summary = summarizeNotification(row, kindLabels);
            const snippet = bodySnippet(row);
            const link = linkForNotification(row, role);
            const { icon: Icon, tone } = iconForKind(row.kind);
            let relative = "";
            try {
              relative = formatDistanceToNow(new Date(row.created_at), {
                addSuffix: true,
              });
            } catch {
              relative = row.created_at;
            }

            return (
              <li key={row.id}>
                <Card
                  size="sm"
                  className={cn(
                    "transition-colors",
                    unread
                      ? "ring-brand-cobalt-500/40 bg-brand-cobalt-100/30"
                      : "bg-card",
                  )}
                >
                  <div className="flex flex-wrap items-start gap-4 px-4">
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg",
                        TONE_CLASSES[tone],
                      )}
                      aria-hidden
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {unread ? (
                          <span
                            aria-hidden
                            className="inline-block size-2 shrink-0 rounded-full bg-brand-cobalt-500"
                          />
                        ) : null}
                        <span className="font-medium text-foreground">
                          {summary}
                        </span>
                      </div>
                      {snippet ? (
                        <p className="text-sm text-muted-foreground">
                          {snippet}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <time dateTime={row.created_at}>{relative}</time>
                        {link ? (
                          <>
                            <span aria-hidden>·</span>
                            <Link
                              href={link.href}
                              className="text-brand-cobalt-500 hover:underline"
                            >
                              View details
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {unread ? (
                      <form action={markOneAction} className="shrink-0">
                        <input
                          type="hidden"
                          name="notification_id"
                          value={row.id}
                        />
                        <Button type="submit" variant="ghost" size="sm">
                          {t("markRead")}
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
