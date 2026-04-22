import { Star } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
};

type TestimonialRailProps = {
  id?: string;
  eyebrow: string;
  heading: string;
  items: ReadonlyArray<Testimonial>;
};

const AVATAR_PALETTE: ReadonlyArray<string> = [
  "bg-brand-cobalt-100 text-brand-cobalt-500",
  "bg-accent-gold-100 text-accent-gold-500",
  "bg-semantic-success-100 text-semantic-success-500",
];

/**
 * Three testimonial cards in a row (stacked on mobile). Each card shows a
 * five-star rating, the quote, and a person block pinned to the bottom.
 */
export function TestimonialRail({
  id,
  eyebrow,
  heading,
  items,
}: TestimonialRailProps) {
  return (
    <section
      aria-labelledby={id}
      className="border-y border-border bg-neutral-100 py-20 sm:py-24"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading id={id} eyebrow={eyebrow} heading={heading} />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {items.map((t, idx) => {
            const initial = t.name.trim().charAt(0);
            const avatarStyle =
              AVATAR_PALETTE[idx % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0];
            return (
              <figure
                key={t.name}
                className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-7"
              >
                <div
                  aria-label="5 out of 5 stars"
                  className="flex gap-0.5 text-accent-gold-500"
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="size-4 fill-current"
                      strokeWidth={0}
                      aria-hidden
                    />
                  ))}
                </div>
                <blockquote className="text-[15px] font-medium leading-relaxed text-brand-navy-900">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-auto flex items-center gap-3 border-t border-border pt-4">
                  <span
                    aria-hidden
                    className={`inline-flex size-10 items-center justify-center rounded-[0.625rem] text-sm font-extrabold ${avatarStyle}`}
                  >
                    {initial}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-brand-navy-900">
                      {t.name}
                    </span>
                    <span className="text-[12px] text-neutral-600">
                      {t.role}
                    </span>
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
