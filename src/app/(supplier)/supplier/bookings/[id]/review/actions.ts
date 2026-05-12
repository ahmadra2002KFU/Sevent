"use server";

/**
 * Supplier-side review submission. Mirror of the organizer-side action;
 * the resolveReviewContext helper derives the role from the viewer's
 * profile id, so this file only needs to assert role === 'supplier'
 * (defense-in-depth).
 */

import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth/access";
import { createNotification } from "@/lib/notifications/inApp";
import { ReviewInput } from "@/lib/domain/reviews";
import { resolveReviewContext } from "@/lib/domain/reviews.server";

export type SubmitReviewState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function reasonMessage(
  reason:
    | "not_found"
    | "not_party"
    | "not_completed"
    | "missing_completed_at"
    | "window_closed"
    | "already_submitted"
    | "dispute_open",
): string {
  switch (reason) {
    case "not_found":
      return "Booking not found.";
    case "not_party":
      return "You're not a party to this booking.";
    case "not_completed":
      return "This booking isn't marked completed yet.";
    case "missing_completed_at":
      return "Review window has not opened yet.";
    case "window_closed":
      return "The 14-day review window has closed.";
    case "already_submitted":
      return "You've already submitted a review for this booking.";
    case "dispute_open":
      return "Reviews are paused while a dispute is open on this booking.";
  }
}

export async function submitReviewAction(
  _prev: SubmitReviewState | undefined,
  formData: FormData,
): Promise<SubmitReviewState> {
  const { user, admin } = await requireAccess("supplier.bookings");

  const parsed = ReviewInput.safeParse({
    booking_id: formData.get("booking_id"),
    ratings: {
      overall: formData.get("ratings.overall"),
      value: formData.get("ratings.value"),
      punctuality: formData.get("ratings.punctuality"),
      professionalism: formData.get("ratings.professionalism"),
    },
    text: (formData.get("text") as string) || undefined,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      status: "error",
      message: first?.message ?? "Invalid review submission.",
    };
  }

  const ctx = await resolveReviewContext({
    admin,
    bookingId: parsed.data.booking_id,
    viewerProfileId: user.id,
  });
  if (!ctx.ok) {
    return { status: "error", message: reasonMessage(ctx.reason) };
  }
  if (ctx.role !== "supplier") {
    return { status: "error", message: "Wrong role for this submission path." };
  }

  const { error: insertError } = await admin.from("reviews").insert({
    booking_id: ctx.booking.id,
    reviewer_id: ctx.reviewer_profile_id,
    reviewee_id: ctx.reviewee_profile_id,
    ratings_jsonb: parsed.data.ratings,
    text: parsed.data.text,
    submitted_at: new Date().toISOString(),
    window_closes_at: ctx.window_closes_at.toISOString(),
    suppressed_for_dispute: false,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      return { status: "error", message: reasonMessage("already_submitted") };
    }
    return {
      status: "error",
      message: insertError.message || "Could not save review.",
    };
  }

  try {
    await createNotification({
      supabase: admin,
      user_id: ctx.reviewee_profile_id,
      kind: "review.submitted",
      payload: { booking_id: ctx.booking.id, from_role: "supplier" },
    });
  } catch (e) {
    console.error("[submitReviewAction supplier] notify failed", e);
  }

  revalidatePath(`/supplier/bookings/${ctx.booking.id}`);
  revalidatePath(`/supplier/bookings/${ctx.booking.id}/review`);
  revalidatePath(`/organizer/bookings/${ctx.booking.id}`);

  return { status: "success", message: "Thanks — your review is in." };
}
