"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/access";
import { setActiveCompanyCookie } from "@/lib/auth/activeCompany";

/**
 * Server-action errors are stable codes that map to
 * `organizer.onboarding.company.errors.<code>` in the message catalogs.
 * Never return raw Zod messages — those bypass our i18n + leak EN literals
 * into AR pages.
 */
export type CreateCompanyErrorCode =
  | "nameRequired"
  | "nameTooLong"
  | "slugRequired"
  | "slugInvalid"
  | "slugTaken"
  | "crInvalid"
  | "vatInvalid"
  | "billingEmailRequired"
  | "billingEmailInvalid"
  | "createFailed";

export type CreateCompanyState =
  | { status: "idle" }
  | { status: "error"; code: CreateCompanyErrorCode };

const trimToNull = (v: unknown) =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

const InputSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(120, "nameTooLong"),
  name_ar: z.preprocess(trimToNull, z.string().max(120).nullable()),
  // Slug constraints mirror the supplier-side convention: lowercase ASCII,
  // digits, hyphens; 3-64 chars; no leading/trailing/double hyphens.
  slug: z
    .string()
    .trim()
    .min(1, "slugRequired")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slugInvalid")
    .min(3, "slugInvalid")
    .max(64, "slugInvalid"),
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
});

function firstErrorCode(err: z.ZodError): CreateCompanyErrorCode {
  const first = err.issues[0];
  const raw = first?.message ?? "createFailed";
  return raw as CreateCompanyErrorCode;
}

export async function createCompanyAction(
  _prev: CreateCompanyState | undefined,
  formData: FormData,
): Promise<CreateCompanyState> {
  const { user, admin } = await requireAccess("organizer.onboarding");

  const parsed = InputSchema.safeParse({
    name: formData.get("name") ?? "",
    name_ar: formData.get("name_ar"),
    slug: formData.get("slug") ?? "",
    cr_number: formData.get("cr_number"),
    vat_number: formData.get("vat_number"),
    billing_email: formData.get("billing_email") ?? "",
    default_language: formData.get("default_language") ?? "en",
  });
  if (!parsed.success) {
    return { status: "error", code: firstErrorCode(parsed.error) };
  }

  const {
    name,
    name_ar,
    slug,
    cr_number,
    vat_number,
    billing_email,
    default_language,
  } = parsed.data;

  const { data: rpcData, error } = await admin.rpc(
    "create_organizer_company_tx",
    {
      p_creator_id: user.id,
      p_name: name,
      p_name_ar: name_ar,
      p_slug: slug,
      p_cr_number: cr_number,
      p_vat_number: vat_number,
      p_billing_email: billing_email,
      p_default_language: default_language,
    },
  );

  if (error) {
    // P0040 = slug taken (raised by create_organizer_company_tx on
    // unique_violation). Anything else is logged for ops and surfaced as a
    // generic create-failed.
    if ((error as { code?: string }).code === "P0040") {
      return { status: "error", code: "slugTaken" };
    }
    console.error("[createCompanyAction] RPC failed", {
      code: (error as { code?: string }).code ?? null,
      message: error.message,
    });
    return { status: "error", code: "createFailed" };
  }

  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const companyId = (row as { out_company_id?: string } | null)?.out_company_id;
  if (!companyId) {
    return { status: "error", code: "createFailed" };
  }

  // Persist the active-company cookie so subsequent navigation doesn't fall
  // through to the auto-resolve branch. The RPC already wrote
  // profiles.last_active_company_id, but the cookie is the resolver's
  // primary fast-path signal.
  await setActiveCompanyCookie(companyId);

  // ?welcome=1 triggers the one-time celebration banner on the dashboard so
  // company creation lands on an explicit success state rather than a silent
  // redirect.
  redirect("/organizer/dashboard?welcome=1");
}
