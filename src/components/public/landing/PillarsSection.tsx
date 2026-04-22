import { Handshake, Scale, ShieldCheck, type LucideIcon } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

export type PillarItem = {
  title: string;
  body: string;
  link: string;
};

type PillarsSectionProps = {
  id?: string;
  eyebrow: string;
  heading: string;
  lede: string;
  items: ReadonlyArray<PillarItem>;
};

const PILLAR_ICONS: ReadonlyArray<LucideIcon> = [
  Handshake,
  Scale,
  ShieldCheck,
];

/**
 * "Why Sevent" pillars. Three equal-width cards on desktop, stacked on
 * mobile. Each card lifts on hover with a cobalt-tinted border.
 */
export function PillarsSection({
  id,
  eyebrow,
  heading,
  lede,
  items,
}: PillarsSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className="bg-neutral-50 py-20 sm:py-24"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id={id}
          eyebrow={eyebrow}
          heading={heading}
          lede={lede}
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {items.map((item, idx) => {
            const Icon = PILLAR_ICONS[idx] ?? PILLAR_ICONS[0];
            return (
              <article
                key={item.title}
                className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-7 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-cobalt-500/30 hover:shadow-brand-md"
              >
                <div className="inline-flex size-11 items-center justify-center rounded-[0.625rem] bg-brand-cobalt-100 text-brand-cobalt-500">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h3 className="text-lg font-bold tracking-tight text-brand-navy-900">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-neutral-600">
                  {item.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
