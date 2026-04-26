"use server";

/**
 * Supplier server action — fulfill an organizer's proposal request by
 * uploading a technical-proposal PDF.
 *
 * Inputs (FormData):
 *   - invite_id: uuid (the supplier-side route is keyed by invite id)
 *   - file: the PDF (≤ 10 MB)
 *
 * Steps:
 *   1. Auth: requireAccess("supplier.rfqs.view") — same gate as the inbox.
 *   2. Resolve invite → quote → most recent pending request. Owns belt-and-
 *      suspenders supplier_id check.
 *   3. PDF size + MIME validation (matches the quote builder's existing rule).
 *   4. Upload to `supplier-docs/{supplier_id}/proposal-responses/{uuid}.pdf`.
 *      On any subsequent failure, remove the storage object so we never have
 *      a dangling file.
 *   5. Update the quote_proposal_requests row to fulfilled.
 *   6. Best-effort organizer notification.
 *   7. Revalidate + redirect supplier back to the RFQ detail page with the
 *      ?proposalSent=1 banner flag.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/access";
import { createNotification } from "@/lib/notifications/inApp";
import {
  STORAGE_BUCKETS,
  assertPathBelongsToSupplier,
  supplierScopedPath,
} from "@/lib/supabase/storage";
import type { ProposalUploadActionState } from "./action-state";

const TECHNICAL_PROPOSAL_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const inputSchema = z.object({
  invite_id: z.string().uuid(),
});

export async function respondToProposalRequestAction(
  _prev: ProposalUploadActionState | undefined,
  formData: FormData,
): Promise<ProposalUploadActionState> {
  const { decision, admin } = await requireAccess("supplier.rfqs.view");
  const supplierId = decision.supplierId;
  if (!supplierId) {
    return { status: "error", message: "Supplier profile not found." };
  }

  const parse = inputSchema.safeParse({
    invite_id: formData.get("invite_id"),
  });
  if (!parse.success) {
    return { status: "error", message: "Invalid request." };
  }
  const { invite_id } = parse.data;

  const fileRaw = formData.get("file");
  const file =
    fileRaw instanceof Blob && fileRaw.size > 0 ? (fileRaw as File) : null;
  if (!file) {
    return { status: "error", message: "Please choose a PDF to upload." };
  }
  if (file.size > TECHNICAL_PROPOSAL_MAX_BYTES) {
    return {
      status: "error",
      message: "File must be 10 MB or smaller.",
    };
  }
  if (file.type && file.type !== "application/pdf") {
    return { status: "error", message: "File must be a PDF." };
  }

  // Resolve invite → quote → pending request. Service-role read; RLS would
  // also gate this, but the supplier_id check below makes us belt-and-
  // suspenders explicit.
  const { data: inviteRow } = await admin
    .from("rfq_invites")
    .select("id, supplier_id, rfq_id")
    .eq("id", invite_id)
    .maybeSingle();
  const invite = inviteRow as {
    id: string;
    supplier_id: string;
    rfq_id: string;
  } | null;
  if (!invite || invite.supplier_id !== supplierId) {
    return { status: "error", message: "Invite not found." };
  }

  const { data: quoteRow } = await admin
    .from("quotes")
    .select("id, supplier_id")
    .eq("rfq_id", invite.rfq_id)
    .eq("supplier_id", supplierId)
    .maybeSingle();
  const quote = quoteRow as { id: string; supplier_id: string } | null;
  if (!quote) {
    return {
      status: "error",
      message:
        "You haven't submitted a quote yet for this RFQ — submit one first.",
    };
  }

  const { data: reqRow } = await admin
    .from("quote_proposal_requests")
    .select("id, status, response_file_path")
    .eq("quote_id", quote.id)
    .eq("status", "pending")
    .maybeSingle();
  const request = reqRow as {
    id: string;
    status: "pending" | "fulfilled" | "cancelled";
    response_file_path: string | null;
  } | null;
  if (!request) {
    return {
      status: "error",
      message:
        "There is no active proposal request for this quote.",
    };
  }

  // Upload the PDF.
  const path = supplierScopedPath(
    supplierId,
    "proposal-responses",
    `proposal-${crypto.randomUUID()}.pdf`,
  );
  // Defensive prefix check before we persist `path` to the DB — pairs with the
  // RLS/CHECK constraint on response_file_path so a future regression in
  // supplierScopedPath() can't smuggle a cross-supplier path through.
  assertPathBelongsToSupplier(path, supplierId);
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from(STORAGE_BUCKETS.docs)
    .upload(path, buf, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (upErr) {
    return {
      status: "error",
      message: `Upload failed: ${upErr.message}`,
    };
  }

  // Flip the request to fulfilled. `.select("id")` so a 0-row UPDATE (organizer
  // cancelled between our read and write) is observable — supabase-js returns
  // error: null with an empty array in that case, which would otherwise read as
  // success and orphan the uploaded blob.
  const { data: updRows, error: updErr } = await admin
    .from("quote_proposal_requests")
    .update({
      response_file_path: path,
      responded_at: new Date().toISOString(),
      status: "fulfilled",
    })
    .eq("id", request.id)
    .eq("status", "pending") // CAS guard against a race with cancel
    .select("id");

  if (updErr || !updRows || updRows.length !== 1) {
    // Best-effort cleanup of the uploaded blob.
    await admin.storage.from(STORAGE_BUCKETS.docs).remove([path]);
    if (updErr) {
      return {
        status: "error",
        message: `We couldn't save your proposal: ${updErr.message}`,
      };
    }
    return {
      status: "error",
      message:
        "This proposal request is no longer pending. Please refresh and try again.",
    };
  }

  // Best-effort notification to organizer.
  const { data: ownership } = await admin
    .from("quotes")
    .select(
      `id, rfqs ( id, events ( organizer_id ) )`,
    )
    .eq("id", quote.id)
    .maybeSingle();
  type OwnRow = {
    rfqs:
      | { events: { organizer_id: string } | { organizer_id: string }[] }
      | { events: { organizer_id: string } | { organizer_id: string }[] }[]
      | null;
  };
  const o = ownership as unknown as OwnRow | null;
  const rfqsNode = Array.isArray(o?.rfqs) ? o?.rfqs[0] : o?.rfqs;
  const eventsNode = Array.isArray(rfqsNode?.events)
    ? rfqsNode?.events[0]
    : rfqsNode?.events;
  const organizerId = eventsNode?.organizer_id ?? null;
  if (organizerId) {
    try {
      await createNotification({
        supabase: admin,
        user_id: organizerId,
        kind: "quote.proposal_fulfilled",
        payload: {
          quote_id: quote.id,
          rfq_id: invite.rfq_id,
          request_id: request.id,
        },
      });
    } catch (e) {
      console.error("[respondToProposalRequest] notify failed", e);
    }
  }

  revalidatePath(`/supplier/rfqs/${invite_id}`);
  revalidatePath(`/organizer/rfqs/${invite.rfq_id}/quotes`);
  revalidatePath(`/organizer/rfqs/${invite.rfq_id}/quotes/${quote.id}`);

  redirect(`/supplier/rfqs/${invite_id}?proposalSent=1`);
}
