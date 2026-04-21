import { Card, CardContent } from "@/components/ui/card";
import { formatHalalas } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

type PackageCardProps = {
  name: string;
  description: string | null;
  basePriceHalalas: number;
  fromPriceVisible: boolean;
  unitLabel: string;
  qtyRangeLabel: string;
  fromLabel: string;
  className?: string;
};

/**
 * Public package tile. Two-column header with name + meta on the start side
 * and a price tower on the end side. The description flows below when present.
 *
 * Price shown only when `fromPriceVisible` — otherwise the unit meta takes the
 * full width and no currency is shown (supplier opts in per package via
 * catalog settings).
 */
export function PackageCard({
  name,
  description,
  basePriceHalalas,
  fromPriceVisible,
  unitLabel,
  qtyRangeLabel,
  fromLabel,
  className,
}: PackageCardProps) {
  return (
    <Card
      className={cn(
        "group border-border bg-card transition-all duration-200 hover:border-brand-cobalt-500/30 hover:shadow-brand",
        className,
      )}
    >
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold tracking-tight text-brand-navy-900">
              {name}
            </p>
            <p className="text-xs text-muted-foreground">
              {unitLabel} · {qtyRangeLabel}
            </p>
          </div>
          {fromPriceVisible ? (
            <div className="flex flex-col items-end text-end">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {fromLabel}
              </span>
              <span className="text-xl font-bold text-brand-navy-900">
                {formatHalalas(basePriceHalalas)}
              </span>
            </div>
          ) : null}
        </div>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
