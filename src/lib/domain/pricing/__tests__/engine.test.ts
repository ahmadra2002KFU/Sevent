/**
 * Sprint 4 Lane 1 — composePrice spec tests.
 *
 * These 13 cases mirror `Claude Docs/pricing-examples.md` one-for-one and
 * lock the engine's evaluation order. Every `total_halalas` assertion must
 * match the doc to 0 halalas — drift here means the engine has silently
 * re-priced every quote in production.
 *
 * Additional edge cases at the bottom:
 *   - distance_km null → distance_fee skipped with reason "no_venue_location"
 *   - duration multiplier with fractional factor, stringified in meta
 *   - canonicalize safe-integer guard catches float leakage
 */

import { describe, expect, it } from "vitest";
import { canonicalize } from "@/lib/domain/quote";
import { composePrice, type PricingCtx, type PricingRuleInput } from "../engine";

// -----------------------------------------------------------------------------
// Test fixtures — one place to mint a valid ctx so the 13 cases stay focused
// on the *inputs that differ*, not boilerplate.
// -----------------------------------------------------------------------------

type CtxOverrides = Partial<Omit<PricingCtx, "pkg" | "addons" | "event">> & {
  pkg?: Partial<PricingCtx["pkg"]>;
  addons?: Partial<PricingCtx["addons"]>;
  event?: Partial<PricingCtx["event"]>;
};

function makeCtx(overrides: CtxOverrides): PricingCtx {
  const {
    pkg: pkgOverride,
    addons: addonsOverride,
    event: eventOverride,
    ...rest
  } = overrides;
  return {
    event: {
      id: "evt-1",
      starts_at: "2026-07-15T18:00:00Z",
      ends_at: "2026-07-15T22:00:00Z",
      guest_count: null,
      venue_lat: null,
      venue_lng: null,
      ...eventOverride,
    },
    pkg: {
      id: "pkg-1",
      name: "Test package",
      base_price_halalas: 500_00,
      unit: "event",
      min_qty: 1,
      max_qty: null,
      ...pkgOverride,
    },
    qty: 1,
    rules: [],
    distance_km: null,
    source: "rule_engine",
    // The 13 cases below assert exact total_halalas values straight from
    // pricing-examples.md, which was authored before VAT was switched on.
    // Defaulting to VAT-inclusive here makes total === taxable base, so the
    // existing assertions still hold — the dedicated VAT block below
    // exercises the exclusive-mode math separately.
    prices_include_vat: true,
    addons: {
      setup_fee_halalas: 0,
      teardown_fee_halalas: 0,
      travel_fee_halalas_override: null,
      inclusions: [],
      exclusions: [],
      cancellation_terms: "standard",
      payment_schedule: "deposit",
      deposit_pct: 30,
      notes: null,
      expires_at: null,
      ...addonsOverride,
    },
    ...rest,
  };
}

function rule(
  partial: Omit<PricingRuleInput, "version" | "package_id"> &
    Partial<Pick<PricingRuleInput, "version" | "package_id">>,
): PricingRuleInput {
  return { version: 1, package_id: null, ...partial };
}

// -----------------------------------------------------------------------------
// Cases 1–13 — from Claude Docs/pricing-examples.md
// -----------------------------------------------------------------------------

describe("composePrice — pricing-examples.md (13 deterministic cases)", () => {
  it("Case 1 — Flat per-event package, no rules", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 500_00, unit: "event" },
      qty: 1,
      event: { starts_at: "2026-07-15T18:00:00Z" },
    });
    const { snapshot, applied_rule_ids } = composePrice(ctx);
    expect(snapshot.subtotal_halalas).toBe(500_00);
    expect(snapshot.travel_fee_halalas).toBe(0);
    expect(snapshot.total_halalas).toBe(500_00);
    expect(applied_rule_ids).toEqual([]);
    // Canonicalizes without throwing — proves every number is a safe integer.
    expect(() => canonicalize(snapshot)).not.toThrow();
  });

  it("Case 2 — Per-person catering, all-units qty tier discount (80 guests)", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 150_00, unit: "person" },
      qty: 80,
      event: { starts_at: "2026-05-20T18:00:00Z" },
      rules: [
        rule({
          id: "r-qty",
          rule_type: "qty_tier_all_units",
          priority: 100,
          config: {
            breakpoints: [
              { gte: 50, discount_pct: 15 },
              { gte: 100, discount_pct: 20 },
            ],
          },
        }),
      ],
    });
    const { snapshot, applied_rule_ids } = composePrice(ctx);
    // 80 × 150_00 × 0.85 = 10_200_00
    expect(snapshot.subtotal_halalas).toBe(10_200_00);
    expect(snapshot.total_halalas).toBe(10_200_00);
    expect(applied_rule_ids).toEqual(["r-qty"]);
  });

  it("Case 3 — Per-person catering, incremental qty tier (120 guests)", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 150_00, unit: "person" },
      qty: 120,
      rules: [
        rule({
          id: "r-inc",
          rule_type: "qty_tier_incremental",
          priority: 100,
          config: {
            breakpoints: [
              { from: 1, to: 49, price_halalas: 150_00 },
              { from: 50, to: 99, price_halalas: 135_00 },
              { from: 100, to: null, price_halalas: 120_00 },
            ],
          },
        }),
      ],
    });
    const { snapshot } = composePrice(ctx);
    // 49×150_00 + 50×135_00 + 21×120_00 = 735_000 + 675_000 + 252_000 = 16_620_00
    expect(snapshot.subtotal_halalas).toBe(16_620_00);
  });

  it("Case 4 — Duration multiplier: 7-day rental @ 0.9x (week tier)", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 500_00, unit: "day" },
      qty: 7,
      rules: [
        rule({
          id: "r-dur",
          rule_type: "duration_multiplier",
          priority: 100,
          config: {
            tiers: [
              { applies_from_days: 1, multiplier: 1.0, label: "daily" },
              { applies_from_days: 7, multiplier: 0.9, label: "weekly" },
            ],
          },
        }),
      ],
    });
    const { snapshot, applied_rule_ids } = composePrice(ctx);
    // 7 × 500_00 × 0.9 = 3150_00
    expect(snapshot.subtotal_halalas).toBe(3150_00);
    expect(applied_rule_ids).toContain("r-dur");
    // Fractional multiplier must be stringified in meta so canonicalize
    // accepts the snapshot.
    const durLine = snapshot.line_items.find(
      (li) => li.kind === "duration_multiplier",
    );
    expect(durLine?.meta?.multiplier).toBe("0.9");
    expect(() => canonicalize(snapshot)).not.toThrow();
  });

  it("Case 5 — Date surcharge, named period (Ramadan evening +20%)", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 2000_00, unit: "event" },
      qty: 1,
      event: { starts_at: "2026-03-05T18:00:00Z" },
      rules: [
        rule({
          id: "r-ramadan",
          rule_type: "date_surcharge",
          priority: 100,
          config: {
            scope: "named_period",
            name: "ramadan",
            start: "2026-02-18",
            end: "2026-03-19",
            multiplier: 1.2,
          },
        }),
      ],
    });
    const { snapshot, applied_rule_ids } = composePrice(ctx);
    // 2000_00 × 1.2 = 2400_00
    expect(snapshot.subtotal_halalas).toBe(2400_00);
    expect(applied_rule_ids).toContain("r-ramadan");
  });

  it("Case 6 — Date surcharge precedence: specific_date wins over named_period", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 2000_00, unit: "event" },
      qty: 1,
      event: { starts_at: "2026-03-05T18:00:00Z" },
      rules: [
        rule({
          id: "r-ramadan",
          rule_type: "date_surcharge",
          priority: 100,
          config: {
            scope: "named_period",
            name: "ramadan",
            start: "2026-02-18",
            end: "2026-03-19",
            multiplier: 1.2,
          },
        }),
        rule({
          id: "r-specific",
          rule_type: "date_surcharge",
          priority: 200,
          config: {
            scope: "specific_date",
            date: "2026-03-05",
            flat_addon_halalas: 500_00,
          },
        }),
      ],
    });
    const { snapshot, applied_rule_ids, skipped } = composePrice(ctx);
    // Specific wins (scope precedence beats priority): 2000_00 + 500_00 = 2500_00
    expect(snapshot.subtotal_halalas).toBe(2500_00);
    expect(applied_rule_ids).toContain("r-specific");
    expect(applied_rule_ids).not.toContain("r-ramadan");
    expect(
      skipped.some(
        (s) => s.rule_id === "r-ramadan" && s.reason.startsWith("date_surcharge_lower"),
      ),
    ).toBe(true);
  });

  it("Case 7 — Weekend multiplier when no higher-precedence rule", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 1000_00, unit: "event" },
      qty: 1,
      // 2026-06-13 is a Saturday (UTC day 6).
      event: { starts_at: "2026-06-13T18:00:00Z" },
      rules: [
        rule({
          id: "r-weekend",
          rule_type: "date_surcharge",
          priority: 50,
          config: {
            scope: "weekday",
            days: ["fri", "sat"],
            multiplier: 1.15,
          },
        }),
      ],
    });
    const { snapshot, applied_rule_ids } = composePrice(ctx);
    // 1000_00 × 1.15 = 1150_00
    expect(snapshot.subtotal_halalas).toBe(1150_00);
    expect(applied_rule_ids).toContain("r-weekend");
  });

  it("Case 8 — Travel fee (Distance Matrix, separate line)", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 1500_00, unit: "event" },
      qty: 1,
      event: {
        starts_at: "2026-07-15T18:00:00Z",
        venue_lat: 24.7,
        venue_lng: 46.7,
      },
      distance_km: 35,
      rules: [
        rule({
          id: "r-dist",
          rule_type: "distance_fee",
          priority: 100,
          config: {
            sar_per_km: 3.5,
            free_radius_km: 20,
            min_fee_halalas: 50_00,
          },
        }),
      ],
    });
    const { snapshot, applied_rule_ids } = composePrice(ctx);
    // billable = 35 − 20 = 15; raw = ceil(15 × 3.5 × 100) = 5250;
    // max(5000, 5250) = 5250
    expect(snapshot.subtotal_halalas).toBe(1500_00);
    expect(snapshot.travel_fee_halalas).toBe(52_50);
    expect(snapshot.total_halalas).toBe(1500_00 + 52_50); // 1552_50
    expect(applied_rule_ids).toContain("r-dist");
    // Travel MUST be a separate line item — never absorbed into subtotal.
    expect(
      snapshot.line_items.some((li) => li.kind === "distance_fee"),
    ).toBe(true);
  });

  it("Case 9 — Minimum-fee floor catches aggressive discounts", () => {
    const ctx = makeCtx({
      pkg: {
        base_price_halalas: 100_00,
        unit: "event",
        min_fee_halalas: 200_00,
      },
      qty: 1,
      supplier_discount_pct: 60,
    });
    const { snapshot } = composePrice(ctx);
    // 100_00 × 0.4 = 40_00; floor 200_00 → subtotal = 200_00
    expect(snapshot.subtotal_halalas).toBe(200_00);
    expect(snapshot.total_halalas).toBe(200_00);
  });

  it("Case 10 — Setup + teardown addons (fixed halalas)", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 800_00, unit: "event" },
      qty: 1,
      addons: {
        setup_fee_halalas: 150_00,
        teardown_fee_halalas: 100_00,
      },
    });
    const { snapshot } = composePrice(ctx);
    expect(snapshot.subtotal_halalas).toBe(800_00);
    expect(snapshot.setup_fee_halalas).toBe(150_00);
    expect(snapshot.teardown_fee_halalas).toBe(100_00);
    expect(snapshot.total_halalas).toBe(1050_00); // 800 + 150 + 100 (in SAR)
  });

  it("Case 11 — Rounding: halala output is integer, never a float", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 123_45, unit: "person" },
      qty: 7,
      rules: [
        rule({
          id: "r-q",
          rule_type: "qty_tier_all_units",
          priority: 100,
          config: { breakpoints: [{ gte: 5, discount_pct: 12.5 }] },
        }),
      ],
    });
    const { snapshot } = composePrice(ctx);
    // 7×123_45 = 86_415; ×0.875 = 75_613.125 → round = 75_613
    expect(snapshot.subtotal_halalas).toBe(756_13);
    expect(Number.isInteger(snapshot.subtotal_halalas)).toBe(true);
    expect(Number.isInteger(snapshot.total_halalas)).toBe(true);
    // Every line item total is an integer, too — canonicalize would otherwise throw.
    for (const li of snapshot.line_items) {
      expect(Number.isInteger(li.total_halalas)).toBe(true);
      expect(Number.isInteger(li.unit_price_halalas)).toBe(true);
    }
    expect(() => canonicalize(snapshot)).not.toThrow();
  });

  it("Case 12 — Zero or negative total clamp", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 500_00, unit: "event" },
      qty: 1,
      supplier_discount_pct: 110, // pathological
    });
    const { snapshot } = composePrice(ctx);
    // 500_00 × (1 − 1.1) = −50_00 → clamp to 0
    expect(snapshot.subtotal_halalas).toBe(0);
    expect(snapshot.total_halalas).toBe(0);
  });

  it("Case 13 — VAT exclusive (default): 15% added on top of base", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 1000_00, unit: "event" },
      qty: 1,
      prices_include_vat: false,
    });
    const { snapshot } = composePrice(ctx);
    expect(snapshot.subtotal_halalas).toBe(1000_00);
    expect(snapshot.vat_rate_pct).toBe(15);
    expect(snapshot.vat_amount_halalas).toBe(150_00);
    expect(snapshot.total_halalas).toBe(1150_00);
    expect(snapshot.prices_include_vat).toBe(false);
  });

  it("Case 13b — VAT inclusive: 15% reverse-derived from gross base", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 1150_00, unit: "event" },
      qty: 1,
      prices_include_vat: true,
    });
    const { snapshot } = composePrice(ctx);
    expect(snapshot.subtotal_halalas).toBe(1150_00);
    expect(snapshot.vat_rate_pct).toBe(15);
    // 1150_00 × 15 / 115 = 150_00 — back-derived VAT portion.
    expect(snapshot.vat_amount_halalas).toBe(150_00);
    // Total equals the gross base; VAT is "of which", not added on top.
    expect(snapshot.total_halalas).toBe(1150_00);
    expect(snapshot.prices_include_vat).toBe(true);
  });

  it("Case 13c — VAT exclusive base includes setup + teardown + travel", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 800_00, unit: "event" },
      qty: 1,
      prices_include_vat: false,
      addons: { setup_fee_halalas: 150_00, teardown_fee_halalas: 100_00 },
    });
    const { snapshot } = composePrice(ctx);
    // Base = 800 + 150 + 100 = 1050. VAT 15% = 157.50 → 157_50. Total = 1207_50.
    expect(snapshot.vat_amount_halalas).toBe(157_50);
    expect(snapshot.total_halalas).toBe(1207_50);
  });
});

// -----------------------------------------------------------------------------
// Supplementary edge cases required by Sprint 4 Lane 1 spec.
// -----------------------------------------------------------------------------

describe("composePrice — edge cases beyond pricing-examples.md", () => {
  it("distance_km: null → distance_fee rule skipped with reason 'no_venue_location'", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 1500_00, unit: "event" },
      qty: 1,
      distance_km: null, // unknown venue — no Places Autocomplete
      rules: [
        rule({
          id: "r-dist",
          rule_type: "distance_fee",
          priority: 100,
          config: {
            sar_per_km: 3.5,
            free_radius_km: 20,
            min_fee_halalas: 50_00,
          },
        }),
      ],
    });
    const { snapshot, applied_rule_ids, skipped } = composePrice(ctx);
    expect(snapshot.travel_fee_halalas).toBe(0);
    expect(snapshot.subtotal_halalas).toBe(1500_00);
    expect(snapshot.total_halalas).toBe(1500_00);
    expect(applied_rule_ids).not.toContain("r-dist");
    const skippedDist = skipped.find((s) => s.rule_id === "r-dist");
    expect(skippedDist).toBeDefined();
    expect(skippedDist?.reason).toBe("no_venue_location");
    // Snapshot still canonicalizes cleanly — this is the contract.
    expect(() => canonicalize(snapshot)).not.toThrow();
  });

  it("duration multiplier with fractional factor is stringified in meta", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 1000_00, unit: "day" },
      qty: 3,
      rules: [
        rule({
          id: "r-d",
          rule_type: "duration_multiplier",
          priority: 100,
          config: {
            tiers: [
              { applies_from_days: 1, multiplier: 1.0 },
              { applies_from_days: 3, multiplier: 0.85 }, // non-integer
            ],
          },
        }),
      ],
    });
    const { snapshot } = composePrice(ctx);
    // 3 × 1000_00 × 0.85 = 2550_00
    expect(snapshot.subtotal_halalas).toBe(2550_00);
    const durLine = snapshot.line_items.find(
      (li) => li.kind === "duration_multiplier",
    );
    expect(durLine?.meta?.multiplier).toBe("0.85");
    // If meta.multiplier were a number 0.85 instead of "0.85", canonicalize
    // would throw — the whole point of stringifying.
    expect(() => canonicalize(snapshot)).not.toThrow();
  });

  it("qty tier tie-break: lower `priority` number wins when both rule types match", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 150_00, unit: "person" },
      qty: 80,
      rules: [
        rule({
          id: "r-all",
          rule_type: "qty_tier_all_units",
          priority: 200, // loser
          config: { breakpoints: [{ gte: 50, discount_pct: 10 }] },
        }),
        rule({
          id: "r-inc",
          rule_type: "qty_tier_incremental",
          priority: 100, // lower number → winner
          config: {
            breakpoints: [
              { from: 1, to: 49, price_halalas: 150_00 },
              { from: 50, to: null, price_halalas: 100_00 },
            ],
          },
        }),
      ],
    });
    const { applied_rule_ids, skipped } = composePrice(ctx);
    expect(applied_rule_ids).toContain("r-inc");
    expect(applied_rule_ids).not.toContain("r-all");
    expect(
      skipped.some(
        (s) => s.rule_id === "r-all" && s.reason === "qty_tier_lower_priority",
      ),
    ).toBe(true);
  });

  it("travel fee free-form override bypasses distance_fee rule evaluation", () => {
    const ctx = makeCtx({
      pkg: { base_price_halalas: 1000_00, unit: "event" },
      qty: 1,
      distance_km: 100,
      addons: { travel_fee_halalas_override: 75_00 },
      rules: [
        rule({
          id: "r-dist",
          rule_type: "distance_fee",
          priority: 100,
          config: { sar_per_km: 3.5, free_radius_km: 0, min_fee_halalas: 0 },
        }),
      ],
    });
    const { snapshot, applied_rule_ids, skipped } = composePrice(ctx);
    expect(snapshot.travel_fee_halalas).toBe(75_00);
    expect(applied_rule_ids).not.toContain("r-dist");
    expect(
      skipped.some(
        (s) => s.rule_id === "r-dist" && s.reason === "travel_fee_overridden",
      ),
    ).toBe(true);
  });
});
