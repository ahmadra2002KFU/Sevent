import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "danger";

const TONE: Record<Tone, string> = {
  neutral: "bg-neutral-200 text-neutral-700",
  info: "bg-brand-cobalt-100 text-brand-cobalt-500",
  success: "bg-semantic-success-100 text-semantic-success-500",
  danger: "bg-semantic-danger-100 text-semantic-danger-500",
};

type ThreadStatusBadgeProps = {
  status: "new" | "triaged" | "resolved";
  closed: boolean;
  labels: Record<"new" | "triaged" | "resolved" | "closed", string>;
  className?: string;
};

export function ThreadStatusBadge({
  status,
  closed,
  labels,
  className,
}: ThreadStatusBadgeProps) {
  if (closed) {
    return (
      <Pill tone="danger" className={className}>
        {labels.closed}
      </Pill>
    );
  }
  switch (status) {
    case "new":
      return (
        <Pill tone="neutral" className={className}>
          {labels.new}
        </Pill>
      );
    case "triaged":
      return (
        <Pill tone="info" className={className}>
          {labels.triaged}
        </Pill>
      );
    case "resolved":
      return (
        <Pill tone="success" className={className}>
          {labels.resolved}
        </Pill>
      );
  }
}

function Pill({
  children,
  tone,
  className,
}: {
  children: React.ReactNode;
  tone: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE[tone],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}
