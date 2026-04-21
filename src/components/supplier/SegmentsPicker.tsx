"use client";

import { useLocale } from "next-intl";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
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
 * Each tile is ≥56px tall and toggles on click. Motion: hover lift, tap squish,
 * spring check-mark, and a layoutId'd glow that morphs across active tiles.
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
    <LayoutGroup id="segments-picker">
      <div
        role="group"
        aria-label={ariaLabel}
        className="grid gap-2 sm:grid-cols-2"
      >
        {MARKET_SEGMENTS.map((s) => {
          const isActive = value.includes(s.slug);
          const label = isAr ? s.name_ar : s.name_en;
          return (
            <motion.button
              key={s.slug}
              type="button"
              disabled={disabled}
              onClick={() => toggle(s.slug)}
              aria-pressed={isActive}
              whileHover={disabled ? undefined : { y: -2, scale: 1.01 }}
              whileTap={disabled ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
              className={cn(
                "group relative flex min-h-[56px] items-center gap-3 overflow-hidden rounded-lg border px-4 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2",
                isActive
                  ? "border-brand-cobalt-500 text-brand-navy-900 shadow-brand-sm"
                  : "border-border bg-card text-foreground hover:border-brand-cobalt-500/30",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              {isActive ? (
                <motion.span
                  layoutId={`segment-bg-${s.slug}`}
                  className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-cobalt-100 via-brand-cobalt-100/80 to-brand-cobalt-100/40"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  aria-hidden
                />
              ) : null}
              <span className="relative flex-1 text-sm font-semibold">
                {label}
              </span>
              <motion.span
                animate={{
                  backgroundColor: isActive ? "rgb(30 123 216)" : "transparent",
                  borderColor: isActive ? "rgb(30 123 216)" : "rgb(231 230 223)",
                  scale: isActive ? 1 : 0.85,
                }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
                className="relative inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold text-white"
                aria-hidden
              >
                <AnimatePresence>
                  {isActive ? (
                    <motion.span
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 45 }}
                      transition={{ type: "spring", stiffness: 500, damping: 24 }}
                    >
                      ✓
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

export default SegmentsPicker;
