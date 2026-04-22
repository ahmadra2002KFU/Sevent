import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  id?: string;
  eyebrow: string;
  heading: string;
  lede?: string;
  className?: string;
  onDark?: boolean;
};

/**
 * Consistent section opener across the landing page: gold dot + eyebrow,
 * display-weight heading, and an optional lede paragraph. `onDark` recolours
 * the text for the navy pilot band.
 */
export function SectionHeading({
  id,
  eyebrow,
  heading,
  lede,
  className,
  onDark = false,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-4", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-2 self-start text-[11px] font-semibold uppercase tracking-[0.22em]",
          onDark ? "text-white/85" : "text-brand-cobalt-500",
        )}
      >
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-accent-gold-500"
        />
        {eyebrow}
      </span>
      <h2
        id={id}
        className={cn(
          "text-3xl font-extrabold tracking-tight sm:text-[2.25rem] md:text-[2.5rem]",
          onDark ? "text-white" : "text-brand-navy-900",
        )}
      >
        {heading}
      </h2>
      {lede ? (
        <p
          className={cn(
            "max-w-xl text-base leading-relaxed sm:text-[17px]",
            onDark ? "text-white/75" : "text-neutral-600",
          )}
        >
          {lede}
        </p>
      ) : null}
    </div>
  );
}
