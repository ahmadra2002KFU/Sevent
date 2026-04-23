"use client";

import { useOptimistic, useTransition } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { setLocaleAction } from "./locale-actions";

type Locale = "en" | "ar";
type Tone = "light" | "dark";

type LanguageSwitcherProps = {
  tone?: Tone;
  className?: string;
};

const OPTIONS: ReadonlyArray<{
  code: Locale;
  label: string;
  aria: string;
  fontFamily?: string;
}> = [
  { code: "en", label: "EN", aria: "Switch to English" },
  {
    code: "ar",
    label: "ع",
    aria: "التبديل إلى العربية",
    fontFamily: "var(--font-arabic)",
  },
];

/**
 * Pill-style locale toggle with a sliding indicator. Locked to dir="ltr" so
 * EN is always on the left and ع on the right regardless of the page
 * direction — standard pattern for locale switchers, avoids the indicator
 * swapping sides across a language change. Uses useOptimistic so the
 * indicator slides the moment the user clicks, before the server action's
 * revalidatePath completes.
 */
export function LanguageSwitcher({
  tone = "light",
  className,
}: LanguageSwitcherProps) {
  const current = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useOptimistic<Locale>(current);

  const dark = tone === "dark";

  const handleSwitch = (next: Locale) => {
    if (next === active) return;
    startTransition(async () => {
      setActive(next);
      await setLocaleAction(next);
    });
  };

  return (
    <div
      dir="ltr"
      role="radiogroup"
      aria-label="Language"
      className={cn(
        "relative inline-flex h-11 w-[96px] shrink-0 items-center rounded-full p-1",
        "border text-xs font-semibold select-none",
        "transition-colors duration-200",
        dark
          ? "border-white/25 bg-white/5"
          : "border-border bg-muted/60",
        isPending && "opacity-90",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full",
          "shadow-sm will-change-transform",
          "transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
          dark ? "bg-white" : "bg-foreground",
        )}
        style={{
          transform: active === "ar" ? "translateX(100%)" : "translateX(0%)",
        }}
      />
      {OPTIONS.map(({ code, label, aria, fontFamily }) => {
        const isActive = active === code;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={aria}
            onClick={() => handleSwitch(code)}
            className={cn(
              "relative z-10 flex h-full flex-1 items-center justify-center rounded-full",
              "outline-none transition-colors duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? dark
                  ? "text-slate-900"
                  : "text-background"
                : dark
                  ? "text-white/70 hover:text-white"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="leading-none" style={fontFamily ? { fontFamily } : undefined}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
