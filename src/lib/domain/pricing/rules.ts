/**
 * Sevent pricing-rule configs — one Zod schema per `pricing_rule_type`.
 * Aligned to Claude Docs/pricing-examples.md. The Sprint 4 pricing engine and
 * the Sprint 2 rules-CRUD form MUST both go through `parsePricingRuleConfig`.
 *
 * The engine evaluation order lives in Claude Docs/state-machines.md +
 * pricing-examples.md; these schemas describe *storage shape* only.
 */

import { z } from "zod";

// =============================================================================
// Shared fragments
// =============================================================================

const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().nonnegative();
const percent0to100 = z.number().min(0).max(100);
const percentMultiplier = z.number().min(0).max(5); // 0.0 – 5.0 (e.g. 1.15 for +15%)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

// =============================================================================
// qty_tier_all_units — one matched breakpoint applies its discount to every unit.
// =============================================================================

export const QtyTierAllUnitsConfig = z.object({
  breakpoints: z
    .array(
      z.object({
        gte: positiveInt,
        discount_pct: percent0to100,
      }),
    )
    .min(1)
    .refine(
      (arr) => arr.every((b, i) => i === 0 || arr[i - 1].gte < b.gte),
      { message: "breakpoints.gte must be strictly ascending" },
    ),
});
export type QtyTierAllUnitsConfig = z.infer<typeof QtyTierAllUnitsConfig>;

// =============================================================================
// qty_tier_incremental — each tier has its own per-unit price.
// =============================================================================

export const QtyTierIncrementalConfig = z.object({
  breakpoints: z
    .array(
      z.object({
        from: positiveInt,
        to: positiveInt.nullable(), // null = open-ended top tier
        price_halalas: nonNegativeInt,
      }),
    )
    .min(1)
    .refine(
      (arr) =>
        arr.every(
          (b, i) =>
            (b.to === null || b.from <= b.to) &&
            (i === 0 || arr[i - 1].to !== null && (arr[i - 1].to as number) + 1 === b.from),
        ),
      { message: "incremental tiers must be contiguous with from/to boundaries" },
    ),
});
export type QtyTierIncrementalConfig = z.infer<typeof QtyTierIncrementalConfig>;

// =============================================================================
// distance_fee — per-km travel fee kept as a separate quote line.
// =============================================================================

export const DistanceFeeConfig = z.object({
  sar_per_km: z.number().nonnegative(),
  free_radius_km: z.number().nonnegative().default(0),
  min_fee_halalas: nonNegativeInt.default(0),
  max_fee_halalas: nonNegativeInt.optional(),
});
export type DistanceFeeConfig = z.infer<typeof DistanceFeeConfig>;

// =============================================================================
// date_surcharge — precedence: specific_date > named_period > weekday/weekend.
// Only ONE date surcharge wins per event date (highest priority if multiple).
// =============================================================================

const WeekdayFlag = z.enum([
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
]);

export const DateSurchargeConfig = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("specific_date"),
    date: isoDate,
    multiplier: percentMultiplier.optional(),
    flat_addon_halalas: nonNegativeInt.optional(),
  }),
  z.object({
    scope: z.literal("named_period"),
    name: z.string().min(1),
    start: isoDate,
    end: isoDate,
    multiplier: percentMultiplier.optional(),
    flat_addon_halalas: nonNegativeInt.optional(),
  }),
  z.object({
    scope: z.literal("weekday"),
    days: z.array(WeekdayFlag).min(1),
    multiplier: percentMultiplier.optional(),
    flat_addon_halalas: nonNegativeInt.optional(),
  }),
]);
export type DateSurchargeConfig = z.infer<typeof DateSurchargeConfig>;

// =============================================================================
// duration_multiplier — rental-style multipliers; applied to service subtotal.
// =============================================================================

export const DurationMultiplierConfig = z.object({
  tiers: z
    .array(
      z.object({
        applies_from_days: positiveInt,
        multiplier: percentMultiplier,
        label: z.string().min(1).optional(),
      }),
    )
    .min(1)
    .refine(
      (arr) =>
        arr.every((t, i) => i === 0 || arr[i - 1].applies_from_days < t.applies_from_days),
      { message: "tiers.applies_from_days must be strictly ascending" },
    ),
  daily_cap_halalas: nonNegativeInt.optional(),
});
export type DurationMultiplierConfig = z.infer<typeof DurationMultiplierConfig>;

// =============================================================================
// Discriminated dispatch — parse a config blob by its `rule_type`.
// =============================================================================

export const PRICING_RULE_TYPES = [
  "qty_tier_all_units",
  "qty_tier_incremental",
  "distance_fee",
  "date_surcharge",
  "duration_multiplier",
] as const;
export type PricingRuleType = (typeof PRICING_RULE_TYPES)[number];

type ConfigByType = {
  qty_tier_all_units: QtyTierAllUnitsConfig;
  qty_tier_incremental: QtyTierIncrementalConfig;
  distance_fee: DistanceFeeConfig;
  date_surcharge: DateSurchargeConfig;
  duration_multiplier: DurationMultiplierConfig;
};

const SCHEMA_BY_TYPE = {
  qty_tier_all_units: QtyTierAllUnitsConfig,
  qty_tier_incremental: QtyTierIncrementalConfig,
  distance_fee: DistanceFeeConfig,
  date_surcharge: DateSurchargeConfig,
  duration_multiplier: DurationMultiplierConfig,
} satisfies Record<PricingRuleType, z.ZodTypeAny>;

export function parsePricingRuleConfig<T extends PricingRuleType>(
  rule_type: T,
  config: unknown,
): ConfigByType[T] {
  const schema = SCHEMA_BY_TYPE[rule_type];
  if (!schema) {
    throw new Error(`unknown pricing_rule_type: ${rule_type}`);
  }
  return schema.parse(config) as ConfigByType[T];
}

export type PricingRuleSafeParse<T extends PricingRuleType> =
  | { success: true; data: ConfigByType[T] }
  | { success: false; error: z.ZodError };

export function safeParsePricingRuleConfig<T extends PricingRuleType>(
  rule_type: T,
  config: unknown,
): PricingRuleSafeParse<T> {
  const schema = SCHEMA_BY_TYPE[rule_type];
  const result = schema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data as ConfigByType[T] };
  }
  return { success: false, error: result.error };
}

/** Row-level shape used by CRUD forms + DB writes. */
export const PricingRuleRow = z.object({
  id: z.string().uuid().optional(),
  supplier_id: z.string().uuid(),
  package_id: z.string().uuid().nullable(),
  rule_type: z.enum(PRICING_RULE_TYPES),
  config_jsonb: z.unknown(), // validated by parsePricingRuleConfig against rule_type
  priority: z.number().int().default(100),
  version: z.number().int().positive().default(1),
  is_active: z.boolean().default(true),
  valid_from: isoDate.nullable().optional(),
  valid_to: isoDate.nullable().optional(),
  currency: z.literal("SAR").default("SAR"),
});
export type PricingRuleRow = z.infer<typeof PricingRuleRow>;
