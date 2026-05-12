/**
 * Shared server-only action helpers for dispute open + evidence flows.
 *
 * Server actions for each role (organizer/supplier) are thin wrappers that
 * (1) call `requireAccess(role.feature)` and (2) delegate to one of these
 * functions. The logic stays in one file so we don't get drift between the
 * organizer and supplier paths.
 *
 * Storage uploads use the service-role client to bypass the
 * `dispute-evidence` bucket's RLS (which only grants SELECT to parties —
 * INSERT is service-role only per opencode plan review §3).
 */

import "server-only";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildDisputeEvidencePath,
  OpenDisputeInput,
  SubmitNoteEvidenceInput,
  type DisputeReasonCode,
} from "./disputes";
import {
  resolveOpenDisputeContext,
  resolveDisputeContext,
  type ResolveOpenDisputeContextErr,
} from "./disputes.server";
import { createNotification } from "@/lib/notifications/inApp";

const DISPUTE_EVIDENCE_BUCKET = "dispute-evidence";
const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024; // 25 MB per file

export type OpenDisputeActionState =
  | { status: "idle" }
  | { status: "success"; message: string; disputeId: string }
  | { status: "error"; message: string };

export type EvidenceActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function openReasonMessage(
  reason: ResolveOpenDisputeContextErr["reason"],
): string {
  switch (reason) {
    case "not_found":
      return "Booking not found.";
    case "not_party":
      return "You're not a party to this booking.";
    case "not_completed":
      return "Disputes can only be opened on completed bookings.";
    case "missing_completed_at":
      return "Dispute window has not opened yet.";
    case "window_closed":
      return "The 7-day dispute window has closed.";
    case "already_open_by_viewer":
      return "You already have an open dispute on this booking.";
  }
}

export type OpenDisputeArgs = {
  admin: SupabaseClient;
  viewerProfileId: string;
  bookingId: string;
  reasonCode: DisputeReasonCode;
  description: string;
  revalidatePaths: string[];
};

/**
 * Opens a dispute on behalf of the viewer. Returns a discriminated state
 * carrying either the new dispute id or a translated-enough message.
 *
 * Cross-table state machine (booking.service_status flip, reviews
 * suppression) is handled by the AFTER trigger added in Slice 4A
 * (`disputes_handle_open`). This function only INSERTs and fans out
 * notifications.
 */
export async function openDispute(
  args: OpenDisputeArgs,
  raw: { booking_id: unknown; reason_code: unknown; description: unknown },
): Promise<OpenDisputeActionState> {
  const parsed = OpenDisputeInput.safeParse({
    booking_id: raw.booking_id ?? args.bookingId,
    reason_code: raw.reason_code,
    description: raw.description,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      status: "error",
      message: first?.message ?? "Invalid dispute submission.",
    };
  }

  if (parsed.data.booking_id !== args.bookingId) {
    // The hidden field was tampered with; treat as a forgery attempt.
    return { status: "error", message: "Booking mismatch." };
  }

  const ctx = await resolveOpenDisputeContext({
    admin: args.admin,
    bookingId: parsed.data.booking_id,
    viewerProfileId: args.viewerProfileId,
  });
  if (!ctx.ok) {
    return { status: "error", message: openReasonMessage(ctx.reason) };
  }

  const { data: inserted, error: insertError } = await args.admin
    .from("disputes")
    .insert({
      booking_id: ctx.booking.id,
      raised_by: ctx.raiser_profile_id,
      reason_code: parsed.data.reason_code,
      description: parsed.data.description,
      // `status` defaults to 'open' in the schema; explicit for clarity.
      status: "open",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      status: "error",
      message: insertError?.message ?? "Could not open the dispute.",
    };
  }
  const disputeId = (inserted as { id: string }).id;

  // Notify the other party. Best-effort — never fail the open on notify error.
  try {
    await createNotification({
      supabase: args.admin,
      user_id: ctx.other_party_profile_id,
      kind: "dispute.opened",
      payload: {
        booking_id: ctx.booking.id,
        dispute_id: disputeId,
        from_role: ctx.role,
        reason_code: parsed.data.reason_code,
      },
    });
  } catch (e) {
    console.error("[openDispute] notify failed", e);
  }

  for (const p of args.revalidatePaths) {
    revalidatePath(p);
  }

  return {
    status: "success",
    message: "Dispute opened. Admins will review and contact both parties.",
    disputeId,
  };
}

// ============================================================================
// Evidence: notes
// ============================================================================

export type SubmitNoteArgs = {
  admin: SupabaseClient;
  viewerProfileId: string;
  isAdmin?: boolean;
  revalidatePaths: string[];
};

export async function submitNoteEvidence(
  args: SubmitNoteArgs,
  raw: {
    dispute_id: unknown;
    text_note: unknown;
    visible_to_other_party: unknown;
  },
): Promise<EvidenceActionState> {
  const parsed = SubmitNoteEvidenceInput.safeParse({
    dispute_id: raw.dispute_id,
    kind: "note",
    text_note: raw.text_note,
    // Checkbox sends "on" or nothing.
    visible_to_other_party:
      raw.visible_to_other_party === "on" ||
      raw.visible_to_other_party === true,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      status: "error",
      message: first?.message ?? "Invalid note.",
    };
  }

  const ctx = await resolveDisputeContext({
    admin: args.admin,
    disputeId: parsed.data.dispute_id,
    viewerProfileId: args.viewerProfileId,
    isAdmin: args.isAdmin ?? false,
  });
  if (!ctx.ok) {
    return {
      status: "error",
      message:
        ctx.reason === "not_found"
          ? "Dispute not found."
          : "You're not a party to this dispute.",
    };
  }

  const { error } = await args.admin.from("dispute_evidence").insert({
    dispute_id: ctx.dispute.id,
    submitted_by: args.viewerProfileId,
    kind: "note",
    text_note: parsed.data.text_note,
    visible_to_other_party: parsed.data.visible_to_other_party,
  });
  if (error) {
    return { status: "error", message: error.message };
  }

  // Notify the other party + the raiser if the submitter isn't them.
  try {
    const recipientIds = new Set<string>();
    recipientIds.add(ctx.other_party_profile_id);
    if (
      ctx.dispute.raised_by !== args.viewerProfileId &&
      ctx.dispute.raised_by !== ctx.other_party_profile_id
    ) {
      recipientIds.add(ctx.dispute.raised_by);
    }
    for (const uid of recipientIds) {
      await createNotification({
        supabase: args.admin,
        user_id: uid,
        kind: "dispute.evidence_submitted",
        payload: {
          dispute_id: ctx.dispute.id,
          booking_id: ctx.dispute.booking_id,
          evidence_kind: "note",
        },
      });
    }
  } catch (e) {
    console.error("[submitNoteEvidence] notify failed", e);
  }

  for (const p of args.revalidatePaths) revalidatePath(p);

  return { status: "success", message: "Note added." };
}

// ============================================================================
// Evidence: files
// ============================================================================

export type SubmitFileArgs = SubmitNoteArgs;

export async function submitFileEvidence(
  args: SubmitFileArgs,
  formData: FormData,
): Promise<EvidenceActionState> {
  const disputeIdRaw = formData.get("dispute_id");
  const file = formData.get("file");
  const visible = formData.get("visible_to_other_party") === "on";

  if (typeof disputeIdRaw !== "string" || !disputeIdRaw) {
    return { status: "error", message: "Missing dispute id." };
  }
  if (!(file instanceof Blob)) {
    return { status: "error", message: "Pick a file first." };
  }
  if (file.size === 0) {
    return { status: "error", message: "Pick a file first." };
  }
  if (file.size > MAX_EVIDENCE_BYTES) {
    return { status: "error", message: "File is too large (25 MB max)." };
  }

  const ctx = await resolveDisputeContext({
    admin: args.admin,
    disputeId: disputeIdRaw,
    viewerProfileId: args.viewerProfileId,
    isAdmin: args.isAdmin ?? false,
  });
  if (!ctx.ok) {
    return {
      status: "error",
      message:
        ctx.reason === "not_found"
          ? "Dispute not found."
          : "You're not a party to this dispute.",
    };
  }

  const originalName =
    (file as Blob & { name?: string }).name?.toString() ?? "file";
  const path = buildDisputeEvidencePath({
    disputeId: ctx.dispute.id,
    submitterProfileId: args.viewerProfileId,
    originalFilename: originalName,
  });

  const arrayBuf = await file.arrayBuffer();
  const { error: uploadErr } = await args.admin.storage
    .from(DISPUTE_EVIDENCE_BUCKET)
    .upload(path, new Uint8Array(arrayBuf), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadErr) {
    return { status: "error", message: uploadErr.message };
  }

  const { error: insertErr } = await args.admin
    .from("dispute_evidence")
    .insert({
      dispute_id: ctx.dispute.id,
      submitted_by: args.viewerProfileId,
      kind: "file",
      file_path: path,
      visible_to_other_party: visible,
    });
  if (insertErr) {
    // Best-effort cleanup of the orphaned object so storage doesn't keep a
    // file whose audit row never landed.
    await args.admin.storage
      .from(DISPUTE_EVIDENCE_BUCKET)
      .remove([path])
      .catch(() => {});
    return { status: "error", message: insertErr.message };
  }

  try {
    const recipientIds = new Set<string>();
    recipientIds.add(ctx.other_party_profile_id);
    if (
      ctx.dispute.raised_by !== args.viewerProfileId &&
      ctx.dispute.raised_by !== ctx.other_party_profile_id
    ) {
      recipientIds.add(ctx.dispute.raised_by);
    }
    for (const uid of recipientIds) {
      await createNotification({
        supabase: args.admin,
        user_id: uid,
        kind: "dispute.evidence_submitted",
        payload: {
          dispute_id: ctx.dispute.id,
          booking_id: ctx.dispute.booking_id,
          evidence_kind: "file",
        },
      });
    }
  } catch (e) {
    console.error("[submitFileEvidence] notify failed", e);
  }

  for (const p of args.revalidatePaths) revalidatePath(p);

  return { status: "success", message: "File uploaded." };
}

// ============================================================================
// Signed-URL minting for evidence file download
// ============================================================================

export type GetEvidenceUrlResult =
  | { status: "success"; url: string }
  | { status: "error"; message: string };

export async function getEvidenceSignedUrl(args: {
  admin: SupabaseClient;
  viewerProfileId: string;
  isAdmin?: boolean;
  evidenceId: string;
}): Promise<GetEvidenceUrlResult> {
  const { data: ev } = await args.admin
    .from("dispute_evidence")
    .select(
      `id, dispute_id, kind, file_path, visible_to_other_party, submitted_by,
       disputes ( id, booking_id, bookings ( id, organizer_id, supplier_id,
         suppliers ( id, profile_id ) ) )`,
    )
    .eq("id", args.evidenceId)
    .maybeSingle();
  type Row = {
    id: string;
    dispute_id: string;
    kind: string;
    file_path: string | null;
    visible_to_other_party: boolean;
    submitted_by: string;
    disputes: {
      id: string;
      booking_id: string;
      bookings: {
        id: string;
        organizer_id: string;
        supplier_id: string;
        suppliers: { id: string; profile_id: string } | null;
      } | null;
    } | null;
  };
  const row = ev as unknown as Row | null;
  if (!row || row.kind !== "file" || !row.file_path || !row.disputes?.bookings) {
    return { status: "error", message: "Evidence file not found." };
  }
  if (!row.disputes.bookings.suppliers) {
    return { status: "error", message: "Evidence file not found." };
  }

  const isOrganizer =
    row.disputes.bookings.organizer_id === args.viewerProfileId;
  const isSupplier =
    row.disputes.bookings.suppliers.profile_id === args.viewerProfileId;
  const isSubmitter = row.submitted_by === args.viewerProfileId;

  if (
    !args.isAdmin &&
    !isSubmitter &&
    !(
      (isOrganizer || isSupplier) &&
      row.visible_to_other_party
    )
  ) {
    return { status: "error", message: "Not authorized." };
  }

  const { data: signed, error } = await args.admin.storage
    .from(DISPUTE_EVIDENCE_BUCKET)
    .createSignedUrl(row.file_path, 60 * 60);
  if (error || !signed) {
    return {
      status: "error",
      message: error?.message ?? "Could not generate download URL.",
    };
  }
  return { status: "success", url: signed.signedUrl };
}
