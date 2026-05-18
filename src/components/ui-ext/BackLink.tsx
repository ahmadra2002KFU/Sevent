import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackLinkProps = {
  href: string;
  label: string;
  className?: string;
};

/**
 * "Back to list" pill — single source of truth for back-nav across
 * supplier, organizer, and admin detail pages.
 *
 * Inspiration: the layered-reveal pattern of an animated CTA where text
 * hides as a graphic layer takes its place. Rebuilt here in Sevent's
 * own vocabulary — cobalt ink instead of a rotating sunburst, the
 * navy-tinted `shadow-brand-md` elevation token instead of a flat
 * Memphis drop-shadow, width-flexible instead of fixed-180px-wide so it
 * fits any localized label.
 *
 * Hover (and focus-visible — keyboard users get the same affordance)
 * plays four motions in sync so it reads as one gesture, not four:
 *
 *   1. Border picks up a cobalt tint and the pill rises with
 *      `shadow-brand-md` — the wake-up.
 *   2. Solid cobalt ink sweeps in from the inline-start edge over 300ms
 *      via GPU-composited `scaleX`. Origin flips for RTL so the sweep
 *      always travels toward the trailing edge, never against the
 *      reading direction.
 *   3. Label and arrow recolor to `primary-foreground` over 200ms —
 *      timed to finish slightly behind the ink front so the text reads
 *      as revealed under the wave, not as painting in midair.
 *   4. The arrow leans ~6px further in the "back" direction and grows
 *      to 110% — small but it gives the icon agency, like it's leading
 *      you back rather than waiting to be clicked.
 *
 * Active (click) press is inherited from the base button
 * (`translate-y-px`), so the gesture feels complete: lift on intent,
 * press on commit.
 *
 * Reduced-motion: every transition collapses to instant. The final
 * filled state still appears on hover (so the interaction registers),
 * but with no sweep, no shift, no lift. Users who opted out aren't
 * left wondering whether they hit the button.
 */
export function BackLink({ href, label, className }: BackLinkProps) {
  return (
    <Button
      variant="outline"
      size="default"
      className={cn(
        "group/back relative w-fit overflow-hidden border-border/70",
        "hover:border-primary/45 hover:shadow-brand-md hover:bg-background",
        "focus-visible:border-primary/45 focus-visible:shadow-brand-md",
        className,
      )}
      asChild
    >
      <Link href={href}>
        {/* Cobalt ink — collapsed at the inline-start edge at rest,
            scales to full width on hover/focus. GPU-composited so the
            sweep doesn't trigger layout. */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 origin-left scale-x-0 bg-primary",
            "transition-transform duration-300 ease-out",
            "group-hover/back:scale-x-100 group-focus-visible/back:scale-x-100",
            "rtl:origin-right",
            "motion-reduce:transition-none",
          )}
        />
        <ArrowLeft
          aria-hidden
          className={cn(
            "relative rtl:rotate-180",
            "transition-[transform,color] duration-300 ease-out",
            "group-hover/back:-translate-x-1.5 group-hover/back:scale-110 group-hover/back:text-primary-foreground",
            "group-focus-visible/back:-translate-x-1.5 group-focus-visible/back:scale-110 group-focus-visible/back:text-primary-foreground",
            "rtl:group-hover/back:translate-x-1.5 rtl:group-focus-visible/back:translate-x-1.5",
            "motion-reduce:transition-none",
          )}
        />
        <span
          className={cn(
            "relative transition-colors duration-200 ease-out",
            "group-hover/back:text-primary-foreground group-focus-visible/back:text-primary-foreground",
            "motion-reduce:transition-none",
          )}
        >
          {label}
        </span>
      </Link>
    </Button>
  );
}
