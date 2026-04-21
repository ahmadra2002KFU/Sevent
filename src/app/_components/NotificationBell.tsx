import Link from "next/link";
import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { authenticateAndGetAdminClient } from "@/lib/supabase/server";
import { readUnreadCountForUser } from "@/lib/notifications/reader";
import { cn } from "@/lib/utils";

export type NotificationBellProps = {
  /**
   * Target URL for the bell. Each role has its own inbox route; callers pass
   * the appropriate path so the bell stays role-scoped.
   */
  href: string;
  /**
   * Tailwind classes for the bell anchor. Layouts pass different classes so
   * the bell blends with the role's nav palette (white-on-dark for admin vs.
   * muted-on-light for organizer/supplier). The class is applied to the
   * `<Link>` wrapper; default styling approximates a shadcn ghost icon Button
   * while remaining customizable from the caller.
   */
  className?: string;
};

const DEFAULT_CLASSNAME =
  "relative ms-1 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

/**
 * NotificationBell — server component.
 *
 * Reads the current user's unread notification count via the service-role
 * admin client (see `authenticateAndGetAdminClient` for rationale) and renders
 * an accessible bell with a destructive-toned badge when unread > 0.
 * Re-renders on navigation; no client-side state. Returns `null` when the
 * user isn't signed in (defensive — layouts should already gate access).
 *
 * Consumed by: `src/components/nav/TopNav.tsx` for organizer/supplier/admin
 * roles. The caller owns the palette (via `className` override) — this
 * component is intentionally style-agnostic about hover tone so admin's dark
 * nav and organizer's light nav can both host the same bell.
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

  const badge = unread > 0 ? (unread > 99 ? "99+" : String(unread)) : null;

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
      className={cn(DEFAULT_CLASSNAME, className)}
      data-slot="notification-bell"
    >
      <Bell aria-hidden className="size-4" />
      {badge != null ? (
        <span
          aria-hidden="true"
          className="absolute -top-1 -end-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-semantic-danger-500 px-1 text-[10px] font-semibold leading-[1.1rem] text-white ring-2 ring-background"
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
