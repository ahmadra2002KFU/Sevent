"use client";

import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { MARKET_SEGMENTS, type MarketSegmentSlug } from "@/lib/domain/segments";

type Props = {
  value: ReadonlyArray<MarketSegmentSlug>;
  onChange: (next: MarketSegmentSlug[]) => void;
  disabled?: boolean;
  ariaLabel?: string;
};

/**
 * Multi-select tile picker for the supplier's "I work with" market segments.
 * Each tile is ≥44px tall, shows the segment icon + localized name, and
 * toggles selection on click. Low-literacy friendly — icon is as prominent
 * as the text.
 */
export function SegmentsPicker({ value, onChange, disabled, ariaLabel }: Props) {
  const locale = useLocale();
  const isAr = locale === "ar";

  function toggle(slug: MarketSegmentSlug) {
    if (disabled) return;
    const isSelected = value.includes(slug);
    if (isSelected) {
      onChange(value.filter((s) => s !== slug));
    } else {
      onChange([...value, slug]);
    }
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="grid gap-2 sm:grid-cols-2"
    >
      {MARKET_SEGMENTS.map((s) => {
        const isActive = value.includes(s.slug);
        const label = isAr ? s.name_ar : s.name_en;
        return (
          <button
            key={s.slug}
            type="button"
            disabled={disabled}
            onClick={() => toggle(s.slug)}
            aria-pressed={isActive}
            className={cn(
              "group flex min-h-[56px] items-center gap-3 rounded-lg border px-4 py-3 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2",
              isActive
                ? "border-brand-cobalt-500 bg-brand-cobalt-100 text-brand-navy-900 shadow-brand-sm"
                : "border-border bg-card text-foreground hover:border-brand-cobalt-500/30",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <span className="text-2xl leading-none" aria-hidden>
              {s.icon}
            </span>
            <span className="flex-1 text-sm font-semibold">{label}</span>
            <span
              className={cn(
                "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                isActive
                  ? "border-brand-cobalt-500 bg-brand-cobalt-500 text-white"
                  : "border-border text-transparent",
              )}
              aria-hidden
            >
              ✓
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentsPicker;
