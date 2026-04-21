import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type HeroSectionProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaOrganizer: string;
  ctaSupplier: string;
  statLabel: string;
  statValue: string;
  categories: string[];
};

/**
 * Landing hero. Full-bleed navy band (brand-navy-900) with off-white ink,
 * cobalt primary CTA and outlined secondary CTA. Gold accent dot sits before
 * the eyebrow as the scarce trust marker per design-tokens.md.
 *
 * Layout is two-column on desktop: headline + CTAs on the start side, a
 * visual "proof block" on the end side with the pilot stat and the rotating
 * category list — a tangible preview of what the marketplace covers.
 */
export function HeroSection({
  eyebrow,
  title,
  subtitle,
  ctaOrganizer,
  ctaSupplier,
  statLabel,
  statValue,
  categories,
}: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-brand-navy-900 text-white">
      {/* Decorative cobalt parallelogram — echoes the logo mark, acts as */}
      {/* a navy→cobalt depth ramp without using a gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -end-40 top-1/2 hidden size-[36rem] -translate-y-1/2 skew-x-12 bg-brand-navy-700/60 md:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -end-24 top-1/2 hidden size-[28rem] -translate-y-1/2 skew-x-12 bg-brand-cobalt-500/15 md:block"
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-28 md:grid-cols-[1.15fr_1fr] md:items-center">
        <div className="flex flex-col gap-6">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-white/80 ring-1 ring-inset ring-white/10">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-accent-gold-500"
            />
            {eyebrow}
          </span>

          <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl md:text-[3.5rem]">
            {title}
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-white/75">
            {subtitle}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-brand-cobalt-500 text-white shadow-brand-md hover:bg-brand-cobalt-400"
            >
              <Link href="/sign-up?role=organizer">
                {ctaOrganizer}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1 rtl:-scale-x-100"
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
              <Link href="/sign-up?role=supplier">{ctaSupplier}</Link>
            </Button>
          </div>
        </div>

        {/* Proof block — elevated surface over the navy, offsets right on md+ */}
        <div className="relative">
          <div className="relative rounded-2xl bg-white/[0.04] p-7 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-accent-gold-500">
              <Sparkles className="size-3.5" aria-hidden />
              {statLabel}
            </div>
            <p className="mt-3 text-3xl font-bold leading-tight text-white">
              {statValue}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {categories.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/85"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
          {/* Offset echo card — pure navy, creates layered depth */}
          <div
            aria-hidden
            className="absolute -bottom-4 -end-4 -z-10 h-24 w-32 rounded-2xl bg-brand-cobalt-500/25"
          />
        </div>
      </div>
    </section>
  );
}
