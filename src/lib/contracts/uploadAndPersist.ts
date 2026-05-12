/**
 * Uploads a contract PDF blob to the `contracts` Storage bucket and
 * persists the path on the matching `bookings` row.
 *
 * Path layout (deterministic + idempotent):
 *   {booking_id}/{accepted_quote_revision_id}.pdf
 *
 * The deterministic path means a retry after a partial failure produces
 * the same object key — we never accumulate orphan PDFs. If the object
 * already exists (caller retried after a successful upload but a failed
 * DB write), the upload returns "Duplicate" which we treat as success
 * and proceed to the path persistence step.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type UploadContractInput = {
  /** Service-role Supabase client (RLS bypass for `contracts` bucket writes). */
  admin: SupabaseClient;
  bookingId: string;
  acceptedQuoteRevisionId: string;
  bytes: Uint8Array;
};

export type UploadContractResult = { path: string };

export async function uploadContractAndPersist(
  input: UploadContractInput,
): Promise<UploadContractResult> {
  const { admin, bookingId, acceptedQuoteRevisionId, bytes } = input;
  const path = `${bookingId}/${acceptedQuoteRevisionId}.pdf`;

  const { error: uploadError } = await admin.storage
    .from("contracts")
    .upload(path, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });

  // Idempotency: a deterministic path means retries can collide with an
  // object from a previous successful upload. Treat that specific case as
  // success and proceed. Any other storage error bubbles up.
  if (uploadError) {
    const code = (uploadError as { statusCode?: string }).statusCode;
    const message = uploadError.message ?? "";
    const isAlreadyExists =
      code === "409" ||
      /already exists/i.test(message) ||
      /duplicate/i.test(message);
    if (!isAlreadyExists) {
      throw new Error(`contracts upload failed: ${message || "unknown"}`);
    }
  }

  const { error: updateError } = await admin
    .from("bookings")
    .update({ contract_pdf_path: path })
    .eq("id", bookingId);

  if (updateError) {
    throw new Error(
      `bookings.contract_pdf_path persist failed: ${updateError.message}`,
    );
  }

  return { path };
}
