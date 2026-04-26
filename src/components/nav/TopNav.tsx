import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  createSupabaseServiceRoleClient,
  getCurrentUser,
} from "@/lib/supabase/server";
import { resolveAccessForUser } from "@/lib/auth/access";
import type { AccessFeature } from "@/lib/auth/featureMatrix";
import { Logo } from "@/components/brand/Logo";
import NotificationBell from "@/app/_components/NotificationBell";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNavSheet } from "./MobileNavSheet";
import { NavLinks } from "./NavLinks";
import { UserMenu } from "./UserMenu";
import { cn } from "@/lib/utils";
import type { NavIconKey } from "./navIcons";

type Role = "organizer" | "supplier" | "admin";

type NavItem = {
  href: string;
  labelKey: string;
  iconKey: NavIconKey;
  feature: AccessFeature;
};

/**
 * Role-scoped nav items. Each item declares the AccessFeature it depends on;
 * the runtime filters the list so a supplier who's `pending_review` sees only
 * Dashboard + Onboarding, a `rejected` supplier sees the same (no catalog /
 * bookings / rfqs / profile), and an `approved` supplier sees the full set.
 *
 * The trailing Notifications slot is served by the standalone
 * `<NotificationBell>` icon (badge + icon), not a labeled link, so it's
 * intentionally absent from this list.
 */
const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  organizer: [
    {
      href: "/organizer/dashboard",
      labelKey: "organizer.dashboard",
      iconKey: "dashboard",
      feature: "organizer.dashboard",
    },
    {
      href: "/organizer/events",
      labelKey: "organizer.events",
      iconKey: "events",
      feature: "organizer.events",
    },
    {
      href: "/organizer/rfqs",
      labelKey: "organizer.rfqs",
      iconKey: "rfqs",
      feature: "organizer.rfqs",
    },
    {
      href: "/organizer/bookings",
      labelKey: "organizer.bookings",
      iconKey: "bookings",
      feature: "organizer.bookings",
    },
  ],
  supplier: [
    {
      href: "/supplier/dashboard",
      labelKey: "supplier.dashboard",
      iconKey: "dashboard",
      feature: "supplier.dashboard",
    },
    {
      href: "/supplier/onboarding",
      labelKey: "supplier.onboarding",
      iconKey: "onboarding",
      feature: "supplier.onboarding.wizard",
    },
    {
      href: "/supplier/catalog",
      labelKey: "supplier.catalog",
      iconKey: "catalog",
      feature: "supplier.catalog",
    },
    {
      href: "/supplier/calendar",
      labelKey: "supplier.calendar",
      iconKey: "calendar",
      feature: "supplier.calendar",
    },
    {
      href: "/supplier/rfqs",
      labelKey: "supplier.rfqs",
      iconKey: "supplierRfqs",
      feature: "supplier.rfqs.view",
    },
    {
      href: "/supplier/opportunities",
      labelKey: "supplier.opportunities",
      iconKey: "opportunities",
      feature: "supplier.opportunities.browse",
    },
    {
      href: "/supplier/bookings",
      labelKey: "supplier.bookings",
      iconKey: "bookings",
      feature: "supplier.bookings",
    },
    {
      href: "/supplier/profile",
      labelKey: "supplier.profile",
      iconKey: "profile",
      feature: "supplier.profile.customize",
    },
  ],
  admin: [
    {
      href: "/admin/dashboard",
      labelKey: "admin.dashboard",
      iconKey: "dashboard",
      feature: "admin.console",
    },
    {
      href: "/admin/verifications",
      labelKey: "admin.verifications",
      iconKey: "verifications",
      feature: "admin.console",
    },
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
  const [user, nav] = await Promise.all([
    getCurrentUser(),
    getTranslations("nav"),
  ]);

  const decision = await resolveAccessForUser(user?.id ?? null);

  let displayName: string | null = null;
  let email: string | null = null;
  if (user) {
    email = user.email ?? null;
    const admin = createSupabaseServiceRoleClient();
    const { data } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    displayName = (data as { full_name?: string } | null)?.full_name ?? null;
  }

  const tone = ROLE_TONE[role];
  // Filter nav items by the caller's feature set so a supplier in
  // `pending_review` / `rejected` doesn't see clickable links to Catalog /
  // Calendar / Bookings / RFQs / Profile. The featureless fallback keeps a
  // Dashboard link visible so the user isn't stranded with no navigation.
  const candidateItems = NAV_BY_ROLE[role];
  const allowedItems = candidateItems.filter(
    (item) => decision.features[item.feature],
  );
  const items = (allowedItems.length > 0
    ? allowedItems
    : candidateItems.slice(0, 1)
  ).map((item) => ({
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
        <div className="flex shrink-0 items-center gap-2">
          <MobileNavSheet
            tone={tone}
            triggerLabel={nav("menu.open")}
            title={nav(`role.${role}`)}
            items={items}
          />
          <Link
            href={decision.bestDestination}
            className="flex min-h-[44px] shrink-0 items-center gap-3 rounded-md px-2"
            aria-label="Sevent home"
          >
            <Logo
              variant="mark"
              tone={tone === "dark" ? "white" : "color"}
              className="h-6 w-auto shrink-0 sm:h-7"
            />
            <span
              className={cn(
                "truncate text-sm font-semibold tracking-tight hidden xl:inline",
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
          {user ? (
            <UserMenu
              email={email ?? ""}
              displayName={displayName}
              tone={tone}
            />
          ) : null}
        </nav>
      </div>
    </header>
  );
}
