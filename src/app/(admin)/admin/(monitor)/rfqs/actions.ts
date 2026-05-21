"use server";

/**
 * Admin server actions for the testing-badge feature.
 *
 *   • `setRfqTestingAction`        — mark / unmark a single RFQ as testing.
 *   • `setHideTestingOpportunitiesAction` — flip the global kill switch that
 *     hides every testing opportunity from the supplier marketplace.
 *
 * Both gate on `requireRole("admin")` and write via the service-role client
 * (RLS-bypassing) exactly like the verifications actions. The DB-level
 * enforcement (RLS policy + `marketplace_opportunities_for_supplier`) means
 * these writes are the single levers; the supplier read paths react to them
 * automatically. See migration 20260521110000_rfq_testing_badge.sql.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import type { ActionState } from "../../verifications/action-state";

const rfqIdSchema = z.string().uuid();
// Checkbox-style forms submit the *desired* next value as the string "true" /
// "false" so a toggle is a single idempotent post (no read-then-flip race).
const boolSchema = z
  .union([z.literal("true"), z.literal("false")])
  .transform((v) => v === "true");

type AdminCtx = {
  adminId: string;
  client: Extract<
    Awaited<ReturnType<typeof requireRole>>,
    { status: "ok" }
  >["admin"];
};

async function requireAdmin(): Promise<AdminCtx | { error: string }> {
  const gate = await requireRole("admin");
  if (gate.status === "unauthenticated") return { error: "Not authenticated." };
  if (gate.status === "forbidden") return { error: "Admin role required." };
  return { adminId: gate.user.id, client: gate.admin };
}

/**
 * Mark or unmark one RFQ as a testing opportunity.
 * Expects form fields: `rfq_id` (uuid) and `is_testing` ("true" | "false").
 */
export async function setRfqTestingAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const idParse = rfqIdSchema.safeParse(formData.get("rfq_id"));
  if (!idParse.success) {
    return { status: "error", message: "Invalid RFQ id." };
  }
  const valueParse = boolSchema.safeParse(formData.get("is_testing"));
  if (!valueParse.success) {
    return { status: "error", message: "Invalid testing value." };
  }
  const rfqId = idParse.data;
  const isTesting = valueParse.data;

  const ctx = await requireAdmin();
  if ("error" in ctx) return { status: "error", message: ctx.error };

  const { error, count } = await ctx.client
    .from("rfqs")
    .update({ is_testing: isTesting }, { count: "exact" })
    .eq("id", rfqId);
  if (error) return { status: "error", message: error.message };
  if ((count ?? 0) === 0) {
    return { status: "error", message: "RFQ not found." };
  }

  revalidatePath("/admin/rfqs");
  revalidatePath(`/admin/rfqs/${rfqId}`);
  // The supplier marketplace listing/detail derive from is_testing.
  revalidatePath("/supplier/opportunities");
  revalidatePath(`/supplier/opportunities/${rfqId}`);

  return {
    status: "success",
    message: isTesting
      ? "Marked as a testing opportunity."
      : "Unmarked — back to a normal opportunity.",
  };
}

/**
 * Flip the global "hide testing opportunities from suppliers" switch.
 * Expects form field: `hide` ("true" | "false").
 */
export async function setHideTestingOpportunitiesAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const valueParse = boolSchema.safeParse(formData.get("hide"));
  if (!valueParse.success) {
    return { status: "error", message: "Invalid value." };
  }
  const hide = valueParse.data;

  const ctx = await requireAdmin();
  if ("error" in ctx) return { status: "error", message: ctx.error };

  const { error } = await ctx.client
    .from("app_settings")
    .update({
      hide_testing_opportunities: hide,
      updated_at: new Date().toISOString(),
      updated_by: ctx.adminId,
    })
    .eq("id", true);
  if (error) return { status: "error", message: error.message };

  revalidatePath("/admin/rfqs");
  revalidatePath("/supplier/opportunities");

  return {
    status: "success",
    message: hide
      ? "Testing opportunities are now hidden from suppliers."
      : "Testing opportunities are now visible to suppliers (badged, last).",
  };
}
