"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { uniqueSupplierSlug } from "@/lib/onboarding/slug";

const InputSchema = z.object({
  legal_type: z.enum(["freelancer", "company"]),
});

export type SetLegalTypeResult = { ok: boolean; message?: string };

/**
 * Persists the supplier's chosen legal path (freelancer vs company) ahead of
 * the 3-step wizard. If a `suppliers` row doesn't yet exist for the caller we
 * create a minimal shell so subsequent wizard steps can UPDATE it — this
 * avoids an unnecessary migration to add a "just legal_type" scratch table.
 *
 * Ownership is enforced via `requireRole("supplier")` and the `profile_id`
 * filter on the admin-client write.
 */
export async function setLegalTypeAction(
  input: { legal_type: "freelancer" | "company" },
): Promise<SetLegalTypeResult> {
  const gate = await requireRole("supplier");
  if (gate.status === "unauthenticated") {
    return { ok: false, message: "Not authenticated" };
  }
  if (gate.status === "forbidden") {
    return { ok: false, message: "Only supplier accounts can complete onboarding" };
  }

  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { user, admin } = gate;
  const legalType = parsed.data.legal_type;

  const { data: existing, error: lookupErr } = await admin
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (lookupErr) return { ok: false, message: lookupErr.message };

  if (existing) {
    const { error } = await admin
      .from("suppliers")
      .update({ legal_type: legalType })
      .eq("id", existing.id);
    if (error) return { ok: false, message: error.message };
  } else {
    // Freshly signed-up supplier with no suppliers row yet — stamp a minimal
    // shell. We pick a unique slug off the user id prefix; step 1 will later
    // rewrite both `slug` and `business_name` once the real name is known.
    const placeholderName = `Supplier ${user.id.slice(0, 8)}`;
    const slug = await uniqueSupplierSlug(admin, placeholderName);
    const { error } = await admin.from("suppliers").insert({
      profile_id: user.id,
      business_name: "",
      slug,
      legal_type: legalType,
      base_city: "riyadh",
      service_area_cities: [],
      languages: ["ar"],
      verification_status: "pending",
      is_published: false,
    });
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/supplier/onboarding");
  revalidatePath("/supplier/onboarding/path");
  return { ok: true };
}
