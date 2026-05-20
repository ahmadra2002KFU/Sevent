/**
 * Attachment domain — shared limits + helpers for organizer RFQ/بند file
 * attachments (images + documents).
 *
 * Single source of truth used by:
 *   - the client upload control (BandAttachmentsField)
 *   - the server-side validator in the events server action (uploadBandAttachments)
 *   - the read surfaces (RfqAttachmentsView)
 *
 * Files live in the `rfq-attachments` storage bucket and are tracked by the
 * `rfq_attachments` table (migration 20260521100000). Each بند on the event
 * form can carry several images/documents that travel with that بند's RFQ.
 */

const MB = 1024 * 1024;

/** Mirrors the public.rfq_attachment_kind enum (migration 20260521100000). */
export type AttachmentKind = "image" | "document";

export const ATTACHMENT_IMAGE_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const ATTACHMENT_DOC_MIME = ["application/pdf"] as const;

export const ATTACHMENT_ALLOWED_MIME = [
  ...ATTACHMENT_IMAGE_MIME,
  ...ATTACHMENT_DOC_MIME,
] as const;

export type AttachmentMime = (typeof ATTACHMENT_ALLOWED_MIME)[number];

/** `accept` attribute value for an <input type="file">. */
export const ATTACHMENT_ACCEPT = ATTACHMENT_ALLOWED_MIME.join(",");

// Per-file size caps. Tuned to keep a full multi-بند submit under the
// next.config serverActions.bodySizeLimit (45mb) with headroom — see
// ATTACHMENT_MAX_TOTAL_BYTES_PER_SUBMIT.
export const ATTACHMENT_MAX_IMAGE_BYTES = 5 * MB;
export const ATTACHMENT_MAX_DOC_BYTES = 10 * MB;

/** Max files attached to a single بند. */
export const ATTACHMENT_MAX_PER_BAND = 5;

/**
 * Total bytes across ALL بند files in one event-creation / add-بند submit.
 * The whole multipart POST (form fields + every بند's files) must fit under
 * next.config `serverActions.bodySizeLimit`; this budget leaves headroom.
 */
export const ATTACHMENT_MAX_TOTAL_BYTES_PER_SUBMIT = 40 * MB;

/** Resolve the attachment kind for a MIME type, or null if not allowed. */
export function kindForMime(mime: string): AttachmentKind | null {
  if ((ATTACHMENT_IMAGE_MIME as readonly string[]).includes(mime)) {
    return "image";
  }
  if ((ATTACHMENT_DOC_MIME as readonly string[]).includes(mime)) {
    return "document";
  }
  return null;
}

/** Per-file size ceiling for a given kind. */
export function maxBytesForKind(kind: AttachmentKind): number {
  return kind === "image"
    ? ATTACHMENT_MAX_IMAGE_BYTES
    : ATTACHMENT_MAX_DOC_BYTES;
}

/**
 * Row shape mirroring public.rfq_attachments. Kept here (alongside the limits)
 * rather than in supabase/types.ts so the attachment concern stays cohesive in
 * one module; the read surfaces import this directly.
 */
export type RfqAttachmentRow = {
  id: string;
  rfq_id: string;
  event_id: string;
  uploaded_by: string;
  kind: AttachmentKind;
  file_path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};
