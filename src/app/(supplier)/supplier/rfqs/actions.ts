"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

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
  const admin = await createSupabaseServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile as { role: string }).role !== "supplier") {
    throw new Error("Supplier role required");
  }

  const { data: supplierRow } = await admin
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!supplierRow) {
    throw new Error("Supplier profile not found");
  }

  const supplierId = (supplierRow as { id: string }).id;

  // Route the UPDATE through the service-role client. The RLS policies on
  // rfq_invites (organizer-write via events, supplier-self-update) trigger the
  // same rfq_invites ↔ rfqs recursion we hit on the organizer send path.
  // Service-role bypasses policy evaluation entirely; ownership is enforced
  // below by filtering on (id = invite_id AND supplier_id = caller_supplier).
  const { data: updated, error } = await admin
    .from("rfq_invites")
    .update({
      status: "declined",
      responded_at: new Date().toISOString(),
      decline_reason_code: parsed.data.decline_reason_code,
    })
    .eq("id", parsed.data.invite_id)
    .eq("supplier_id", supplierId)
    .select("id, rfq_id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to decline invite: ${error.message}`);
  }

  // Best-effort organizer notification. Failure does not roll back the decline —
  // Sprint 5 builds the full notifications pipeline; this is a minimal stub so
  // the organizer dashboard / notifications list surfaces the signal today.
  if (updated) {
    try {
      const { data: rfqRow } = await admin
        .from("rfqs")
        .select("id, events(id, organizer_id, event_type, city)")
        .eq("id", (updated as { rfq_id: string }).rfq_id)
        .maybeSingle();
      const organizerId = (rfqRow as { events?: { organizer_id?: string } } | null)
        ?.events?.organizer_id;
      if (organizerId) {
        const { data: supplierProfile } = await admin
          .from("suppliers")
          .select("business_name")
          .eq("id", supplierId)
          .maybeSingle();
        const businessName = (supplierProfile as { business_name?: string } | null)
          ?.business_name ?? "A supplier";
        await admin.from("notifications").insert({
          user_id: organizerId,
          kind: "rfq_invite_declined",
          payload_jsonb: {
            rfq_id: (updated as { rfq_id: string }).rfq_id,
            invite_id: parsed.data.invite_id,
            supplier_id: supplierId,
            supplier_business_name: businessName,
            decline_reason_code: parsed.data.decline_reason_code,
            title: `${businessName} declined your RFQ`,
          },
        });
      }
    } catch {
      // Don't block the decline on notification failure.
    }
  }

  revalidatePath("/supplier/rfqs");
  redirect("/supplier/rfqs");
}
