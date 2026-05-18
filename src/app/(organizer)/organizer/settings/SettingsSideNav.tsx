"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Mail, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsNavIconKey = "company" | "members" | "invites";

export type SettingsNavItem = {
  href: string;
  label: string;
  iconKey: SettingsNavIconKey;
};

const ICONS: Record<SettingsNavIconKey, typeof Building2> = {
  company: Building2,
  members: Users,
  invites: Mail,
};

/**
 * Persistent left-rail nav for the Settings section. Client-only so the
 * active-tab highlight reacts to navigation without an RSC round-trip.
 */
export function SettingsSideNav({ items }: { items: SettingsNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex shrink-0 flex-col gap-1 md:sticky md:top-20 md:self-start">
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname?.startsWith(`${item.href}/`);
        const Icon = ICONS[item.iconKey];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm transition-colors",
              isActive
                ? "bg-brand-cobalt-100 font-semibold text-brand-navy-900"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
