import { cn } from "@/lib/utils";

export type StatusPillStatus =
  // Neutral / pre-action
  | "draft"
  | "pending"
  // Info / in-flight
  | "sent"
  | "quoted"
  | "invited"
  // Warning / user-action-required
  | "awaiting_supplier"
  // Success / resolved positively
  | "accepted"
  | "confirmed"
  | "booked"
  | "approved"
  | "paid"
  | "completed"
  // Danger / negative resolution
  | "declined"
  | "rejected"
  | "cancelled"
  | "expired"
  | "withdrawn";

type Tone = "neutral" | "info" | "warning" | "success" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-neutral-200 text-neutral-600",
  info: "bg-brand-cobalt-100 text-brand-cobalt-500",
  warning: "bg-semantic-warning-100 text-semantic-warning-500",
  success: "bg-semantic-success-100 text-semantic-success-500",
  danger: "bg-semantic-danger-100 text-semantic-danger-500",
};

const STATUS_TONE: Record<StatusPillStatus, Tone> = {
  draft: "neutral",
  pending: "neutral",
  sent: "info",
  quoted: "info",
  invited: "info",
  awaiting_supplier: "warning",
  accepted: "success",
  confirmed: "success",
  booked: "success",
  approved: "success",
  paid: "success",
  completed: "success",
  declined: "danger",
  rejected: "danger",
  cancelled: "danger",
  expired: "danger",
  withdrawn: "danger",
};

type StatusPillProps = {
  status: StatusPillStatus;
  label?: string;
  className?: string;
};

export function StatusPill({ status, label, className }: StatusPillProps) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        TONE_CLASSES[tone],
        className,
      )}
      data-status={status}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-current opacity-70"
      />
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}
