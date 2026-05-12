"use server";

/**
 * Supplier-side signed-URL minter for the booking contract PDF.
 * Mirror of the organizer-side action; ownership check resolves the
 * caller's supplier_id via requireAccess.
 */

import { requireAccess } from "@/lib/auth/access";
import type { ConfirmationStatus } from "@/lib/domain/booking";

export type GetContractUrlResult =
  | { url: string }
  | { error: "not_found" | "not_ready" | "missing" | "sign_failed" };

export async function getContractUrlAction(
  bookingId: string,
): Promise<GetContractUrlResult> {
  const { decision, admin } = await requireAccess("supplier.bookings");
  const supplierId = decision.supplierId;
  if (!supplierId) return { error: "not_found" };

  const { data: booking } = await admin
    .from("bookings")
    .select("id, supplier_id, confirmation_status, contract_pdf_path")
    .eq("id", bookingId)
    .eq("supplier_id", supplierId)
    .maybeSingle();

  if (!booking) return { error: "not_found" };
  const row = booking as {
    id: string;
    supplier_id: string;
    confirmation_status: ConfirmationStatus;
    contract_pdf_path: string | null;
  };

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
