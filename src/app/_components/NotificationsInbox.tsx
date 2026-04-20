import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { getTranslations } from "next-intl/server";
import type { NotificationRow } from "@/lib/notifications/reader";

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

function pickString(payload: PayloadMap | null | undefined, key: string): string | null {
  if (!payload) return null;
  const v = payload[key];
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function pickNumber(payload: PayloadMap | null | undefined, key: string): number | null {
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
        if (bookingId) return { href: `/supplier/bookings/${bookingId}`, label: "view" };
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
        if (bookingId) return { href: `/organizer/bookings/${bookingId}`, label: "view" };
        if (rfqId) return { href: `/organizer/rfqs/${rfqId}`, label: "view" };
      }
      if (role === "supplier") {
        if (bookingId) return { href: `/supplier/bookings/${bookingId}`, label: "view" };
        if (rfqId && inviteId) return { href: `/supplier/rfqs/${inviteId}`, label: "view" };
      }
      return null;
    }
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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
        </div>
        {anyUnread ? (
          <form action={markAllAction}>
            <button
              type="submit"
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
            >
              {t("markAllRead")}
            </button>
          </form>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-6 text-sm text-[var(--color-muted-foreground)]">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const unread = row.read_at == null;
            const summary = summarizeNotification(row, kindLabels);
            const link = linkForNotification(row, role);
            let relative = "";
            try {
              relative = formatDistanceToNow(new Date(row.created_at), {
                addSuffix: true,
              });
            } catch {
              relative = row.created_at;
            }

            return (
              <li
                key={row.id}
                className={
                  unread
                    ? "flex flex-wrap items-start justify-between gap-3 rounded-md border border-[var(--color-sevent-green)]/40 bg-[var(--color-sevent-green)]/5 px-4 py-3"
                    : "flex flex-wrap items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-white px-4 py-3 opacity-75"
                }
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {unread ? (
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 rounded-full bg-[var(--color-sevent-green)]"
                      />
                    ) : null}
                    <span className="font-medium">{summary}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                    <time dateTime={row.created_at}>{relative}</time>
                    {link ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <Link
                          href={link.href}
                          className="text-[var(--color-sevent-green,#0a7)] hover:underline"
                        >
                          View details
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>
                {unread ? (
                  <form action={markOneAction}>
                    <input type="hidden" name="notification_id" value={row.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs hover:bg-[var(--color-muted)]"
                    >
                      {t("markRead")}
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
