"use server";

/**
 * Supplier-side dispute server actions — thin wrappers around the shared
 * helpers in `@/lib/domain/disputes.actions.server`. Mirrors the organizer
 * file; the underlying helpers derive the role from the booking party
 * relationship.
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
  const { user, admin } = await requireAccess("supplier.bookings");
  return openDispute(
    {
      admin,
      viewerProfileId: user.id,
      bookingId,
      reasonCode: (formData.get("reason_code") as never) ?? "other",
      description: (formData.get("description") as never) ?? "",
      revalidatePaths: [
        `/supplier/bookings/${bookingId}`,
        `/supplier/bookings/${bookingId}/dispute`,
        `/organizer/bookings/${bookingId}`,
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
  const { user, admin } = await requireAccess("supplier.bookings");
  return submitNoteEvidence(
    {
      admin,
      viewerProfileId: user.id,
      revalidatePaths: [
        `/supplier/bookings/${bookingId}/dispute`,
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
  const { user, admin } = await requireAccess("supplier.bookings");
  if (!formData.get("dispute_id")) {
    formData.set("dispute_id", disputeId);
  }
  return submitFileEvidence(
    {
      admin,
      viewerProfileId: user.id,
      revalidatePaths: [
        `/supplier/bookings/${bookingId}/dispute`,
        `/admin/disputes/${disputeId}`,
      ],
    },
    formData,
  );
}

export async function getEvidenceUrlAction(
  evidenceId: string,
): Promise<GetEvidenceUrlResult> {
  const { user, admin } = await requireAccess("supplier.bookings");
  return getEvidenceSignedUrl({
    admin,
    viewerProfileId: user.id,
    evidenceId,
  });
}
