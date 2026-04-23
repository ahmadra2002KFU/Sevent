"use server";

/**
 * Self-apply server action for the supplier marketplace.
 *
 * Flow:
 *   1. Gate on `supplier.opportunities.apply` (approved+published only —
 *      redirects otherwise).
 *   2. Confirm the RFQ is still published, still in 'sent' state, and not yet
 *      expired.
 *   3. Insert an `rfq_invites` row with `source='self_applied'`,
 *      `status='invited'`, `response_due_at = coalesce(rfq.expires_at, now+48h)`.
 *      Uses `ON CONFLICT DO NOTHING` so a double-click doesn't error — if a
 *      row already exists we just redirect the supplier into their quote
 *      builder (the RFQ inbox will also show the row now).
 *   4. Redirect to the existing `/supplier/rfqs/[inviteId]/quote` route where
 *      the QuoteBuilder renders exactly like it does for invited suppliers.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth/access";

const FALLBACK_RESPONSE_WINDOW_MS = 48 * 60 * 60 * 1000;

export async function applyToOpportunity(rfqId: string): Promise<
  | { ok: true; inviteId: string }
  | { ok: false; message: string }
> {
  if (!rfqId || typeof rfqId !== "string") {
    return { ok: false, message: "Missing RFQ id." };
  }

  const { decision, admin } = await requireAccess(
    "supplier.opportunities.apply",
  );
  const supplierId = decision.supplierId;
  if (!supplierId) {
    return { ok: false, message: "Supplier profile not found." };
  }

  // Re-verify the target RFQ is still eligible for self-apply. RLS would
  // enforce the INSERT check anyway, but a clear error message beats a raw
  // Postgres rejection.
  const { data: rfqRow, error: rfqErr } = await admin
    .from("rfqs")
    .select("id, status, expires_at, is_published_to_marketplace")
    .eq("id", rfqId)
    .maybeSingle();
  if (rfqErr) {
    return { ok: false, message: `RFQ lookup failed: ${rfqErr.message}` };
  }
  if (!rfqRow) {
    return { ok: false, message: "RFQ not found." };
  }
  const rfq = rfqRow as {
    id: string;
    status: string;
    expires_at: string | null;
    is_published_to_marketplace: boolean;
  };
  if (!rfq.is_published_to_marketplace || rfq.status !== "sent") {
    return {
      ok: false,
      message: "This opportunity is no longer open.",
    };
  }
  if (rfq.expires_at && new Date(rfq.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      message: "This opportunity has expired.",
    };
  }

  // Invite row bookkeeping. The (rfq_id, supplier_id) unique constraint on
  // rfq_invites prevents duplicates; if one exists already (rare — the
  // detail loader short-circuits when it sees a row) we surface the existing
  // invite's id so the supplier lands on the same quote builder.
  const { data: existing } = await admin
    .from("rfq_invites")
    .select("id")
    .eq("rfq_id", rfqId)
    .eq("supplier_id", supplierId)
    .maybeSingle();

  let inviteId: string;
  if (existing) {
    inviteId = (existing as { id: string }).id;
  } else {
    const responseDueAt =
      rfq.expires_at ??
      new Date(Date.now() + FALLBACK_RESPONSE_WINDOW_MS).toISOString();
    const { data: inserted, error: insErr } = await admin
      .from("rfq_invites")
      .insert({
        rfq_id: rfqId,
        supplier_id: supplierId,
        source: "self_applied",
        status: "invited",
        sent_at: new Date().toISOString(),
        response_due_at: responseDueAt,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      return {
        ok: false,
        message: `Could not apply: ${insErr?.message ?? "insert failed"}`,
      };
    }
    inviteId = (inserted as { id: string }).id;
  }

  revalidatePath("/supplier/opportunities");
  revalidatePath("/supplier/rfqs");
  redirect(`/supplier/rfqs/${inviteId}/quote`);
}
