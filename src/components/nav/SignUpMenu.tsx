"use client";

import Link from "next/link";
import { CalendarDays, ChevronDown, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SignUpMenuProps = {
  triggerLabel: string;
  organizerLabel: string;
  supplierLabel: string;
  organizerHint: string;
  supplierHint: string;
};

export function SignUpMenu({
  triggerLabel,
  organizerLabel,
  supplierLabel,
  organizerHint,
  supplierHint,
}: SignUpMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5">
          {triggerLabel}
          <ChevronDown className="size-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <DropdownMenuItem asChild className="gap-3 p-2.5">
          <Link href="/sign-up/organizer">
            <CalendarDays className="size-4 text-brand-cobalt-500" aria-hidden />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {organizerLabel}
              </span>
              <span className="text-xs text-muted-foreground">
                {organizerHint}
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-3 p-2.5">
          <Link href="/sign-up/supplier">
            <Store className="size-4 text-brand-cobalt-500" aria-hidden />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {supplierLabel}
              </span>
              <span className="text-xs text-muted-foreground">
                {supplierHint}
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
