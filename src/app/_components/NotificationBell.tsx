import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { authenticateAndGetAdminClient } from "@/lib/supabase/server";
import { readUnreadCountForUser } from "@/lib/notifications/reader";

export type NotificationBellProps = {
  /**
   * Target URL for the bell. Each role has its own inbox route; callers pass
   * the appropriate path so the bell stays role-scoped.
   */
  href: string;
  /**
   * Tailwind classes for the bell anchor. Layouts pass different classes so
   * the bell blends with the role's nav palette (white-on-dark for admin vs.
   * muted-on-light for organizer/supplier).
   */
  className?: string;
};

/**
 * NotificationBell — server component.
 *
 * Reads the current user's unread notification count via the service-role
 * admin client (see `authenticateAndGetAdminClient` for rationale) and renders
 * an accessible bell with a red badge when unread > 0. Re-renders on
 * navigation; no client-side state. Returns `null` when the user isn't
 * signed in (defensive — layouts should already gate access).
 */
export default async function NotificationBell({
  href,
  className,
}: NotificationBellProps) {
  const auth = await authenticateAndGetAdminClient();
  if (!auth) return null;

  const t = await getTranslations("notifications");

  let unread = 0;
  try {
    unread = await readUnreadCountForUser(auth.admin, auth.user.id);
  } catch {
    // Defensive: if the count query fails we still render the bell so the user
    // can reach the inbox.
    unread = 0;
  }

  const badge =
    unread > 0 ? (unread > 99 ? "99+" : String(unread)) : null;

  const title = t("title");
  const ariaLabel =
    badge != null
      ? `${title} (${t("unreadBadge", { count: unread })})`
      : title;

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      title={title}
      className={
        className ??
        "relative ms-1 inline-flex items-center justify-center rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm hover:bg-[var(--color-muted)]"
      }
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 3.5a4.5 4.5 0 0 0-4.5 4.5v2.2c0 .6-.24 1.18-.66 1.6L3.5 13.14h13l-1.34-1.34a2.25 2.25 0 0 1-.66-1.6V8a4.5 4.5 0 0 0-4.5-4.5Z" />
        <path d="M8 15.5a2 2 0 0 0 4 0" />
      </svg>
      {badge != null ? (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-[1.1rem] text-white"
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
