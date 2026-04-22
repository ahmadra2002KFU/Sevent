"use client";

import { motion } from "motion/react";
import { BadgeCheck, ShieldCheck, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SupplierSignupHeroLabels = {
  headline: string;
  whyTitle: string;
  why: { title: string; desc: string }[];
  footnote: string;
};

const ICONS: readonly LucideIcon[] = [TrendingUp, ShieldCheck, BadgeCheck];

/**
 * Supplier-specific value-prop panel shown on the logical start side of the
 * `/sign-up/supplier` screen. Matches the shape of `SignupValueHero` so the
 * two feel consistent, but is tuned to the supplier messaging track: the
 * icons are locked to the three decision pillars (real RFPs, escrow payout,
 * Wathq verification) in that fixed order, mirroring the mockup at
 * `Claude Docs/mockup-source/direction-a.jsx:49-62`.
 */
export function SupplierSignupHero({
  labels,
  className,
}: {
  labels: SupplierSignupHeroLabels;
  className?: string;
}) {
  return (
    <aside
      aria-label="Sevent supplier value proposition"
      className={cn(
        "relative hidden w-[520px] shrink-0 self-stretch overflow-hidden bg-brand-navy-900 px-12 py-14 text-white lg:block",
        className,
      )}
    >
      {/* cobalt radial glow, anchored near the logical start corner */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 0%, rgb(30 123 216 / 0.33), transparent 50%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="relative z-[1] flex min-h-full flex-col"
      >
        {/* Sevent logo-mark (inline SVG, white tone) */}
        <span
          className="inline-flex items-center"
          style={{ direction: "ltr" }}
          aria-label="Sevent"
        >
          <svg width={110} height={26} viewBox="0 0 760 180" aria-hidden>
            <path d="M24 8 L204 8 L180 148 L0 148 Z" fill="#ffffff" />
            <text
              x="102"
              y="120"
              fontFamily="Inter"
              fontWeight="900"
              fontStyle="italic"
              fontSize="140"
              textAnchor="middle"
              fill="#0f2e5c"
              letterSpacing="-4"
            >
              S
            </text>
            <text
              x="218"
              y="120"
              fontFamily="Inter"
              fontWeight="900"
              fontStyle="italic"
              fontSize="140"
              textAnchor="start"
              fill="#ffffff"
              letterSpacing="-2"
            >
              EVENT
            </text>
            <rect x="18" y="158" width="724" height="10" fill="#ffffff" />
          </svg>
        </span>

        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08, type: "spring", stiffness: 240, damping: 28 }}
          className="mt-12 whitespace-pre-line text-[42px] font-extrabold leading-[1.2] tracking-tight"
        >
          {labels.headline}
        </motion.h1>

        <div className="mt-11">
          <div className="mb-4 text-xs font-bold uppercase tracking-wider text-white/60">
            {labels.whyTitle}
          </div>
          <ul className="grid gap-5">
            {labels.why.map((w, i) => {
              const Icon = ICONS[i] ?? TrendingUp;
              return (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: 0.22 + i * 0.08,
                    type: "spring",
                    stiffness: 240,
                    damping: 28,
                  }}
                  className="flex items-start gap-3.5"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: "rgba(30,123,216,0.22)",
                      color: "#7ab8ff",
                    }}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold leading-tight">
                      {w.title}
                    </div>
                    <div className="mt-1 text-[13px] leading-relaxed text-white/60">
                      {w.desc}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>

        <div className="flex-1" />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="mt-10 text-xs text-white/50"
        >
          {labels.footnote}
        </motion.div>
      </motion.div>
    </aside>
  );
}

export default SupplierSignupHero;
