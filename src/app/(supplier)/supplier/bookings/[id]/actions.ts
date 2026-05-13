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
import { sendEmail } from "@/lib/notifications/email";
import { resolveRecipientEmailAndLocale } from "@/lib/notifications/recipients";
import BookingConfirmed from "@/lib/notifications/templates/organizer/BookingConfirmed";
import { strings as bookingConfirmedStrings } from "@/lib/notifications/templates/organizer/BookingConfirmed.strings";
import BookingCancelledBySupplier from "@/lib/notifications/templates/organizer/BookingCancelledBySupplier";
import { strings as bookingCancelledStrings } from "@/lib/notifications/templates/organizer/BookingCancelledBySupplier.strings";
import { renderContract } from "@/lib/contracts/renderContract";
import { uploadContractAndPersist } from "@/lib/contracts/uploadAndPersist";
import { parseQuoteSnapshot } from "@/lib/domain/quote";
import { env } from "@/lib/env";
import type { BookingActionState } from "./action-state";

type EmailDelivery = "sent" | "console" | "failed" | "skipped";

function appUrl(): string {
  return env?.APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
}

async function sendLifecycleEmail(args: {
  to: string;
  subject: string;
  react: Parameters<typeof sendEmail>[0]["react"];
  context: { stage: string; id: string };
}): Promise<EmailDelivery> {
  try {
    const result = await sendEmail({
      to: args.to,
      subject: args.subject,
      react: args.react,
    });
    if (!result.ok) {
      console.warn("[" + args.context.stage + "] email send failed", {
        id: args.context.id,
        error: result.error,
      });
      return "failed";
    }
    return result.mode === "resend" ? "sent" : "console";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[" + args.context.stage + "] email send threw", {
      id: args.context.id,
      message,
    });
    return "failed";
  }
}

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

  // -------------------------------------------------------------------------
  // Contract PDF pipeline. The booking is legally confirmed by the RPC above
  // — if rendering or uploading the PDF fails we DO NOT roll back. We log,
  // notify an admin so they can retry, and continue. The path is
  // deterministic ({bookingId}/{revisionId}.pdf) so a retry is idempotent.
  // Order matters: persist contract_pdf_path BEFORE revalidatePath so the
  // organizer/supplier detail pages re-render with the download button
  // already visible in the same tick.
  // -------------------------------------------------------------------------

  const { data: ctxRow } = await admin
    .from("bookings")
    .select(
      `id, organizer_id, rfq_id, supplier_id, accepted_quote_revision_id, confirmed_at,
       profiles:organizer_id ( id, full_name, phone, language ),
       suppliers ( id, business_name, slug ),
       rfqs ( id, events ( id, event_type, city, starts_at, ends_at, venue_address, guest_count ) ),
       quote_revisions:accepted_quote_revision_id ( id, snapshot_jsonb, content_hash )`,
    )
    .eq("id", booking_id)
    .maybeSingle();

  type CtxShape = {
    id: string;
    organizer_id: string;
    rfq_id: string;
    supplier_id: string;
    accepted_quote_revision_id: string;
    confirmed_at: string | null;
    profiles: {
      id: string;
      full_name: string | null;
      phone: string | null;
      language: string | null;
    } | null;
    suppliers: {
      id: string;
      business_name: string;
      slug: string;
    } | null;
    rfqs: {
      id: string;
      events: {
        id: string;
        event_type: string;
        city: string;
        starts_at: string;
        ends_at: string;
        venue_address: string | null;
        guest_count: number | null;
      } | null;
    } | null;
    quote_revisions: {
      id: string;
      snapshot_jsonb: unknown;
      content_hash: string;
    } | null;
  };

  const ctx = (ctxRow as unknown as CtxShape | null) ?? null;

  if (ctx) {
    const snapshot = parseQuoteSnapshot(ctx.quote_revisions?.snapshot_jsonb);
    const event = ctx.rfqs?.events ?? null;
    // Resolve organizer email through the sanctioned helper. We deliberately
    // call this once for the contract pipeline AND the booking-confirmed
    // notification email.
    const organizerRecipient = await resolveRecipientEmailAndLocale(
      admin,
      ctx.organizer_id,
    );
    const organizerEmail = organizerRecipient.email;
    const supplier = ctx.suppliers;

    if (
      snapshot &&
      event &&
      supplier &&
      ctx.quote_revisions?.content_hash &&
      ctx.accepted_quote_revision_id
    ) {
      try {
        const bytes = await renderContract({
          booking: {
            id: ctx.id,
            confirmed_at: ctx.confirmed_at,
          },
          organizer: {
            full_name: ctx.profiles?.full_name ?? null,
            email: organizerEmail,
            phone: ctx.profiles?.phone ?? null,
          },
          supplier: {
            business_name: supplier.business_name,
            slug: supplier.slug,
            representative_name: null,
          },
          event: {
            event_type: event.event_type,
            city: event.city,
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            venue_address: event.venue_address,
            guest_count: event.guest_count,
          },
          snapshot,
          content_hash: ctx.quote_revisions.content_hash,
        });
        await uploadContractAndPersist({
          admin,
          bookingId: ctx.id,
          acceptedQuoteRevisionId: ctx.accepted_quote_revision_id,
          bytes,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err ?? "unknown");
        console.error("[confirmBookingAction] contract pipeline failed", {
          booking_id: ctx.id,
          message,
        });
        // Best-effort admin notification — pick the first admin profile.
        try {
          const { data: adminRow } = await admin
            .from("profiles")
            .select("id")
            .eq("role", "admin")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          const adminId = (adminRow as { id: string } | null)?.id;
          if (adminId) {
            await createNotification({
              supabase: admin,
              user_id: adminId,
              kind: "contract.render_failed",
              payload: { booking_id: ctx.id, error_message: message },
            });
          }
        } catch (notifyErr) {
          console.error(
            "[confirmBookingAction] admin notify also failed",
            notifyErr,
          );
        }
      }
    } else {
      console.warn("[confirmBookingAction] skipping contract render — missing inputs", {
        booking_id: ctx.id,
        has_snapshot: Boolean(snapshot),
        has_event: Boolean(event),
        has_supplier: Boolean(supplier),
      });
    }

    try {
      const basePayload = { booking_id: ctx.id, rfq_id: ctx.rfq_id };
      const inApp = await createNotification({
        supabase: admin,
        user_id: ctx.organizer_id,
        kind: "booking.confirmed",
        payload: { ...basePayload, email_delivery: "pending" },
      });

      let emailDelivery: EmailDelivery = "skipped";
      if (organizerEmail && event && supplier) {
        emailDelivery = await sendLifecycleEmail({
          to: organizerEmail,
          subject: bookingConfirmedStrings[organizerRecipient.locale].preview(
            supplier.business_name,
            event.event_type,
          ),
          react: BookingConfirmed({
            locale: organizerRecipient.locale,
            organizerName: ctx.profiles?.full_name ?? null,
            supplierBusinessName: supplier.business_name,
            eventName: event.event_type,
            eventStartsAtIso: event.starts_at,
            bookingUrl: `${appUrl()}/organizer/bookings/${ctx.id}`,
          }),
          context: { stage: "confirmBooking/booking.confirmed", id: ctx.id },
        });
      } else if (!organizerEmail) {
        console.warn(
          "[confirmBookingAction] organizer has no email; skipping BookingConfirmed send",
          { booking_id: ctx.id },
        );
      } else {
        console.warn(
          "[confirmBookingAction] missing event or supplier ctx; skipping BookingConfirmed send",
          {
            booking_id: ctx.id,
            has_event: Boolean(event),
            has_supplier: Boolean(supplier),
          },
        );
      }

      if (inApp.ok) {
        await admin
          .from("notifications")
          .update({
            payload_jsonb: { ...basePayload, email_delivery: emailDelivery },
          })
          .eq("id", inApp.id);
      }
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

  // Mirror the confirm-path SELECT so we have the supplier business_name,
  // event_type, and organizer profile fields needed for the cancellation
  // email + in-app notification.
  const { data: bookingRow } = await admin
    .from("bookings")
    .select(
      `id, organizer_id, rfq_id,
       profiles:organizer_id ( full_name, language ),
       suppliers!inner ( business_name ),
       rfqs!inner ( events ( event_type ) )`,
    )
    .eq("id", booking_id)
    .maybeSingle();

  type CancelCtxShape = {
    id: string;
    organizer_id: string;
    rfq_id: string;
    profiles: { full_name: string | null; language: string | null } | null;
    suppliers:
      | { business_name: string }
      | { business_name: string }[]
      | null;
    rfqs:
      | { events: { event_type: string } | { event_type: string }[] | null }
      | {
          events: { event_type: string } | { event_type: string }[] | null;
        }[]
      | null;
  };

  const ctx = bookingRow as unknown as CancelCtxShape | null;

  if (ctx) {
    try {
      const suppliersNode = Array.isArray(ctx.suppliers)
        ? ctx.suppliers[0] ?? null
        : ctx.suppliers;
      const rfqsNode = Array.isArray(ctx.rfqs)
        ? ctx.rfqs[0] ?? null
        : ctx.rfqs;
      const eventsNode = Array.isArray(rfqsNode?.events)
        ? rfqsNode?.events?.[0] ?? null
        : rfqsNode?.events ?? null;
      const supplierBusinessName = suppliersNode?.business_name ?? "the supplier";
      const eventName = eventsNode?.event_type ?? "your event";

      const recipient = await resolveRecipientEmailAndLocale(
        admin,
        ctx.organizer_id,
      );

      const basePayload = {
        booking_id: ctx.id,
        rfq_id: ctx.rfq_id,
        reason,
        cancelled_by: "supplier" as const,
      };
      const inApp = await createNotification({
        supabase: admin,
        user_id: ctx.organizer_id,
        kind: "booking.cancelled",
        payload: { ...basePayload, email_delivery: "pending" },
      });

      let emailDelivery: EmailDelivery = "skipped";
      if (recipient.email) {
        emailDelivery = await sendLifecycleEmail({
          to: recipient.email,
          subject: bookingCancelledStrings[recipient.locale].preview(
            supplierBusinessName,
            eventName,
          ),
          react: BookingCancelledBySupplier({
            locale: recipient.locale,
            organizerName: ctx.profiles?.full_name ?? null,
            supplierBusinessName,
            eventName,
            rfqUrl: `${appUrl()}/organizer/rfqs/${ctx.rfq_id}`,
            reason,
          }),
          context: { stage: "cancelBooking/booking.cancelled", id: ctx.id },
        });
      } else {
        console.warn(
          "[cancelBookingAction] organizer has no email; skipping BookingCancelledBySupplier send",
          { booking_id: ctx.id },
        );
      }

      if (inApp.ok) {
        await admin
          .from("notifications")
          .update({
            payload_jsonb: { ...basePayload, email_delivery: emailDelivery },
          })
          .eq("id", inApp.id);
      }
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
