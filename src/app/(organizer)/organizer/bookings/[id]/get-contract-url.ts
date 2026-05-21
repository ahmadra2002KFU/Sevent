"use server";

/**
 * Organizer-side signed-URL minter for the booking contract PDF.
 *
 * Security:
 *  - Caller must be the organizer who owns the booking.
 *  - Booking must be confirmed (RLS would let other states through but we
 *    surface a friendly `not_ready` instead).
 *  - bookings.contract_pdf_path must be set (a PDF render may have failed
 *    silently in confirmBookingAction; in that case we return `missing`
 *    and the UI tells the organizer the contract is still being prepared).
 *
 * The signed URL is valid for 1 hour — long enough to click through once,
 * short enough that leaks don't become long-lived exfiltration.
 */

import { requireAccess } from "@/lib/auth/access";
import {
  canViewOrganizerRow,
  organizerScopeFor,
} from "@/lib/auth/organizerScope";
import type { ConfirmationStatus } from "@/lib/domain/booking";

export type GetContractUrlResult =
  | { url: string }
  | { error: "not_found" | "not_ready" | "missing" | "sign_failed" };

export async function getContractUrlAction(
  bookingId: string,
): Promise<GetContractUrlResult> {
  const { user, admin, decision } = await requireAccess("organizer.bookings");
  const scope = organizerScopeFor(decision, user.id);

  const { data: booking } = await admin
    .from("bookings")
    .select("id, organizer_id, company_id, confirmation_status, contract_pdf_path")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return { error: "not_found" };
  const row = booking as {
    id: string;
    organizer_id: string;
    company_id: string | null;
    confirmation_status: ConfirmationStatus;
    contract_pdf_path: string | null;
  };
  // Visible to the individual owner OR any member of the owning company.
  if (
    !canViewOrganizerRow(scope, {
      company_id: row.company_id,
      ownerId: row.organizer_id,
    })
  ) {
    return { error: "not_found" };
  }

  if (row.confirmation_status !== "confirmed") {
    return { error: "not_ready" };
  }
  if (!row.contract_pdf_path) {
    return { error: "missing" };
  }

  const { data: signed, error } = await admin.storage
    .from("contracts")
    .createSignedUrl(row.contract_pdf_path, 60 * 60);
  if (error || !signed?.signedUrl) {
    return { error: "sign_failed" };
  }
  return { url: signed.signedUrl };
}
