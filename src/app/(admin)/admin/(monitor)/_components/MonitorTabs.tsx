"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
};

/**
 * Sub-nav rendered by `(monitor)/layout.tsx` across the three admin monitor
 * pages — RFQs, Applications, Proposals. Client component so it can read
 * `usePathname()` for active-tab styling. The detail route `/admin/rfqs/[id]`
 * highlights the RFQs tab because the prefix match still passes there.
 */
export function MonitorTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="Monitor sections"
      className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1"
    >
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-7 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
