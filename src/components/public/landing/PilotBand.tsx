import Link from "next/link";
import { Button } from "@/components/ui/button";

type PilotBandProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaSupplier: string;
  ctaBrowse: string;
};

/**
 * Closing CTA — a navy band framed inside a 2xl rounded card with a cobalt
 * skewed echo bleeding off the top-end corner. Primary and outlined CTAs
 * sit on the trailing edge.
 */
export function PilotBand({
  eyebrow,
  title,
  subtitle,
  ctaSupplier,
  ctaBrowse,
}: PilotBandProps) {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-brand-navy-900 p-10 text-white sm:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -end-32 -top-20 size-[24rem] skew-x-12 bg-brand-cobalt-500/20 rtl:skew-x-[-12deg]"
          />
          <div className="relative grid gap-6 sm:grid-cols-[1.4fr_auto] sm:items-center">
            <div className="flex flex-col gap-4">
              <span className="inline-flex items-center gap-2 self-start rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/85 ring-1 ring-inset ring-white/10">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-accent-gold-500"
                />
                {eyebrow}
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {title}
              </h2>
              <p className="max-w-xl text-base leading-relaxed text-white/75">
                {subtitle}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-brand-cobalt-500 text-white shadow-brand-md hover:bg-brand-cobalt-400"
              >
                <Link href="/sign-up/supplier">{ctaSupplier}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/categories">{ctaBrowse}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
