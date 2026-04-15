/**
 * Zod schemas for the supplier manual availability block form (Lane 4).
 * Only writes `reason='manual_block'`. Soft-hold and booked reasons are
 * reserved for the Sprint 4 booking state machine.
 */

import { z } from "zod";

const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "invalid ISO date/time" });

export const ManualBlockInput = z
  .object({
    id: z.string().uuid().optional(),
    starts_at: isoDateTime,
    ends_at: isoDateTime,
    notes: z.string().max(500).optional(),
  })
  .refine((v) => Date.parse(v.ends_at) > Date.parse(v.starts_at), {
    path: ["ends_at"],
    message: "End must be after start",
  });
export type ManualBlockInput = z.infer<typeof ManualBlockInput>;

/** Maps DB-level overlap errors into a friendly UI string. */
export function friendlyAvailabilityError(pgMessage: string | null | undefined): string {
  if (!pgMessage) return "Unable to save the block. Please try again.";
  const lower = pgMessage.toLowerCase();
  if (lower.includes("exclusion") || lower.includes("overlap") || lower.includes("conflict")) {
    return "This range conflicts with another block or booking. Pick a different window.";
  }
  if (lower.includes("ends_at") || lower.includes("starts_at")) {
    return "End must be after start.";
  }
  return "Unable to save the block. Please try again.";
}
