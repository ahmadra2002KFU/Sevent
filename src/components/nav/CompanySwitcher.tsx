"use client";

import { Building2, Check } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { switchActiveCompanyAction } from "@/lib/auth/switchActiveCompany.action";

export type CompanyOption = {
  id: string;
  name: string;
};

type CompanySwitcherProps = {
  companies: CompanyOption[];
  activeCompanyId: string | null;
  label: string;
};

/**
 * Multi-company switcher mounted inside UserMenu. Renders nothing when
 * the caller has fewer than two memberships — single-company organizers
 * (the common case today) keep the existing menu shape.
 *
 * Each company is its own `<form>` posting to switchActiveCompanyAction;
 * keeping forms separate (rather than one form with hidden inputs) means
 * keyboard navigation submits the focused item and the action receives
 * exactly one company_id.
 */
export function CompanySwitcher({
  companies,
  activeCompanyId,
  label,
}: CompanySwitcherProps) {
  if (companies.length < 2) return null;
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {label}
      </DropdownMenuLabel>
      {companies.map((c) => {
        const isActive = c.id === activeCompanyId;
        return (
          <form key={c.id} action={switchActiveCompanyAction}>
            <input type="hidden" name="company_id" value={c.id} />
            <DropdownMenuItem asChild>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center justify-between gap-2"
                aria-current={isActive ? "true" : undefined}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Building2 className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{c.name}</span>
                </span>
                {isActive ? (
                  <Check className="size-4 shrink-0 text-brand-cobalt-500" aria-hidden />
                ) : null}
              </button>
            </DropdownMenuItem>
          </form>
        );
      })}
    </>
  );
}
