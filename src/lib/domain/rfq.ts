/**
 * Sevent RFQ domain — status unions + discriminated-union Zod schemas for the
 * category-specific `requirements_jsonb` payload on the `rfqs` table.
 *
 * The RFQ wizard (Lane 3) picks the right extension schema based on the chosen
 * subcategory slug; the auto-match engine (Lane 2) uses the parsed requirements
 * (e.g. catering dietary flags) to score/rank suppliers. Keep this module the
 * single source of truth for the extension shapes — do not re-declare them at
 * call sites. Mirrors the `parsePricingRuleConfig` pattern in pricing/rules.ts.
 */

import { z } from "zod";

// =============================================================================
// Status unions (mirror DB enums)
// =============================================================================

export type RfqStatus =
  | "draft"
  | "sent"
  | "quoted"
  | "expired"
  | "booked"
  | "cancelled";

export type RfqInviteStatus = "invited" | "declined" | "quoted" | "withdrawn";

export type RfqInviteSource = "auto_match" | "organizer_picked";

export type ResponseDeadlineHours = 24 | 48 | 72;

// =============================================================================
// Extension kinds (requirements_jsonb payload)
// =============================================================================

export const VenuesExtension = z.object({
  kind: z.literal("venues"),
  seating_style: z.enum(["rounds", "theatre", "classroom", "cocktail", "majlis"]),
  indoor_outdoor: z.enum(["indoor", "outdoor", "either"]),
  needs_parking: z.boolean().default(false),
  needs_kitchen: z.boolean().default(false),
});
export type VenuesExtension = z.infer<typeof VenuesExtension>;

export const CateringExtension = z.object({
  kind: z.literal("catering"),
  meal_type: z.enum(["buffet", "plated", "coffee_break", "cocktail"]),
  dietary: z
    .array(
      z.enum(["halal_only", "vegetarian", "vegan", "gluten_free", "nut_free"]),
    )
    .default(["halal_only"]),
  service_style: z.enum(["self_serve", "served", "mixed"]).default("served"),
});
export type CateringExtension = z.infer<typeof CateringExtension>;

export const PhotographyExtension = z.object({
  kind: z.literal("photography"),
  coverage_hours: z.coerce.number().int().min(1).max(24),
  deliverables: z
    .array(
      z.enum(["photos", "video", "drone", "same_day_edit", "printed_album"]),
    )
    .min(1),
  crew_size: z.coerce.number().int().min(1).max(10).default(1),
});
export type PhotographyExtension = z.infer<typeof PhotographyExtension>;

export const GenericExtension = z.object({
  kind: z.literal("generic"),
  notes: z.string().trim().max(2000),
});
export type GenericExtension = z.infer<typeof GenericExtension>;

export const RfqExtension = z.discriminatedUnion("kind", [
  VenuesExtension,
  CateringExtension,
  PhotographyExtension,
  GenericExtension,
]);
export type RfqExtension = z.infer<typeof RfqExtension>;

export type RfqExtensionKind = RfqExtension["kind"];

// =============================================================================
// Form schema
// =============================================================================

export const RfqFormInput = z.object({
  event_id: z.string().uuid(),
  category_id: z.string().uuid(),
  subcategory_id: z.string().uuid(),
  requirements: RfqExtension,
  response_deadline_hours: z
    .union([z.literal(24), z.literal(48), z.literal(72)])
    .default(24),
});
export type RfqFormInput = z.infer<typeof RfqFormInput>;

// =============================================================================
// parseRfqExtension — discriminated-union-safe parser by kind
// =============================================================================

type ExtensionByKind = {
  venues: VenuesExtension;
  catering: CateringExtension;
  photography: PhotographyExtension;
  generic: GenericExtension;
};

const SCHEMA_BY_KIND = {
  venues: VenuesExtension,
  catering: CateringExtension,
  photography: PhotographyExtension,
  generic: GenericExtension,
} satisfies Record<RfqExtensionKind, z.ZodTypeAny>;

/**
 * Picks the right extension schema by `kind` and parses the provided payload.
 * Throws a `ZodError` if the payload does not match, mirroring
 * `parsePricingRuleConfig` from `src/lib/domain/pricing/rules.ts`.
 */
export function parseRfqExtension<K extends RfqExtensionKind>(
  kind: K,
  value: unknown,
): ExtensionByKind[K] {
  const schema = SCHEMA_BY_KIND[kind];
  if (!schema) {
    throw new Error(`unknown rfq extension kind: ${kind}`);
  }
  return schema.parse(value) as ExtensionByKind[K];
}
