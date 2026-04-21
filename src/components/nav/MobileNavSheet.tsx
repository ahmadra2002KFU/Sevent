"use client";

import Link from "next/link";
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

export type MobileNavItem = { href: string; label: string };

type MobileNavSheetProps = {
  items: MobileNavItem[];
  tone: "light" | "dark";
  triggerLabel: string;
  title: string;
};

/**
 * Mobile-only hamburger-triggered nav drawer. Rendered inside `TopNav` at
 * `< md` widths so the role nav doesn't overflow on phones. Desktop nav lives
 * elsewhere — this component hides itself at `md:` via the trigger wrapper.
 *
 * Uses shadcn Sheet (slide-in from end-side — automatically mirrors in RTL
 * because Sheet's `side` prop resolves against logical start/end).
 */
export function MobileNavSheet({
  items,
  tone,
  triggerLabel,
  title,
}: MobileNavSheetProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={triggerLabel}
          className={cn(
            "md:hidden",
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
            {items.map((item) => (
              <li key={item.href}>
                <SheetClose asChild>
                  <Link
                    href={item.href}
                    className="flex items-center rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {item.label}
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
