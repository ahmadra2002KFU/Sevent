"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NAV_ICONS, type NavIconKey } from "./navIcons";

export type MobileNavItem = {
  href: string;
  label: string;
  iconKey: NavIconKey;
};

type MobileNavSheetProps = {
  items: MobileNavItem[];
  tone: "light" | "dark";
  triggerLabel: string;
  title: string;
};

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(`${href}/`)) return true;
  return false;
}

/**
 * Mobile-only hamburger-triggered nav drawer. Rendered inside `TopNav` at
 * `< md` widths so the role nav doesn't overflow on phones. Desktop nav lives
 * in `NavLinks` — this component hides itself at `md:` via the trigger wrapper.
 *
 * Uses shadcn Sheet (slide-in from end-side — automatically mirrors in RTL
 * because Sheet's `side` prop resolves against logical start/end).
 *
 * Tap-target contract: trigger button + every link inside the drawer is
 * `min-h-[44px]` / `min-w-[44px]`. Matches the 44x44 target enforced on the
 * desktop nav so touch users don't get a smaller grab area.
 */
export function MobileNavSheet({
  items,
  tone,
  triggerLabel,
  title,
}: MobileNavSheetProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={triggerLabel}
          className={cn(
            "min-h-[44px] min-w-[44px] md:hidden",
            tone === "dark"
              ? "text-white hover:bg-white/10 hover:text-white"
              : "text-foreground hover:bg-muted",
          )}
        >
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(20rem,85vw)]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <nav className="mt-4 flex flex-col px-4 pb-6">
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = NAV_ICONS[item.iconKey];
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <SheetClose asChild>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-brand-cobalt-100 text-brand-navy-900"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <Icon aria-hidden className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </SheetClose>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
