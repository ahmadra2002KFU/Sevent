import Link from "next/link";
import { ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "./SectionHeading";

export type CategoryGridItem = {
  slug: string;
  name: string;
  countLabel: string;
  icon: LucideIcon;
  href: string;
};

type CategoryGridProps = {
  id?: string;
  eyebrow: string;
  heading: string;
  lede: string;
  browseAll: string;
  items: ReadonlyArray<CategoryGridItem>;
};

/**
 * 4x2 category grid on desktop, collapsing to 2-up / 1-up on narrower
 * viewports. Each tile is a link with a trailing arrow affordance that
 * animates on hover alongside an icon-chip colour flip.
 */
export function CategoryGrid({
  id,
  eyebrow,
  heading,
  lede,
  browseAll,
  items,
}: CategoryGridProps) {
  return (
    <section
      aria-labelledby={id}
      className="bg-neutral-50 py-20 sm:py-24"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading
            id={id}
            eyebrow={eyebrow}
            heading={heading}
            lede={lede}
          />
          <Button asChild variant="outline" size="lg">
            <Link href="/categories">
              {browseAll}
              <ArrowRight
                className="size-4 rtl:-scale-x-100"
                aria-hidden
              />
            </Link>
          </Button>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.slug}
                href={item.href}
                className="group relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-[0.875rem] border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-cobalt-500/40 hover:shadow-brand-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2"
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex size-[46px] items-center justify-center rounded-[0.75rem] bg-neutral-100 text-brand-navy-900 transition-colors duration-200 group-hover:bg-brand-cobalt-500 group-hover:text-white">
                    <Icon className="size-[22px]" aria-hidden />
                  </span>
                  <ArrowUpRight
                    className="size-[18px] text-neutral-400 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:text-brand-cobalt-500 rtl:-scale-x-100"
                    aria-hidden
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-bold tracking-tight text-brand-navy-900">
                    {item.name}
                  </h3>
                  <p className="text-[13px] text-neutral-600">
                    {item.countLabel}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
