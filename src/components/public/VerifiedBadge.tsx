import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Gold trust marker for approved + published suppliers. The gold tone is scarce
 * by design — per design-tokens.md, gold is reserved for verified/pilot
 * markers, never generic emphasis. Renders inline and inherits text baseline.
 */
export function VerifiedBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-accent-gold-100 px-2.5 py-0.5 text-xs font-semibold text-accent-gold-500",
        className,
      )}
    >
      <BadgeCheck className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
