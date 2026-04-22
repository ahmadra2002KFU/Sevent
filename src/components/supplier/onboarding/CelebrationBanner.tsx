"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "motion/react";
import { BadgeCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type CelebrationBannerProps = {
  supplierName: string;
  labels: {
    smallLabel: string;
    title: string;
    body: string;
    ctaPrimary: string;
    ctaPrimaryHref: string;
    ctaSecondary: string;
    ctaSecondaryHref: string;
  };
  onDismiss?: () => void;
  className?: string;
};

const CONFETTI_COLORS = ["#c8993a", "#ffffff", "#dcebfb"] as const;

type Particle = {
  top: number;
  start: number;
  w: number;
  h: number;
  color: string;
  rot: number;
  delay: number;
  bobDuration: number;
};

// Seeded PRNG so SSR + hydration produce the same particle placements.
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildParticles(count: number, seed = 42): Particle[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => ({
    top: rand() * 100,
    start: rand() * 100,
    w: 6 + rand() * 4,
    h: 10 + rand() * 6,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rot: rand() * 360,
    delay: rand() * 1.2,
    bobDuration: 1.8 + rand() * 1.4,
  }));
}

/**
 * Approval celebration banner. Renders a cobalt→success gradient with 14
 * gently bobbing confetti particles and two stacked CTAs.
 * Includes an optional dismiss affordance in the top end corner.
 */
export function CelebrationBanner({
  supplierName,
  labels,
  onDismiss,
  className,
}: CelebrationBannerProps) {
  const particles = useMemo(() => buildParticles(14), []);

  return (
    <motion.section
      role="status"
      aria-live="polite"
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-r from-semantic-success-500 to-brand-cobalt-500 px-8 py-7 text-white",
        className,
      )}
    >
      {/* Confetti */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-[1px] opacity-80"
            style={{
              top: `${p.top}%`,
              insetInlineStart: `${p.start}%`,
              width: `${p.w}px`,
              height: `${p.h}px`,
              background: p.color,
              transform: `rotate(${p.rot}deg)`,
            }}
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: p.bobDuration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: p.delay,
            }}
          />
        ))}
      </div>

      {/* Optional dismiss */}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute end-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}

      <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20">
          <BadgeCheck className="h-[34px] w-[34px]" aria-hidden />
        </div>

        <div className="flex-1">
          <div className="text-xs font-bold uppercase tracking-wide text-white/85">
            {labels.smallLabel.replace("{name}", supplierName)}
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 24 }}
            className="mt-1 text-3xl font-extrabold tracking-tight"
          >
            {labels.title}
          </motion.h1>
          <p className="mt-2 max-w-[600px] text-sm leading-relaxed text-white/90">
            {labels.body}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-stretch">
          <Link
            href={labels.ctaPrimaryHref}
            className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-brand-navy-900 transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-cobalt-500"
          >
            {labels.ctaPrimary}
          </Link>
          <Link
            href={labels.ctaSecondaryHref}
            className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-black/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {labels.ctaSecondary}
          </Link>
        </div>
      </div>
    </motion.section>
  );
}

export default CelebrationBanner;
