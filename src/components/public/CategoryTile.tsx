import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CategoryTileProps = {
  href: string;
  name: string;
  supplierCount: number;
  supplierCountLabel: string;
  icon: LucideIcon;
  viewLabel: string;
  className?: string;
};

/**
 * Category entry point. Card-like surface with an icon chip, name, supplier
 * count, and an affordance arrow in the trailing corner that animates on
 * hover. Border-led style — no gradients, no shadows on rest state.
 *
 * Visual rhythm:
 *   - Rest: white card, 1px neutral-200 border, icon on neutral-100 chip
 *   - Hover: cobalt ring, icon chip flips to cobalt-500 background + white,
 *     arrow translates + rotates subtly, border darkens to navy-900/10
 */
export function CategoryTile({
  href,
  name,
  supplierCount,
  supplierCountLabel,
  icon: Icon,
  viewLabel,
  className,
}: CategoryTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-xl border border-border bg-card p-6 transition-all duration-200 ease-out",
        "hover:border-brand-cobalt-500/40 hover:shadow-brand-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-12 items-center justify-center rounded-lg bg-neutral-100 text-brand-navy-900 transition-colors duration-200 group-hover:bg-brand-cobalt-500 group-hover:text-white">
          <Icon className="size-6" aria-hidden />
        </div>
        <ArrowUpRight
          className="size-5 text-neutral-400 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:text-brand-cobalt-500 rtl:-scale-x-100"
          aria-hidden
        />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold tracking-tight text-brand-navy-900">
          {name}
        </h3>
        <p className="text-sm text-muted-foreground">
          {supplierCount > 0
            ? supplierCountLabel
            : viewLabel}
        </p>
      </div>
    </Link>
  );
}
