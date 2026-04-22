"use client";

import { motion } from "motion/react";
import { BadgeCheck, ShieldCheck, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type WhyIcon = "trending-up" | "shield-check" | "badge-check";

type WhyItem = {
  icon: WhyIcon;
  title: string;
  desc: string;
};

export type SignupValueHeroProps = {
  labels: {
    headline: string;
    subtitle: string;
    whyTitle: string;
    why: WhyItem[];
    footnote: string;
  };
  className?: string;
};

const ICON_MAP: Record<WhyIcon, LucideIcon> = {
  "trending-up": TrendingUp,
  "shield-check": ShieldCheck,
  "badge-check": BadgeCheck,
};

/**
 * Navy value-prop panel shown on the start side of the sign-up screen.
 * Hidden below the lg breakpoint so mobile layouts can stack without it.
 * All copy is received via `labels` — the component is i18n-agnostic.
 */
export function SignupValueHero({ labels, className }: SignupValueHeroProps) {
  return (
    <aside
      aria-label="Sevent value proposition"
      className={cn(
        "relative hidden w-[520px] shrink-0 self-stretch overflow-hidden bg-brand-navy-900 px-12 py-14 text-white lg:block",
        className,
      )}
    >
      {/* cobalt radial glow */}
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
          <svg
            width={110}
            height={26}
            viewBox="0 0 760 180"
            aria-hidden
          >
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
          className="mt-12 whitespace-pre-line text-4xl font-extrabold leading-tight tracking-tight"
        >
          {labels.headline}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.16, type: "spring", stiffness: 240, damping: 28 }}
          className="mt-4 max-w-[400px] text-base leading-relaxed text-white/72"
        >
          {labels.subtitle}
        </motion.p>

        <div className="mt-11">
          <div className="mb-4 text-xs font-bold uppercase tracking-wider text-white/60">
            {labels.whyTitle}
          </div>
          <ul className="grid gap-5">
            {labels.why.map((w, i) => {
              const Icon = ICON_MAP[w.icon];
              return (
                <motion.li
                  key={`${w.icon}-${i}`}
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
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10"
                    style={{ color: "#7ab8ff" }}
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

export default SignupValueHero;
