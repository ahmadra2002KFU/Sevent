"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { ACCENT_HEX_VALUES } from "@/lib/domain/taxonomy";

const SECTION_KEYS = ["bio", "packages", "portfolio", "reviews"] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

export type UpdateProfileCustomizationState = {
  ok: boolean;
  code?:
    | "unauthenticated"
    | "forbidden"
    | "no_supplier"
    | "invalid_accent"
    | "invalid_order"
    | "db_error"
    | "unknown";
  message?: string;
};

// Why a dedicated schema instead of reusing onboarding's: the two columns
// customized here are isolated (no cross-field validation with the rest of
// the supplier row), the payload is tiny, and keeping the Zod shape local
// means the action stays readable and the error surface is obvious.
const AccentColorSchema = z
  .string()
  .refine((v) => (ACCENT_HEX_VALUES as readonly string[]).includes(v), {
    message: "Accent color must be one of the curated palette swatches.",
  });

const SectionOrderSchema = z
  .array(z.enum(SECTION_KEYS))
  .length(SECTION_KEYS.length)
  .refine((arr) => new Set(arr).size === arr.length, {
    message: "Section order must not contain duplicates.",
  })
  .refine(
    (arr) => SECTION_KEYS.every((key) => arr.includes(key)),
    { message: "Section order must contain every section exactly once." },
  );

const PayloadSchema = z.object({
  accent_color: AccentColorSchema,
  section_order: SectionOrderSchema,
});

/**
 * Parse `section_order` from the FormData. The client serializes the ordered
 * array as a JSON string under a single key so we don't rely on FormData's
 * repeated-key semantics (which differ between the browser and Next's server
 * action wire format for arrays).
 */
function parseSectionOrder(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function updateProfileCustomizationAction(
  _prev: UpdateProfileCustomizationState | undefined,
  formData: FormData,
): Promise<UpdateProfileCustomizationState> {
  const gate = await requireRole("supplier");
  if (gate.status === "unauthenticated") {
    return { ok: false, code: "unauthenticated" };
  }
  if (gate.status === "forbidden") {
    return { ok: false, code: "forbidden" };
  }
  const { user, admin } = gate;

  const parsed = PayloadSchema.safeParse({
    accent_color: formData.get("accent_color"),
    section_order: parseSectionOrder(formData.get("section_order")),
  });

  if (!parsed.success) {
    const firstPath = parsed.error.issues[0]?.path?.[0];
    const code: UpdateProfileCustomizationState["code"] =
      firstPath === "accent_color" ? "invalid_accent" : "invalid_order";
    return {
      ok: false,
      code,
      message: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }

  const { accent_color, section_order } = parsed.data;

  // Resolve the supplier row first so we can (1) enforce ownership under the
  // service-role client and (2) revalidate the public profile route with the
  // actual slug once the update lands.
  const { data: supplier, error: supplierErr } = await admin
    .from("suppliers")
    .select("id, slug")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (supplierErr) {
    return {
      ok: false,
      code: "db_error",
      message: supplierErr.message,
    };
  }
  if (!supplier) {
    return { ok: false, code: "no_supplier" };
  }

  const supplierRow = supplier as { id: string; slug: string | null };

  const { error: updateErr } = await admin
    .from("suppliers")
    .update({
      accent_color,
      profile_sections_order: section_order satisfies SectionKey[],
    })
    .eq("id", supplierRow.id);

  if (updateErr) {
    return {
      ok: false,
      code: "db_error",
      message: updateErr.message,
    };
  }

  revalidatePath("/supplier/profile");
  revalidatePath("/supplier/dashboard");
  if (supplierRow.slug) {
    // Revalidate the public profile page so the new accent color + section
    // order propagate to unauthenticated visitors on the next render.
    revalidatePath(`/s/${supplierRow.slug}`, "page");
  }

  return { ok: true };
}
