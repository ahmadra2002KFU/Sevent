import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { authenticateAndGetAdminClient } from "@/lib/supabase/server";
import { Logo } from "@/components/brand/Logo";
import NotificationBell from "@/app/_components/NotificationBell";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNavSheet } from "./MobileNavSheet";
import { UserMenu } from "./UserMenu";
import { cn } from "@/lib/utils";

type Role = "organizer" | "supplier" | "admin";

type NavItem = { href: string; labelKey: string };

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  organizer: [
    { href: "/organizer/dashboard", labelKey: "organizer.dashboard" },
    { href: "/organizer/events", labelKey: "organizer.events" },
    { href: "/organizer/rfqs", labelKey: "organizer.rfqs" },
    { href: "/organizer/bookings", labelKey: "organizer.bookings" },
  ],
  supplier: [
    { href: "/supplier/dashboard", labelKey: "supplier.dashboard" },
    { href: "/supplier/onboarding", labelKey: "supplier.onboarding" },
    { href: "/supplier/catalog", labelKey: "supplier.catalog" },
    { href: "/supplier/calendar", labelKey: "supplier.calendar" },
    { href: "/supplier/rfqs", labelKey: "supplier.rfqs" },
    { href: "/supplier/bookings", labelKey: "supplier.bookings" },
  ],
  admin: [
    { href: "/admin/dashboard", labelKey: "admin.dashboard" },
    { href: "/admin/verifications", labelKey: "admin.verifications" },
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
  const items = NAV_BY_ROLE[role];

  return (
    <header
      className={cn(
        "border-b backdrop-blur",
        tone === "dark"
          ? "border-white/10 bg-brand-navy-900 text-white"
          : "border-border bg-white/80 text-foreground",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <MobileNavSheet
            tone={tone}
            triggerLabel={nav("menu.open")}
            title={nav(`role.${role}`)}
            items={items.map((item) => ({
              href: item.href,
              label: nav(item.labelKey),
            }))}
          />
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3"
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
          <ul className="hidden items-center gap-1 text-sm md:flex">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-medium transition-colors",
                    tone === "dark"
                      ? "text-white/80 hover:bg-white/10 hover:text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {nav(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mx-2 hidden h-6 w-px bg-current/10 md:block" />
          <LanguageSwitcher tone={tone} />
          <NotificationBell
            href={NOTIFICATION_HREF[role]}
            className={cn(
              "relative ms-1 inline-flex items-center justify-center rounded-md border px-2.5 py-1.5 text-sm transition-colors",
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
