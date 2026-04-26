"use server";

/**
 * Supplier-side booking confirm / decline server actions.
 *
 * Both wrap atomic RPCs (`confirm_booking_tx`, `cancel_booking_supplier_tx`)
 * defined in 20260504082000_supplier_booking_confirm.sql. The RPC owns the
 * state machine — these actions only authenticate the caller, parse inputs,
 * map P02xx error codes to user-visible messages, write best-effort
 * notifications, and revalidate cache.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/access";
import { createNotification } from "@/lib/notifications/inApp";
import type { BookingActionState } from "./action-state";

const confirmSchema = z.object({
  booking_id: z.string().uuid(),
});

const cancelSchema = z.object({
  booking_id: z.string().uuid(),
  reason: z
    .string()
    .max(500, "Reason must be 500 characters or fewer.")
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
});

type PgError = { code?: string; message?: string } | null | undefined;

function messageForBookingError(err: PgError): string {
  if (!err) return "We couldn't update this booking. Please try again.";
  const code = err.code ?? "";
  switch (code) {
    case "P0201":
      return "Booking not found.";
    case "P0202":
      return "This booking does not belong to you.";
    case "P0203":
      return "This booking is no longer in a state where you can act on it.";
    case "P0204":
      return "The confirmation deadline has passed.";
    default:
      return "We couldn't update this booking. Please try again.";
  }
}

export async function confirmBookingAction(
  _prev: BookingActionState | undefined,
  formData: FormData,
): Promise<BookingActionState> {
  const { decision, admin } = await requireAccess("supplier.bookings");
  const supplierId = decision.supplierId;
  if (!supplierId) {
    return { status: "error", message: "Supplier profile not found." };
  }

  const parse = confirmSchema.safeParse({
    booking_id: formData.get("booking_id"),
  });
  if (!parse.success) {
    return { status: "error", message: "Invalid booking id." };
  }
  const { booking_id } = parse.data;

  const { error: rpcError } = await admin.rpc("confirm_booking_tx", {
    p_booking_id: booking_id,
    p_supplier_id: supplierId,
  });

  if (rpcError) {
    return { status: "error", message: messageForBookingError(rpcError) };
  }

  // Look up the organizer + RFQ id for the notification + revalidations.
  const { data: bookingRow } = await admin
    .from("bookings")
    .select("id, organizer_id, rfq_id")
    .eq("id", booking_id)
    .maybeSingle();

  const ctx = bookingRow as
    | { id: string; organizer_id: string; rfq_id: string }
    | null;

  if (ctx) {
    try {
      await createNotification({
        supabase: admin,
        user_id: ctx.organizer_id,
        kind: "booking.confirmed",
        payload: { booking_id: ctx.id, rfq_id: ctx.rfq_id },
      });
    } catch (e) {
      console.error("[confirmBookingAction] notify failed", e);
    }
  }

  revalidatePath(`/supplier/bookings/${booking_id}`);
  revalidatePath("/supplier/bookings");
  if (ctx) {
    revalidatePath(`/organizer/bookings/${booking_id}`);
    revalidatePath("/organizer/bookings");
  }

  return { status: "success", message: "Booking confirmed." };
}

export async function cancelBookingAction(
  _prev: BookingActionState | undefined,
  formData: FormData,
): Promise<BookingActionState> {
  const { decision, admin } = await requireAccess("supplier.bookings");
  const supplierId = decision.supplierId;
  if (!supplierId) {
    return { status: "error", message: "Supplier profile not found." };
  }

  const parse = cancelSchema.safeParse({
    booking_id: formData.get("booking_id"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parse.success) {
    return { status: "error", message: "Invalid request." };
  }
  const { booking_id, reason } = parse.data;

  const { error: rpcError } = await admin.rpc("cancel_booking_supplier_tx", {
    p_booking_id: booking_id,
    p_supplier_id: supplierId,
    p_reason: reason,
  });

  if (rpcError) {
    return { status: "error", message: messageForBookingError(rpcError) };
  }

  const { data: bookingRow } = await admin
    .from("bookings")
    .select("id, organizer_id, rfq_id")
    .eq("id", booking_id)
    .maybeSingle();

  const ctx = bookingRow as
    | { id: string; organizer_id: string; rfq_id: string }
    | null;

  if (ctx) {
    try {
      await createNotification({
        supabase: admin,
        user_id: ctx.organizer_id,
        kind: "booking.cancelled",
        payload: {
          booking_id: ctx.id,
          rfq_id: ctx.rfq_id,
          reason,
          cancelled_by: "supplier",
        },
      });
    } catch (e) {
      console.error("[cancelBookingAction] notify failed", e);
    }
  }

  revalidatePath(`/supplier/bookings/${booking_id}`);
  revalidatePath("/supplier/bookings");
  if (ctx) {
    revalidatePath(`/organizer/bookings/${booking_id}`);
    revalidatePath("/organizer/bookings");
    revalidatePath(`/organizer/rfqs/${ctx.rfq_id}/quotes`);
  }

  return { status: "success", message: "Booking declined." };
}
