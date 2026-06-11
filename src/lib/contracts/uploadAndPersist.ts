/**
 * Uploads a contract PDF blob to the `contracts` Storage bucket and
 * persists the path on the matching `bookings` row.
 *
 * The English and Arabic contracts are SEPARATE files, so the path and the
 * persisted column are per-locale:
 *   en → {booking_id}/{accepted_quote_revision_id}-en.pdf → bookings.contract_pdf_path
 *   ar → {booking_id}/{accepted_quote_revision_id}-ar.pdf → bookings.contract_pdf_path_ar
 *
 * The deterministic path means a retry after a partial failure produces
 * the same object key — we never accumulate orphan PDFs. If the object
 * already exists (caller retried after a successful upload but a failed
 * DB write), the upload returns "Duplicate" which we treat as success
 * and proceed to the path persistence step.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContractLocale } from "./ContractDocument";

export type UploadContractInput = {
  /** Service-role Supabase client (RLS bypass for `contracts` bucket writes). */
  admin: SupabaseClient;
  bookingId: string;
  acceptedQuoteRevisionId: string;
  bytes: Uint8Array;
  locale: ContractLocale;
};

export type UploadContractResult = { path: string };

const COLUMN_FOR_LOCALE: Record<ContractLocale, string> = {
  en: "contract_pdf_path",
  ar: "contract_pdf_path_ar",
};

export async function uploadContractAndPersist(
  input: UploadContractInput,
): Promise<UploadContractResult> {
  const { admin, bookingId, acceptedQuoteRevisionId, bytes, locale } = input;
  const path = `${bookingId}/${acceptedQuoteRevisionId}-${locale}.pdf`;

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

  const column = COLUMN_FOR_LOCALE[locale];
  const { error: updateError } = await admin
    .from("bookings")
    .update({ [column]: path })
    .eq("id", bookingId);

  if (updateError) {
    throw new Error(`bookings.${column} persist failed: ${updateError.message}`);
  }

  return { path };
}
