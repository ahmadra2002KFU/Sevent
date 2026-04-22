import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export type HeroCategoryChip = {
  key: string;
  label: string;
  icon: LucideIcon;
};

export type HeroStat = {
  value: string;
  label: string;
};

type LandingHeroProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaOrganizer: string;
  ctaSupplier: string;
  statLabel: string;
  statValue: string;
  chips: ReadonlyArray<HeroCategoryChip>;
  stats: ReadonlyArray<HeroStat>;
};

/**
 * Landing hero — full-bleed navy band with an offset cobalt echo, headline
 * on the start side, and a glass proof card + KPI trio on the end side.
 *
 * Design fidelity notes:
 *   - Two layered skew-x-12 parallelograms behind the headline for depth.
 *   - Proof card has a cobalt offset shadow block bottom-end.
 *   - RTL-safe: the decorative skews invert via `rtl:` variants so the echo
 *     stays on the trailing edge in Arabic.
 */
export function LandingHero({
  eyebrow,
  title,
  subtitle,
  ctaOrganizer,
  ctaSupplier,
  statLabel,
  statValue,
  chips,
  stats,
}: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden bg-brand-navy-900 text-white">
      {/* Decorative skewed navy + cobalt parallelograms — depth without gradients */}
      <div
        aria-hidden
        className="pointer-events-none absolute -end-40 top-1/2 hidden size-[36rem] -translate-y-1/2 skew-x-12 bg-brand-navy-700/60 md:block rtl:skew-x-[-12deg]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -end-16 top-1/2 hidden size-[28rem] -translate-y-1/2 skew-x-12 bg-brand-cobalt-500/15 md:block rtl:skew-x-[-12deg]"
      />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:gap-12 sm:px-6 sm:py-20 md:grid-cols-2 md:items-center md:py-24">
        <div className="flex flex-col gap-5 sm:gap-6">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-white/5 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/85 ring-1 ring-inset ring-white/10 sm:text-xs">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-accent-gold-500"
            />
            {eyebrow}
          </span>

          <h1 className="max-w-[18ch] text-[1.75rem] font-black leading-[1.2] tracking-tight text-white sm:text-3xl md:text-[2rem] md:leading-[1.2] lg:text-[2.25rem]">
            {title}
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
            {subtitle}
          </p>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              asChild
              size="lg"
              className="bg-brand-cobalt-500 text-white shadow-brand-md hover:bg-brand-cobalt-400"
            >
              <Link href="/sign-up?role=organizer">
                {ctaOrganizer}
                <ArrowRight
                  className="size-4 rtl:-scale-x-100"
                  aria-hidden
                />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/sign-up/supplier">{ctaSupplier}</Link>
            </Button>
          </div>

          {stats.length > 0 ? (
            <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-white/10 pt-5 sm:mt-8 sm:pt-6">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col">
                  <dt className="order-2 text-xs text-white/65 sm:text-[0.78rem]">
                    {s.label}
                  </dt>
                  <dd className="order-1 text-xl font-extrabold text-white sm:text-2xl">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {/* Proof card — elevated glass surface with category chips */}
        <div className="relative">
          <div className="relative rounded-[1.25rem] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/10 backdrop-blur-sm sm:p-7">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-gold-500">
              <Sparkles className="size-3.5" aria-hidden />
              {statLabel}
            </div>
            <p className="mt-3 text-2xl font-bold leading-snug text-white sm:text-[1.6rem]">
              {statValue}
            </p>
            {chips.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {chips.map((chip) => {
                  const ChipIcon = chip.icon;
                  return (
                    <span
                      key={chip.key}
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/90"
                    >
                      <ChipIcon
                        className="size-3.5 text-brand-cobalt-400"
                        aria-hidden
                      />
                      {chip.label}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>
          {/* Offset cobalt echo block */}
          <div
            aria-hidden
            className="absolute -bottom-4 -end-4 -z-10 h-24 w-36 rounded-[1.25rem] bg-brand-cobalt-500/25"
          />
        </div>
      </div>
    </section>
  );
}
