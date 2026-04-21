"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ICONS, type NavIconKey } from "./navIcons";

export type NavLinkItem = {
  href: string;
  label: string;
  iconKey: NavIconKey;
};

type NavLinksProps = {
  items: NavLinkItem[];
  tone: "light" | "dark";
};

/**
 * Checks if `pathname` is at, or within, the nav item's `href`. Dashboard
 * entries live at `/<role>/dashboard`, but we also treat the bare `/<role>`
 * landing URL as matching dashboard. Otherwise we require either an exact
 * match or a trailing-slash-boundary match so `/organizer/events` doesn't
 * light up while viewing `/organizer/events-archive` (no current route, but
 * keeps the logic future-proof).
 */
function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(`${href}/`)) return true;
  return false;
}

/**
 * Desktop role nav — icon + label pills with active-route highlighting.
 *
 * Client component so `usePathname` is available. Rendered beside `TopNav`'s
 * server-resolved user/auth pieces. Keep this purely presentational; role
 * data fetching stays in the server parent.
 *
 * Tap-target contract: every `<Link>` is `min-h-[44px]` and `min-w-[44px]`,
 * which combined with `px-3` and `gap-2` icon spacing meets the Sevent
 * low-literacy-pass accessibility target.
 */
export function NavLinks({ items, tone }: NavLinksProps) {
  const pathname = usePathname() ?? "/";

  return (
    <ul className="hidden items-center gap-1 text-sm md:flex">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.iconKey];
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md px-3 py-2 font-medium transition-colors",
                tone === "dark"
                  ? active
                    ? "bg-white/15 text-white"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                  : active
                    ? "bg-brand-cobalt-100 text-brand-navy-900"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
