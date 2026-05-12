"use server";

/**
 * Organizer-side dispute server actions — thin wrappers around the shared
 * helpers in `@/lib/domain/disputes.actions.server`. The wrappers exist so
 * each role can gate on its own `requireAccess` feature.
 */

import { requireAccess } from "@/lib/auth/access";
import {
  openDispute,
  submitNoteEvidence,
  submitFileEvidence,
  getEvidenceSignedUrl,
  type OpenDisputeActionState,
  type EvidenceActionState,
  type GetEvidenceUrlResult,
} from "@/lib/domain/disputes.actions.server";

export async function openDisputeAction(
  bookingId: string,
  _prev: OpenDisputeActionState | undefined,
  formData: FormData,
): Promise<OpenDisputeActionState> {
  const { user, admin } = await requireAccess("organizer.bookings");
  return openDispute(
    {
      admin,
      viewerProfileId: user.id,
      bookingId,
      reasonCode: (formData.get("reason_code") as never) ?? "other",
      description: (formData.get("description") as never) ?? "",
      revalidatePaths: [
        `/organizer/bookings/${bookingId}`,
        `/organizer/bookings/${bookingId}/dispute`,
        `/supplier/bookings/${bookingId}`,
        `/admin/disputes`,
      ],
    },
    {
      booking_id: formData.get("booking_id"),
      reason_code: formData.get("reason_code"),
      description: formData.get("description"),
    },
  );
}

export async function submitNoteEvidenceAction(
  disputeId: string,
  bookingId: string,
  _prev: EvidenceActionState | undefined,
  formData: FormData,
): Promise<EvidenceActionState> {
  const { user, admin } = await requireAccess("organizer.bookings");
  return submitNoteEvidence(
    {
      admin,
      viewerProfileId: user.id,
      revalidatePaths: [
        `/organizer/bookings/${bookingId}/dispute`,
        `/admin/disputes/${disputeId}`,
      ],
    },
    {
      dispute_id: formData.get("dispute_id") ?? disputeId,
      text_note: formData.get("text_note"),
      visible_to_other_party: formData.get("visible_to_other_party"),
    },
  );
}

export async function submitFileEvidenceAction(
  disputeId: string,
  bookingId: string,
  _prev: EvidenceActionState | undefined,
  formData: FormData,
): Promise<EvidenceActionState> {
  const { user, admin } = await requireAccess("organizer.bookings");
  // Make sure the dispute_id is set even if the page didn't include it.
  if (!formData.get("dispute_id")) {
    formData.set("dispute_id", disputeId);
  }
  return submitFileEvidence(
    {
      admin,
      viewerProfileId: user.id,
      revalidatePaths: [
        `/organizer/bookings/${bookingId}/dispute`,
        `/admin/disputes/${disputeId}`,
      ],
    },
    formData,
  );
}

export async function getEvidenceUrlAction(
  evidenceId: string,
): Promise<GetEvidenceUrlResult> {
  const { user, admin } = await requireAccess("organizer.bookings");
  return getEvidenceSignedUrl({
    admin,
    viewerProfileId: user.id,
    evidenceId,
  });
}
