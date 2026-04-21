import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type MetricCardProps = {
  label: string;
  value: string | number;
  hint?: string | null;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
};

const TONE_ICON: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "bg-brand-cobalt-100 text-brand-cobalt-500",
  success: "bg-semantic-success-100 text-semantic-success-500",
  warning: "bg-semantic-warning-100 text-semantic-warning-500",
  danger: "bg-semantic-danger-100 text-semantic-danger-500",
  info: "bg-brand-cobalt-100 text-brand-cobalt-500",
};

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("shadow-brand-sm", className)}>
      <CardContent className="flex items-center gap-4 p-5">
        {Icon ? (
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-lg",
              TONE_ICON[tone],
            )}
          >
            <Icon className="size-5" aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight text-brand-navy-900">
            {value}
          </p>
          {hint ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
