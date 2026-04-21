import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { authenticateAndGetAdminClient } from "@/lib/supabase/server";
import { Logo } from "@/components/brand/Logo";
import NotificationBell from "@/app/_components/NotificationBell";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNavSheet } from "./MobileNavSheet";
import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";
import { cn } from "@/lib/utils";
import type { NavIconKey } from "./navIcons";

type Role = "organizer" | "supplier" | "admin";

type NavItem = { href: string; labelKey: string; iconKey: NavIconKey };

/**
 * Role-scoped nav items. The trailing Notifications slot is served by the
 * standalone `<NotificationBell>` icon (badge + icon), not a labeled link, so
 * it's intentionally absent from this list. If a role needs a labeled
 * "Notifications" nav item in the future, add a matching `nav.*.notifications`
 * i18n key and re-introduce it here.
 */
const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  organizer: [
    { href: "/organizer/dashboard", labelKey: "organizer.dashboard", iconKey: "dashboard" },
    { href: "/organizer/events", labelKey: "organizer.events", iconKey: "events" },
    { href: "/organizer/rfqs", labelKey: "organizer.rfqs", iconKey: "rfqs" },
    { href: "/organizer/bookings", labelKey: "organizer.bookings", iconKey: "bookings" },
  ],
  supplier: [
    { href: "/supplier/dashboard", labelKey: "supplier.dashboard", iconKey: "dashboard" },
    { href: "/supplier/onboarding", labelKey: "supplier.onboarding", iconKey: "onboarding" },
    { href: "/supplier/catalog", labelKey: "supplier.catalog", iconKey: "catalog" },
    { href: "/supplier/calendar", labelKey: "supplier.calendar", iconKey: "calendar" },
    { href: "/supplier/rfqs", labelKey: "supplier.rfqs", iconKey: "supplierRfqs" },
    { href: "/supplier/bookings", labelKey: "supplier.bookings", iconKey: "bookings" },
    { href: "/supplier/profile", labelKey: "supplier.profile", iconKey: "profile" },
  ],
  admin: [
    { href: "/admin/dashboard", labelKey: "admin.dashboard", iconKey: "dashboard" },
    { href: "/admin/verifications", labelKey: "admin.verifications", iconKey: "verifications" },
  ],
};

const NOTIFICATION_HREF: Record<Role, string> = {
  organizer: "/organizer/notifications",
  supplier: "/supplier/notifications",
  admin: "/admin/notifications",
};

const ROLE_TONE: Record<Role, "light" | "dark"> = {
  organizer: "light",
  supplier: "light",
  admin: "dark",
};

export async function TopNav({ role }: { role: Role }) {
  const auth = await authenticateAndGetAdminClient();
  const nav = await getTranslations("nav");

  let displayName: string | null = null;
  if (auth) {
    const { data } = await auth.admin
      .from("profiles")
      .select("full_name")
      .eq("id", auth.user.id)
      .maybeSingle();
    displayName = (data as { full_name?: string } | null)?.full_name ?? null;
  }

  const tone = ROLE_TONE[role];
  const items = NAV_BY_ROLE[role].map((item) => ({
    href: item.href,
    label: nav(item.labelKey),
    iconKey: item.iconKey,
  }));

  return (
    <header
      className={cn(
        "border-b backdrop-blur",
        tone === "dark"
          ? "border-white/10 bg-brand-navy-900 text-white"
          : "border-border bg-white/80 text-foreground",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <MobileNavSheet
            tone={tone}
            triggerLabel={nav("menu.open")}
            title={nav(`role.${role}`)}
            items={items}
          />
          <Link
            href="/"
            className="flex min-h-[44px] min-w-0 items-center gap-3 rounded-md px-2"
            aria-label="Sevent home"
          >
            <Logo
              variant="mark"
              tone={tone === "dark" ? "white" : "color"}
              className="h-6 w-auto shrink-0 sm:h-7"
            />
            <span
              className={cn(
                "truncate text-sm font-semibold tracking-tight hidden sm:inline",
                tone === "dark" ? "text-white/90" : "text-brand-navy-900",
              )}
            >
              {nav(`role.${role}`)}
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-1">
          <NavLinks items={items} tone={tone} />
          <div className="mx-2 hidden h-6 w-px bg-current/10 md:block" />
          <LanguageSwitcher tone={tone} />
          <NotificationBell
            href={NOTIFICATION_HREF[role]}
            className={cn(
              "relative ms-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border px-2.5 text-sm transition-colors",
              tone === "dark"
                ? "border-white/30 text-white/90 hover:bg-white/10 hover:text-white"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          />
          {auth ? (
            <UserMenu
              email={auth.user.email ?? ""}
              displayName={displayName}
              tone={tone}
            />
          ) : null}
        </nav>
      </div>
    </header>
  );
}
