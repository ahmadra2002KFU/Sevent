/**
 * Zod schemas for the 3-step supplier onboarding wizard.
 * Consumed by Lane 1 (`(supplier)/supplier/onboarding/**`) server actions and
 * by the service-role seed script (scripts/seed-users.ts).
 *
 * 2026-04-21 pass: extended with
 *   - `works_with_segments` (>=1 of the 5 market-segment slugs)
 *   - `base_city` / `service_area_cities` narrowed to the frozen KSA slug set
 *   - logo / IBAN / company-profile file upload fields (validated at the
 *     server-action boundary where real `File`/`Blob` instances are available)
 *   - `legal_type` stays on Step 1 but is now driven by a soft Person/Company
 *     tile picker in the UI (no DB enforcement change).
 */

import { z } from "zod";
import { CITY_SLUGS } from "./cities";
import { MARKET_SEGMENT_SLUGS } from "./segments";

export const LEGAL_TYPES = ["company", "freelancer", "foreign"] as const;
export type LegalType = (typeof LEGAL_TYPES)[number];

export const LANGUAGES = ["ar", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const DOC_TYPES = [
  "cr",
  "vat",
  "id",
  "gea_permit",
  "certification",
  "iban_certificate",
  "company_profile",
  "national_address",
  "other",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

// -----------------------------------------------------------------------------
// Shared tuples (see src/lib/domain/events.ts for the same pattern — zod needs
// a non-empty readonly tuple type for `z.enum`, not a plain string[]).
// -----------------------------------------------------------------------------

const CITY_TUPLE = CITY_SLUGS as unknown as readonly [string, ...string[]];
const SEGMENT_TUPLE = MARKET_SEGMENT_SLUGS as unknown as readonly [
  (typeof MARKET_SEGMENT_SLUGS)[number],
  ...(typeof MARKET_SEGMENT_SLUGS)[number][],
];

// Runtime-safe File/Blob check that survives SSR. `File` is only defined in
// the browser and in modern Node (>=20); guard with `typeof` so Zod schema
// compilation in edge cases doesn't throw on import.
const FileLike = z.custom<File | Blob>(
  (val) => {
    if (val == null) return false;
    if (typeof Blob !== "undefined" && val instanceof Blob) return true;
    if (typeof File !== "undefined" && val instanceof File) return true;
    return false;
  },
  { message: "Expected an uploaded file" },
);

// -----------------------------------------------------------------------------
// Step 1 — business info
// -----------------------------------------------------------------------------

export const OnboardingStep1 = z
  .object({
    representative_name: z.string().trim().min(2).max(120),
    business_name: z.string().trim().min(2).max(120),
    legal_type: z.enum(LEGAL_TYPES),
    cr_number: z.string().trim().optional(),
    national_id: z.string().trim().optional(),
    bio: z.string().trim().max(2000).optional(),
    base_city: z.enum(CITY_TUPLE),
    serves_all_ksa: z.boolean().default(false),
    service_area_cities: z
      .array(z.enum(CITY_TUPLE))
      .max(15, "Select at most 15 service-area cities")
      .default([]),
    languages: z.array(z.enum(LANGUAGES)).min(1).default(["ar"]),
  })
  .superRefine((data, ctx) => {
    if (data.legal_type === "company" && !data.cr_number) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cr_number"],
        message: "Commercial registration number is required for companies",
      });
    }
    if (data.legal_type === "freelancer" && !data.national_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["national_id"],
        message: "National ID is required for freelancers",
      });
    }
    // Serves-all-KSA supersedes the city picker. Enforce mutual exclusivity so
    // "I serve every city plus Riyadh" can't sneak in through a stale client.
    if (data.serves_all_ksa && data.service_area_cities.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["service_area_cities"],
        message:
          "Clear the city list before enabling 'serves all KSA'",
      });
    }
  });
export type OnboardingStep1 = z.infer<typeof OnboardingStep1>;

// -----------------------------------------------------------------------------
// Step 2 — categories + works-with segments
// -----------------------------------------------------------------------------

export const OnboardingStep2 = z.object({
  subcategory_ids: z
    .array(z.string().uuid())
    .min(1, "Pick at least one service"),
  works_with_segments: z
    .array(z.enum(SEGMENT_TUPLE))
    .min(1, "Pick at least one market segment"),
});
export type OnboardingStep2 = z.infer<typeof OnboardingStep2>;

// -----------------------------------------------------------------------------
// Step 3 — documents + profile assets
// -----------------------------------------------------------------------------

export const LOGO_MAX_BYTES = 1 * 1024 * 1024; // 1 MB
export const PDF_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const OnboardingStep3 = z
  .object({
    logo_file: FileLike.optional(),
    iban_file: FileLike,
    company_profile_file: FileLike.optional(),
    // Company-only docs. Enforced below via superRefine so freelancers can
    // still submit step 3 without them.
    legal_type: z.enum(LEGAL_TYPES).optional(),
    cr_file: FileLike.optional(),
    national_address_file: FileLike.optional(),
    vat_file: FileLike.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.legal_type === "company") {
      if (!data.cr_file) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cr_file"],
          message: "Commercial registration certificate (PDF) is required",
        });
      }
      if (!data.national_address_file) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["national_address_file"],
          message: "National address certificate (PDF) is required",
        });
      }
      if (!data.vat_file) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["vat_file"],
          message: "Tax / VAT certificate (PDF) is required",
        });
      }
    }
  });
export type OnboardingStep3 = z.infer<typeof OnboardingStep3>;

// -----------------------------------------------------------------------------
// Legacy metadata schema kept for scripts/seed-users.ts which pre-staged
// document rows without going through the wizard. Unchanged shape.
// -----------------------------------------------------------------------------

export const DocUploadItem = z.object({
  doc_type: z.enum(DOC_TYPES),
  file_path: z.string().min(1), // must be `{supplier_id}/...` per storage convention
  notes: z.string().max(500).optional(),
});
export type DocUploadItem = z.infer<typeof DocUploadItem>;

/** Slugify a business name for `suppliers.slug`. */
export function slugifyBusinessName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
