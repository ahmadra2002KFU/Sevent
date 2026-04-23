/**
 * Zod schemas for the supplier manual availability block form (Lane 4).
 * Only writes `reason='manual_block'`. Soft-hold and booked reasons are
 * reserved for the Sprint 4 booking state machine.
 */

import { z } from "zod";

// Accepts `YYYY-MM-DDTHH:mm` (datetime-local short form),
// `YYYY-MM-DDTHH:mm:ss(.fff)`, or full ISO strings with a timezone suffix.
const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;
const isoDateTime = z
  .string()
  .regex(LOCAL_DT, { message: "invalid_datetime_format" })
  .transform((v, ctx) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "invalid_datetime_value",
      });
      return z.NEVER;
    }
    return d.toISOString();
  });

export const ManualBlockInput = z
  .object({
    id: z.string().uuid().optional(),
    starts_at: isoDateTime,
    ends_at: isoDateTime,
    notes: z.string().max(500).optional(),
  })
  .refine((v) => Date.parse(v.ends_at) > Date.parse(v.starts_at), {
    path: ["ends_at"],
    message: "ends_before_starts",
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
