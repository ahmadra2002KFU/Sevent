"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DeclineInput = z.object({
  invite_id: z.string().uuid(),
  decline_reason_code: z.enum(["too_busy", "out_of_area", "price_mismatch", "other"]),
  note: z.string().trim().max(500).optional(),
});

export async function declineInviteAction(formData: FormData): Promise<void> {
  const parsed = DeclineInput.safeParse({
    invite_id: formData.get("invite_id"),
    decline_reason_code: formData.get("decline_reason_code"),
    note: formData.get("note") ?? undefined,
  });

  if (!parsed.success) {
    throw new Error("Invalid decline submission");
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  // Confirm the caller is a supplier and resolve their supplier row. RLS on
  // rfq_invites enforces that the UPDATE only touches rows owned by this
  // supplier, but we guard early in application code for clearer errors.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile as { role: string }).role !== "supplier") {
    throw new Error("Supplier role required");
  }

  const { data: supplierRow } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!supplierRow) {
    throw new Error("Supplier profile not found");
  }

  const supplierId = (supplierRow as { id: string }).id;

  // RLS policy on rfq_invites already restricts updates to rows where
  // supplier_id matches the caller's supplier. We repeat the predicate here
  // as a belt-and-suspenders check.
  const { error } = await supabase
    .from("rfq_invites")
    .update({
      status: "declined",
      responded_at: new Date().toISOString(),
      decline_reason_code: parsed.data.decline_reason_code,
    })
    .eq("id", parsed.data.invite_id)
    .eq("supplier_id", supplierId);

  if (error) {
    throw new Error(`Failed to decline invite: ${error.message}`);
  }

  revalidatePath("/supplier/rfqs");
  redirect("/supplier/rfqs");
}
