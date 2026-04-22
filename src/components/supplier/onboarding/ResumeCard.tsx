"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ResumeCardLabels = {
  /** "Pick up where you left off" */
  title: string;
  /** "Step {step} of {total} · auto-saved a few minutes ago" — pre-rendered. */
  body: string;
  /** "Continue" */
  cta: string;
};

export type ResumeCardProps = {
  percent: number;
  step: number;
  totalSteps?: number;
  labels: ResumeCardLabels;
  onResume?: () => void;
  className?: string;
};

/**
 * Small resumption nudge shown above the path picker (and later reused above
 * each wizard step). Visual spec: `Claude Docs/mockup-source/shared.jsx:230-259`.
 *
 * The percent indicator is a 42×42 SVG ring; body copy is pre-interpolated by
 * the caller (e.g. via next-intl `t("body", { step, total })`) so we don't
 * have to couple this component to any translation namespace.
 */
export function ResumeCard({
  percent,
  labels,
  onResume,
  className,
}: ResumeCardProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  // Circumference of an r=18 circle ≈ 113.097. We draw `clamped%` of it.
  const circumference = 2 * Math.PI * 18;
  const dash = (clamped / 100) * circumference;

  return (
    <div
      className={cn(
        "mb-5 flex items-center gap-3 rounded-[12px] border border-brand-cobalt-500/20 bg-gradient-to-br from-brand-cobalt-100/60 to-neutral-100 px-4 py-3.5",
        className,
      )}
    >
      <div className="relative flex size-[42px] shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-brand-cobalt-500">
        <svg
          viewBox="0 0 42 42"
          className="absolute inset-0 size-full -rotate-90"
          aria-hidden
        >
          <circle
            cx="21"
            cy="21"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-neutral-200"
          />
          <circle
            cx="21"
            cy="21"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className="text-brand-cobalt-500"
          />
        </svg>
        <span className="relative">{clamped}%</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold text-brand-navy-900">
          {labels.title}
        </div>
        <div className="mt-0.5 text-[12.5px] text-neutral-600">
          {labels.body}
        </div>
      </div>
      {onResume ? (
        <button
          type="button"
          onClick={onResume}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-navy-700"
        >
          {labels.cta}
          <ChevronRight className="size-[14px] rtl:rotate-180" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
