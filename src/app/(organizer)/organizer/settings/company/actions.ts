"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/access";

/**
 * Stable error codes that map to `organizer.settings.company.errors.<code>`
 * in the message catalogs. The form renders the translated message; raw
 * Postgres messages never reach the user.
 */
export type UpdateCompanyErrorCode =
  | "notAdmin"
  | "notOwner"
  | "companyMissing"
  | "nameRequired"
  | "nameTooLong"
  | "crInvalid"
  | "vatInvalid"
  | "billingEmailRequired"
  | "billingEmailInvalid"
  | "thresholdInvalid"
  | "updateFailed";

export type UpdateCompanyState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; code: UpdateCompanyErrorCode };

const trimToNull = (v: unknown) =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

const InputSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(120, "nameTooLong"),
  name_ar: z.preprocess(trimToNull, z.string().max(120).nullable()),
  cr_number: z.preprocess(
    trimToNull,
    z
      .string()
      .regex(/^\d{10}$/, "crInvalid")
      .nullable(),
  ),
  vat_number: z.preprocess(
    trimToNull,
    z
      .string()
      .regex(/^3\d{14}$/, "vatInvalid")
      .nullable(),
  ),
  billing_email: z
    .string()
    .trim()
    .min(1, "billingEmailRequired")
    .email("billingEmailInvalid")
    .max(255, "billingEmailInvalid"),
  default_language: z.enum(["en", "ar"]),
  /**
   * Member spend cap, entered in whole SAR. Empty string → null → unlimited.
   * Stored as halalas. Capped at 100,000,000 SAR so a typo can't overflow the
   * bigint column or produce a nonsense limit.
   */
  quote_acceptance_threshold_sar: z.preprocess(
    (v) => {
      if (typeof v !== "string" || v.trim().length === 0) return null;
      const n = Number(v.trim().replace(/,/g, ""));
      return Number.isFinite(n) ? n : Number.NaN;
    },
    z
      .number({ error: "thresholdInvalid" })
      .int("thresholdInvalid")
      .min(0, "thresholdInvalid")
      .max(100_000_000, "thresholdInvalid")
      .nullable(),
  ),
});

function firstErrorCode(err: z.ZodError): UpdateCompanyErrorCode {
  return (err.issues[0]?.message ?? "updateFailed") as UpdateCompanyErrorCode;
}

/**
 * Persist company-profile edits via update_organizer_company_tx. Logo path
 * is currently sourced from the existing row (no upload UI in PR 4); the
 * RPC accepts a logo_path arg so we forward whatever we already had — the
 * RPC writes it back so the round-trip is a no-op for that field.
 */
export async function updateCompanyAction(
  _prev: UpdateCompanyState | undefined,
  formData: FormData,
): Promise<UpdateCompanyState> {
  const { user, admin, decision } = await requireAccess("organizer.settings");
  const companyId = decision.activeCompanyId;

  if (!companyId) {
    return { status: "error", code: "companyMissing" };
  }
  if (decision.companyRole !== "owner" && decision.companyRole !== "admin") {
    return { status: "error", code: "notAdmin" };
  }

  // Only the owner may move the member spend cap (RPC enforces this too via
  // P0062). Admins submit the form without the field, so we must not send
  // p_update_threshold=true for them — that would clear the owner's cap.
  const isOwner = decision.companyRole === "owner";

  const parsed = InputSchema.safeParse({
    name: formData.get("name") ?? "",
    name_ar: formData.get("name_ar"),
    cr_number: formData.get("cr_number"),
    vat_number: formData.get("vat_number"),
    billing_email: formData.get("billing_email") ?? "",
    default_language: formData.get("default_language") ?? "en",
    quote_acceptance_threshold_sar: isOwner
      ? formData.get("quote_acceptance_threshold_sar")
      : null,
  });
  if (!parsed.success) {
    return { status: "error", code: firstErrorCode(parsed.error) };
  }

  const {
    name,
    name_ar,
    cr_number,
    vat_number,
    billing_email,
    default_language,
    quote_acceptance_threshold_sar,
  } = parsed.data;

  // Read the existing logo_path so the RPC's `set logo_path = p_logo_path`
  // doesn't accidentally null it out. Logo upload UI lands in a later PR.
  const { data: existing } = await admin
    .from("organizer_companies")
    .select("logo_path")
    .eq("id", companyId)
    .maybeSingle();
  const logo_path =
    (existing as { logo_path?: string | null } | null)?.logo_path ?? null;

  const { error } = await admin.rpc("update_organizer_company_tx", {
    p_company_id: companyId,
    p_actor_profile_id: user.id,
    p_name: name,
    p_name_ar: name_ar,
    p_cr_number: cr_number,
    p_vat_number: vat_number,
    p_billing_email: billing_email,
    p_default_language: default_language,
    p_logo_path: logo_path,
    // SAR → halalas. null means "no cap"; the flag below is what tells the
    // RPC to write it at all, since null is a meaningful value.
    p_quote_acceptance_threshold_halalas:
      quote_acceptance_threshold_sar === null
        ? null
        : quote_acceptance_threshold_sar * 100,
    p_update_threshold: isOwner,
  });

  if (error) {
    if ((error as { code?: string }).code === "P0051") {
      return { status: "error", code: "notAdmin" };
    }
    if ((error as { code?: string }).code === "P0062") {
      return { status: "error", code: "notOwner" };
    }
    console.error("[updateCompanyAction] RPC failed", {
      code: (error as { code?: string }).code ?? null,
      message: error.message,
    });
    return { status: "error", code: "updateFailed" };
  }

  // Bust the RSC cache for the form + any place that surfaces the company
  // name (dashboard header, supplier-facing email payloads built fresh
  // each time).
  revalidatePath("/organizer/settings/company");
  revalidatePath("/organizer/dashboard");
  return { status: "success" };
}
