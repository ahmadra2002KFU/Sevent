"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import {
  submitNoteEvidence,
  submitFileEvidence,
  getEvidenceSignedUrl,
  type EvidenceActionState,
  type GetEvidenceUrlResult,
} from "@/lib/domain/disputes.actions.server";
import { createNotification } from "@/lib/notifications/inApp";

export type ResolveActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

async function loadAndAuthorize(disputeId: string) {
  const gate = await requireRole("admin");
  if (gate.status !== "ok") {
    return {
      ok: false as const,
      message: "Admin access required.",
    };
  }
  const { admin, user } = gate;

  const { data: row } = await admin
    .from("disputes")
    .select(
      `id, booking_id, raised_by, status,
       bookings ( id, organizer_id, supplier_id,
         suppliers ( id, profile_id ) )`,
    )
    .eq("id", disputeId)
    .maybeSingle();
  type Row = {
    id: string;
    booking_id: string;
    raised_by: string;
    status: "open" | "investigating" | "resolved" | "closed";
    bookings: {
      id: string;
      organizer_id: string;
      supplier_id: string;
      suppliers: { id: string; profile_id: string } | null;
    } | null;
  };
  const d = row as unknown as Row | null;
  if (!d || !d.bookings || !d.bookings.suppliers) {
    return { ok: false as const, message: "Dispute not found." };
  }
  return {
    ok: true as const,
    admin,
    adminProfileId: user.id,
    dispute: d,
  };
}

/**
 * Marks a dispute resolved. The AFTER trigger added in Slice 4A
 * (`disputes_handle_resolve`) handles cross-table state restoration when
 * this is the last active dispute on the booking.
 */
export async function resolveDisputeAction(
  disputeId: string,
  _prev: ResolveActionState | undefined,
  formData: FormData,
): Promise<ResolveActionState> {
  const ctx = await loadAndAuthorize(disputeId);
  if (!ctx.ok) return { status: "error", message: ctx.message };
  if (ctx.dispute.status !== "open" && ctx.dispute.status !== "investigating") {
    return {
      status: "error",
      message: `Already ${ctx.dispute.status}.`,
    };
  }

  const note = ((formData.get("resolution_note") as string) ?? "").trim();
  const resolution = {
    note: note.length > 0 ? note : null,
    resolved_by_admin: true,
  };

  const { error } = await ctx.admin
    .from("disputes")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: ctx.adminProfileId,
      resolution_jsonb: resolution,
    })
    .eq("id", disputeId);

  if (error) return { status: "error", message: error.message };

  // Notify both parties.
  try {
    const partyIds = new Set<string>([
      ctx.dispute.bookings!.organizer_id,
      ctx.dispute.bookings!.suppliers!.profile_id,
    ]);
    for (const uid of partyIds) {
      await createNotification({
        supabase: ctx.admin,
        user_id: uid,
        kind: "dispute.resolved",
        payload: {
          dispute_id: disputeId,
          booking_id: ctx.dispute.booking_id,
        },
      });
    }
  } catch (e) {
    console.error("[resolveDisputeAction] notify failed", e);
  }

  revalidatePath(`/admin/disputes`);
  revalidatePath(`/admin/disputes/${disputeId}`);
  revalidatePath(`/organizer/bookings/${ctx.dispute.booking_id}/dispute`);
  revalidatePath(`/supplier/bookings/${ctx.dispute.booking_id}/dispute`);

  return { status: "success", message: "Dispute resolved." };
}

/**
 * Closes a dispute without resolving it (e.g. parties withdrew, mediation
 * complete without verdict). Trigger restores booking state same as resolve.
 */
export async function closeDisputeAction(
  disputeId: string,
  _prev: ResolveActionState | undefined,
  formData: FormData,
): Promise<ResolveActionState> {
  const ctx = await loadAndAuthorize(disputeId);
  if (!ctx.ok) return { status: "error", message: ctx.message };
  if (ctx.dispute.status !== "open" && ctx.dispute.status !== "investigating") {
    return {
      status: "error",
      message: `Already ${ctx.dispute.status}.`,
    };
  }

  const note = ((formData.get("resolution_note") as string) ?? "").trim();
  const resolution = {
    note: note.length > 0 ? note : null,
    closed_by_admin: true,
  };

  const { error } = await ctx.admin
    .from("disputes")
    .update({
      status: "closed",
      resolved_at: new Date().toISOString(),
      resolved_by: ctx.adminProfileId,
      resolution_jsonb: resolution,
    })
    .eq("id", disputeId);
  if (error) return { status: "error", message: error.message };

  try {
    const partyIds = new Set<string>([
      ctx.dispute.bookings!.organizer_id,
      ctx.dispute.bookings!.suppliers!.profile_id,
    ]);
    for (const uid of partyIds) {
      await createNotification({
        supabase: ctx.admin,
        user_id: uid,
        kind: "dispute.closed",
        payload: {
          dispute_id: disputeId,
          booking_id: ctx.dispute.booking_id,
        },
      });
    }
  } catch (e) {
    console.error("[closeDisputeAction] notify failed", e);
  }

  revalidatePath(`/admin/disputes`);
  revalidatePath(`/admin/disputes/${disputeId}`);
  revalidatePath(`/organizer/bookings/${ctx.dispute.booking_id}/dispute`);
  revalidatePath(`/supplier/bookings/${ctx.dispute.booking_id}/dispute`);

  return { status: "success", message: "Dispute closed." };
}

// ----------------------------------------------------------------------------
// Evidence actions (admin can add notes / files on behalf, and download files)
// ----------------------------------------------------------------------------

export async function adminSubmitNoteEvidenceAction(
  disputeId: string,
  bookingId: string,
  _prev: EvidenceActionState | undefined,
  formData: FormData,
): Promise<EvidenceActionState> {
  const gate = await requireRole("admin");
  if (gate.status !== "ok") {
    return { status: "error", message: "Admin access required." };
  }
  return submitNoteEvidence(
    {
      admin: gate.admin,
      viewerProfileId: gate.user.id,
      isAdmin: true,
      revalidatePaths: [
        `/admin/disputes/${disputeId}`,
        `/organizer/bookings/${bookingId}/dispute`,
        `/supplier/bookings/${bookingId}/dispute`,
      ],
    },
    {
      dispute_id: formData.get("dispute_id") ?? disputeId,
      text_note: formData.get("text_note"),
      visible_to_other_party: formData.get("visible_to_other_party"),
    },
  );
}

export async function adminSubmitFileEvidenceAction(
  disputeId: string,
  bookingId: string,
  _prev: EvidenceActionState | undefined,
  formData: FormData,
): Promise<EvidenceActionState> {
  const gate = await requireRole("admin");
  if (gate.status !== "ok") {
    return { status: "error", message: "Admin access required." };
  }
  if (!formData.get("dispute_id")) {
    formData.set("dispute_id", disputeId);
  }
  return submitFileEvidence(
    {
      admin: gate.admin,
      viewerProfileId: gate.user.id,
      isAdmin: true,
      revalidatePaths: [
        `/admin/disputes/${disputeId}`,
        `/organizer/bookings/${bookingId}/dispute`,
        `/supplier/bookings/${bookingId}/dispute`,
      ],
    },
    formData,
  );
}

export async function adminGetEvidenceUrlAction(
  evidenceId: string,
): Promise<GetEvidenceUrlResult> {
  const gate = await requireRole("admin");
  if (gate.status !== "ok") {
    return { status: "error", message: "Admin access required." };
  }
  return getEvidenceSignedUrl({
    admin: gate.admin,
    viewerProfileId: gate.user.id,
    isAdmin: true,
    evidenceId,
  });
}
