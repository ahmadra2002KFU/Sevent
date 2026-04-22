"use client";

import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Check, Clock3, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PathCardProps = {
  title: string;
  desc: string;
  icon: LucideIcon;
  steps: string[];
  eta: string;
  active: boolean;
  tag?: string;
  /** Title over the bullet list — "What you'll need". */
  needsTitle: string;
  /** Word(s) before the ETA, e.g. "Takes about". */
  etaPrefix: string;
  /** Optional trailing word after ETA, e.g. "approximately". */
  etaSuffix?: string;
  onClick: () => void;
};

/**
 * Single path-picker card. One of two side-by-side cards on `/supplier/onboarding/path`.
 * Visual spec: `Claude Docs/mockup-source/direction-a.jsx:173-218`.
 *
 *  - 2px cobalt border + shadow when `active`, otherwise neutral-200 border.
 *  - Optional gold "tag" pill anchored top-end (e.g. "verified supplier" badge).
 *  - 52×52 icon tile flips from tinted (idle) to solid cobalt (active).
 *  - Active state also renders a 22×22 check-circle at the top-end of the title row.
 */
export function PathCard({
  title,
  desc,
  icon: Icon,
  steps,
  eta,
  active,
  tag,
  needsTitle,
  etaPrefix,
  etaSuffix,
  onClick,
}: PathCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      aria-pressed={active}
      className={cn(
        "relative rounded-[14px] border-2 bg-white p-7 text-start transition-shadow",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2",
        active
          ? "border-brand-cobalt-500 shadow-[0_10px_30px_rgba(30,123,216,0.18)]"
          : "border-neutral-200 shadow-brand-sm hover:border-brand-cobalt-500/40",
      )}
    >
      {tag ? (
        <div className="absolute -top-3 end-5 inline-flex items-center gap-1.5 rounded-md bg-accent-gold-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-brand-sm">
          <BadgeCheck className="size-3" strokeWidth={2.4} aria-hidden />
          {tag}
        </div>
      ) : null}

      <div className="flex items-start gap-3.5">
        <div
          className={cn(
            "flex size-[52px] shrink-0 items-center justify-center rounded-xl transition-colors",
            active
              ? "bg-brand-cobalt-500 text-white"
              : "bg-brand-cobalt-100 text-brand-cobalt-500",
          )}
        >
          <Icon className="size-[26px]" strokeWidth={1.8} aria-hidden />
        </div>
        <div className="flex-1">
          <h3 className="text-[19px] font-extrabold text-brand-navy-900">
            {title}
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-600">
            {desc}
          </p>
        </div>

        <AnimatePresence>
          {active ? (
            <motion.span
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 45 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-brand-cobalt-500 text-white"
              aria-hidden
            >
              <Check className="size-3.5" strokeWidth={3} />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="mt-5 border-t border-neutral-200 pt-4">
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
          {needsTitle}
        </div>
        <ul className="grid gap-2">
          {steps.map((s) => (
            <li
              key={s}
              className="flex items-center gap-2.5 text-[13.5px] text-brand-navy-900"
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-brand-cobalt-500"
              />
              {s}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-neutral-600">
          <Clock3 className="size-[13px]" strokeWidth={1.8} aria-hidden />
          <span>
            {etaPrefix} {eta}
            {etaSuffix ? ` ${etaSuffix}` : ""}
          </span>
        </div>
      </div>
    </motion.button>
  );
}
