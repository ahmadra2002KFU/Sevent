/**
 * Shared server-only review context resolver.
 *
 * Both organizer and supplier review submission paths share authorization,
 * reviewee derivation, window checks, and dispute-suppression checks.
 * Centralising the logic here removes the risk of divergent auth between
 * the two near-identical action files (opencode plan review §3).
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceStatus } from "./booking";
import { isReviewWindowOpen, reviewWindowEndsAt } from "./reviews";

export type ReviewRole = "organizer" | "supplier";

export type ResolveReviewContextOk = {
  ok: true;
  booking: {
    id: string;
    organizer_id: string;
    supplier_id: string;
    supplier_profile_id: string;
    service_status: ServiceStatus;
    completed_at: string | null;
  };
  role: ReviewRole;
  reviewer_profile_id: string;
  reviewee_profile_id: string;
  window_closes_at: Date;
  existing_review: { id: string; submitted_at: string } | null;
  open_dispute_count: number;
};

export type ResolveReviewContextErr = {
  ok: false;
  reason:
    | "not_found"
    | "not_party"
    | "not_completed"
    | "missing_completed_at"
    | "window_closed"
    | "already_submitted"
    | "dispute_open";
};

export type ResolveReviewContextResult =
  | ResolveReviewContextOk
  | ResolveReviewContextErr;

export type ResolveReviewContextInput = {
  admin: SupabaseClient;
  bookingId: string;
  viewerProfileId: string;
  now?: Date;
};

/**
 * Loads the booking + supplier owner + viewer's existing review + open
 * dispute count, then determines whether the viewer can submit a review.
 * Returns a discriminated union — `ok: true` carries everything callers
 * need to insert; `ok: false` carries a stable reason code the UI can
 * translate.
 */
export async function resolveReviewContext(
  input: ResolveReviewContextInput,
): Promise<ResolveReviewContextResult> {
  const { admin, bookingId, viewerProfileId, now = new Date() } = input;

  const { data: bookingRow } = await admin
    .from("bookings")
    .select(
      `id, organizer_id, supplier_id, service_status, completed_at,
       suppliers ( id, profile_id )`,
    )
    .eq("id", bookingId)
    .maybeSingle();

  type Row = {
    id: string;
    organizer_id: string;
    supplier_id: string;
    service_status: ServiceStatus;
    completed_at: string | null;
    suppliers: { id: string; profile_id: string } | null;
  };
  const row = bookingRow as unknown as Row | null;
  if (!row || !row.suppliers) return { ok: false, reason: "not_found" };

  const supplierProfileId = row.suppliers.profile_id;

  let role: ReviewRole;
  if (row.organizer_id === viewerProfileId) {
    role = "organizer";
  } else if (supplierProfileId === viewerProfileId) {
    role = "supplier";
  } else {
    return { ok: false, reason: "not_party" };
  }

  // service_status must be completed AND completed_at must be set.
  if (row.service_status === "disputed") {
    return { ok: false, reason: "dispute_open" };
  }
  if (row.service_status !== "completed") {
    return { ok: false, reason: "not_completed" };
  }
  if (!row.completed_at) {
    return { ok: false, reason: "missing_completed_at" };
  }
  if (!isReviewWindowOpen(row.service_status, row.completed_at, now)) {
    return { ok: false, reason: "window_closed" };
  }

  // Window end (computed once, here, from completed_at — not from now()).
  const window_closes_at = reviewWindowEndsAt(row.completed_at);
  if (!window_closes_at) {
    return { ok: false, reason: "missing_completed_at" };
  }

  // Active dispute check — covers race where service_status hasn't flipped
  // yet but a dispute is already in flight.
  const { count: disputeCount } = await admin
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", row.id)
    .in("status", ["open", "investigating"]);
  if (disputeCount && disputeCount > 0) {
    return { ok: false, reason: "dispute_open" };
  }

  // Existing review by this viewer?
  const { data: existingRow } = await admin
    .from("reviews")
    .select("id, submitted_at")
    .eq("booking_id", row.id)
    .eq("reviewer_id", viewerProfileId)
    .maybeSingle();
  const existing_review =
    (existingRow as { id: string; submitted_at: string } | null) ?? null;
  if (existing_review) {
    return { ok: false, reason: "already_submitted" };
  }

  return {
    ok: true,
    booking: {
      id: row.id,
      organizer_id: row.organizer_id,
      supplier_id: row.supplier_id,
      supplier_profile_id: supplierProfileId,
      service_status: row.service_status,
      completed_at: row.completed_at,
    },
    role,
    reviewer_profile_id: viewerProfileId,
    reviewee_profile_id:
      role === "organizer" ? supplierProfileId : row.organizer_id,
    window_closes_at,
    existing_review: null,
    open_dispute_count: 0,
  };
}
