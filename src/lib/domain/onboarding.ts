/**
 * Zod schemas for the 3-step supplier onboarding wizard.
 * Consumed by Lane 1 (`(supplier)/supplier/onboarding/**`) server actions and
 * by the service-role seed script (scripts/seed-users.ts).
 */

import { z } from "zod";

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
  "other",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

// -----------------------------------------------------------------------------
// Step 1 — business info
// -----------------------------------------------------------------------------

export const OnboardingStep1 = z
  .object({
    business_name: z.string().trim().min(2).max(120),
    legal_type: z.enum(LEGAL_TYPES),
    cr_number: z.string().trim().optional(),
    national_id: z.string().trim().optional(),
    bio: z.string().trim().max(2000).optional(),
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
  });
export type OnboardingStep1 = z.infer<typeof OnboardingStep1>;

// -----------------------------------------------------------------------------
// Step 2 — docs upload (metadata only; actual upload happens via storage helper)
// -----------------------------------------------------------------------------

export const DocUploadItem = z.object({
  doc_type: z.enum(DOC_TYPES),
  file_path: z.string().min(1), // must be `{supplier_id}/...` per storage convention
  notes: z.string().max(500).optional(),
});
export type DocUploadItem = z.infer<typeof DocUploadItem>;

export const OnboardingStep2 = z.object({
  docs: z.array(DocUploadItem).min(1, "Upload at least one document"),
});
export type OnboardingStep2 = z.infer<typeof OnboardingStep2>;

// -----------------------------------------------------------------------------
// Step 3 — location, service area, capacity
// -----------------------------------------------------------------------------

export const OnboardingStep3 = z.object({
  base_city: z.string().trim().min(2).max(80),
  base_location: z
    .object({
      lat: z.number().gte(-90).lte(90),
      lng: z.number().gte(-180).lte(180),
    })
    .optional(),
  service_area_cities: z.array(z.string().trim().min(2)).min(1),
  languages: z.array(z.enum(LANGUAGES)).min(1),
  capacity: z.number().int().positive().optional(),
  concurrent_event_limit: z.number().int().min(1).default(1),
  category_ids: z.array(z.string().uuid()).min(1),
  subcategory_ids: z.array(z.string().uuid()).min(1),
});
export type OnboardingStep3 = z.infer<typeof OnboardingStep3>;

// -----------------------------------------------------------------------------
// Submission bundle (server-side finalise)
// -----------------------------------------------------------------------------

export const OnboardingSubmission = z.object({
  step1: OnboardingStep1,
  step2: OnboardingStep2,
  step3: OnboardingStep3,
});
export type OnboardingSubmission = z.infer<typeof OnboardingSubmission>;

/** Slugify a business name for `suppliers.slug`. */
export function slugifyBusinessName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
