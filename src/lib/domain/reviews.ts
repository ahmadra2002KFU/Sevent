/**
 * Reviews domain — pure types + Zod schemas + helpers.
 *
 * The review window is anchored to `bookings.completed_at`. The window
 * computation lives here so both submission gating (server actions) and
 * UI gating (page-level "can review" checks) agree on the rule.
 *
 *   window = [completed_at, completed_at + 14 days)
 *
 * Per opencode plan review §4 — never compute the window from `now()` at
 * submission time, otherwise a late submitter extends their own window.
 */

import { z } from "zod";
import type { ServiceStatus } from "./booking";

export const REVIEW_WINDOW_DAYS = 14;

export const RATING_DIMENSIONS = [
  "overall",
  "value",
  "punctuality",
  "professionalism",
] as const;

export type RatingDimension = (typeof RATING_DIMENSIONS)[number];

export const RatingsInput = z.object({
  overall: z.coerce.number().int().min(1).max(5),
  value: z.coerce.number().int().min(1).max(5),
  punctuality: z.coerce.number().int().min(1).max(5),
  professionalism: z.coerce.number().int().min(1).max(5),
});

export type Ratings = z.infer<typeof RatingsInput>;

export const ReviewInput = z.object({
  booking_id: z.string().uuid(),
  ratings: RatingsInput,
  text: z
    .string()
    .max(2000, "Review text must be 2000 characters or fewer.")
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
});

export type ReviewInputShape = z.infer<typeof ReviewInput>;

export type ReviewRow = {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewee_id: string;
  ratings_jsonb: Ratings;
  text: string | null;
  submitted_at: string;
  window_closes_at: string;
  published_at: string | null;
  suppressed_for_dispute: boolean;
};

/**
 * Returns the end of the review window for a given booking, or null if
 * the booking has no `completed_at` yet.
 */
export function reviewWindowEndsAt(
  completedAt: string | null,
): Date | null {
  if (!completedAt) return null;
  const start = new Date(completedAt);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Open iff service_status='completed' AND the 14-day window has not yet
 * elapsed. Disputes are handled separately — a `service_status='disputed'`
 * booking returns false here even if its event ended <14 days ago.
 */
export function isReviewWindowOpen(
  serviceStatus: ServiceStatus,
  completedAt: string | null,
  now: Date = new Date(),
): boolean {
  if (serviceStatus !== "completed") return false;
  const ends = reviewWindowEndsAt(completedAt);
  if (!ends) return false;
  return now.getTime() < ends.getTime();
}

export const RATING_DIMENSION_LABEL_KEYS: Record<RatingDimension, string> = {
  overall: "reviews.dimensions.overall",
  value: "reviews.dimensions.value",
  punctuality: "reviews.dimensions.punctuality",
  professionalism: "reviews.dimensions.professionalism",
};
