import Link from "next/link";
import { ArrowRight, CheckCircle2, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AttentionTone = "danger" | "warning" | "info";

export type AttentionItem = {
  id: string;
  icon: LucideIcon;
  tone: AttentionTone;
  text: string;
  meta?: string | null;
  ctaLabel: string;
  href: string;
};

const TONE_ICON: Record<AttentionTone, string> = {
  danger: "bg-semantic-danger-100 text-semantic-danger-500",
  warning: "bg-semantic-warning-100 text-semantic-warning-500",
  info: "bg-brand-cobalt-100 text-brand-cobalt-500",
};

type AttentionPanelProps = {
  title: string;
  subtitle: string;
  items: AttentionItem[];
  caughtUp: { title: string; body: string };
};

export function AttentionPanel({
  title,
  subtitle,
  items,
  caughtUp,
}: AttentionPanelProps) {
  if (items.length === 0) {
    return (
      <Card className="shadow-brand-sm">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-semantic-success-100 text-semantic-success-500">
            <CheckCircle2 className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-brand-navy-900">{caughtUp.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {caughtUp.body}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-brand-cobalt-200 shadow-brand-sm">
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg",
                      TONE_ICON[item.tone],
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-brand-navy-900">
                      {item.text}
                    </p>
                    {item.meta ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.meta}
                      </p>
                    ) : null}
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-cobalt-500">
                    {item.ctaLabel}
                    <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
