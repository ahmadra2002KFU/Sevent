/**
 * Booking read-side types + small helpers.
 *
 * The booking state machine itself lives in the SQL RPCs (`accept_quote_tx`
 * in Sprint 4; confirm/decline/expire in Sprint 5). This module is just the
 * TypeScript shape consumers read.
 */

export type ConfirmationStatus = "awaiting_supplier" | "confirmed" | "cancelled";
export type PaymentStatus = "unpaid" | "deposit_paid" | "balance_paid" | "paid";
export type ServiceStatus = "scheduled" | "in_progress" | "completed" | "disputed";

export type BookingRow = {
  id: string;
  rfq_id: string;
  quote_id: string;
  accepted_quote_revision_id: string;
  organizer_id: string;
  supplier_id: string;
  contract_pdf_path: string | null;
  confirmation_status: ConfirmationStatus;
  payment_status: PaymentStatus;
  service_status: ServiceStatus;
  awaiting_since: string | null; // ISO-8601
  confirm_deadline: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Format a confirm_deadline ISO-8601 timestamp as hours remaining.
 *
 * Returns `{ kind: "expired" }` for past deadlines so the caller can render
 * "Decision required" styling. Otherwise returns `{ kind: "countdown",
 * hours }` — always an integer, rounded up so "2h 59m" reads as "3h left".
 */
export function formatConfirmDeadline(
  deadlineIso: string | null,
  now: Date = new Date(),
): { kind: "expired" } | { kind: "countdown"; hours: number } | { kind: "none" } {
  if (!deadlineIso) return { kind: "none" };
  const deadline = new Date(deadlineIso);
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return { kind: "expired" };
  const hours = Math.ceil(diffMs / (1000 * 60 * 60));
  return { kind: "countdown", hours };
}
