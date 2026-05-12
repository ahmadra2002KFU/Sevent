/**
 * Disputes domain — pure types + Zod schemas + helpers.
 *
 * Dispute filing window is anchored to `bookings.completed_at` per
 * Claude Docs/state-machines.md L19 (7 days from completed_at). The window
 * computation lives here so both opening (server action) and UI gating
 * (page-level "can open dispute" checks) agree on the rule.
 */

import { z } from "zod";
import type { ServiceStatus } from "./booking";

export const DISPUTE_FILING_WINDOW_DAYS = 7;

/**
 * Closed list of dispute reason codes. The schema column is `text`, but the
 * UI offers a fixed set so admin filtering stays predictable. New codes are
 * added here only; the column itself imposes no constraint by design.
 */
export const DISPUTE_REASON_CODES = [
  "service_not_delivered",
  "service_below_spec",
  "no_show",
  "damaged_or_unsafe",
  "billing_dispute",
  "schedule_conflict",
  "other",
] as const;

export type DisputeReasonCode = (typeof DISPUTE_REASON_CODES)[number];

export const DISPUTE_STATUSES = [
  "open",
  "investigating",
  "resolved",
  "closed",
] as const;

export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const DISPUTE_EVIDENCE_KINDS = ["file", "note"] as const;
export type DisputeEvidenceKind = (typeof DISPUTE_EVIDENCE_KINDS)[number];

/**
 * Open-dispute form. `description` is required by the schema (NOT NULL);
 * we cap it so admins see something readable rather than novellas.
 */
export const OpenDisputeInput = z.object({
  booking_id: z.string().uuid(),
  reason_code: z.enum(DISPUTE_REASON_CODES),
  description: z
    .string()
    .trim()
    .min(20, "Please describe the issue in at least 20 characters.")
    .max(2000, "Description must be 2000 characters or fewer."),
});

export type OpenDisputeInputShape = z.infer<typeof OpenDisputeInput>;

/**
 * Submit-evidence form. Server actions decide which branch (file or note)
 * to validate; both kinds share the visible-to-other-party flag.
 */
export const SubmitNoteEvidenceInput = z.object({
  dispute_id: z.string().uuid(),
  kind: z.literal("note"),
  text_note: z
    .string()
    .trim()
    .min(1, "Add a note.")
    .max(2000, "Note must be 2000 characters or fewer."),
  visible_to_other_party: z.coerce.boolean().default(true),
});

export type SubmitNoteEvidenceShape = z.infer<typeof SubmitNoteEvidenceInput>;

export const SubmitFileEvidenceInput = z.object({
  dispute_id: z.string().uuid(),
  kind: z.literal("file"),
  visible_to_other_party: z.coerce.boolean().default(true),
});

export type DisputeRow = {
  id: string;
  booking_id: string;
  raised_by: string;
  reason_code: string;
  description: string;
  status: DisputeStatus;
  opened_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_jsonb: Record<string, unknown> | null;
  created_at: string;
};

export type DisputeEvidenceRow = {
  id: string;
  dispute_id: string;
  submitted_by: string;
  kind: DisputeEvidenceKind;
  file_path: string | null;
  text_note: string | null;
  visible_to_other_party: boolean;
  created_at: string;
};

/**
 * Returns the last instant a dispute can be opened against this booking,
 * or null if the booking has no `completed_at` yet.
 */
export function disputeFilingWindowEndsAt(
  completedAt: string | null,
): Date | null {
  if (!completedAt) return null;
  const start = new Date(completedAt);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(
    start.getTime() + DISPUTE_FILING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
}

/**
 * Is the booking eligible for a new dispute right now?
 *
 *   - `service_status` must be `completed` OR `disputed` (additional
 *     dispute can stack onto an in-progress one — schema supports it).
 *   - `completed_at` must be set and within the 7-day window.
 *
 * NOTE: this does NOT check whether the caller has already opened a
 * dispute. That's a server-side check in `resolveOpenDisputeContext`.
 */
export function isDisputeFilingWindowOpen(
  serviceStatus: ServiceStatus,
  completedAt: string | null,
  now: Date = new Date(),
): boolean {
  if (serviceStatus !== "completed" && serviceStatus !== "disputed") {
    return false;
  }
  const ends = disputeFilingWindowEndsAt(completedAt);
  if (!ends) return false;
  return now.getTime() < ends.getTime();
}

export const DISPUTE_REASON_LABEL_KEYS: Record<DisputeReasonCode, string> = {
  service_not_delivered: "disputes.reason.serviceNotDelivered",
  service_below_spec: "disputes.reason.serviceBelowSpec",
  no_show: "disputes.reason.noShow",
  damaged_or_unsafe: "disputes.reason.damagedOrUnsafe",
  billing_dispute: "disputes.reason.billingDispute",
  schedule_conflict: "disputes.reason.scheduleConflict",
  other: "disputes.reason.other",
};

/**
 * Build the storage path for a dispute-evidence file upload. Lives in
 * the domain layer so both the upload action and the storage RLS migration
 * can reason about the same format.
 *
 *   dispute-evidence/{dispute_id}/{submitter_profile_id}/{ts}-{safe_name}
 */
export function buildDisputeEvidencePath(opts: {
  disputeId: string;
  submitterProfileId: string;
  originalFilename: string;
  now?: Date;
}): string {
  const safe = opts.originalFilename
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 80)
    .replace(/^_+|_+$/g, "");
  const ts = (opts.now ?? new Date()).toISOString().replace(/[:.]/g, "-");
  return `${opts.disputeId}/${opts.submitterProfileId}/${ts}-${safe || "file"}`;
}
