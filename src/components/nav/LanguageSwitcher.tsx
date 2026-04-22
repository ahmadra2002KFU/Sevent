"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { setLocaleAction } from "./locale-actions";

type LanguageSwitcherProps = {
  tone?: "light" | "dark";
};

/**
 * One-click locale toggle matching the landing design: the button label shows
 * the *other* locale (click "EN" when in Arabic to switch, "ع" when in
 * English), because there are only two locales. Keeps the nav compact and
 * removes the dropdown affordance from the Direction A hero pattern.
 */
export function LanguageSwitcher({ tone = "light" }: LanguageSwitcherProps) {
  const current = useLocale();
  const [pending, startTransition] = useTransition();
  const nextLocale = current === "ar" ? "en" : "ar";
  const label = nextLocale === "ar" ? "ع" : "EN";
  const ariaLabel =
    nextLocale === "ar" ? "التبديل إلى العربية" : "Switch to English";

  return (
    <Button
      variant={tone === "dark" ? "ghost" : "outline"}
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => setLocaleAction(nextLocale))}
      aria-label={ariaLabel}
      className={
        tone === "dark"
          ? "min-h-[44px] min-w-[44px] gap-1.5 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
          : "min-h-[44px] min-w-[44px] gap-1.5"
      }
    >
      <span className="text-sm font-semibold">{label}</span>
    </Button>
  );
}
