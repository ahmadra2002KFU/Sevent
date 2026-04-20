/**
 * Pricing engine — pure function, no I/O.
 *
 * Lane 0 ships signatures + a minimal-valid-snapshot stub so consumers can
 * type-check against the engine while Lane 1 writes the real body. The stub
 * returns an empty snapshot with `source: "free_form"` so tests that depend
 * on a real composition will fail loudly ("no line items") rather than pass
 * silently against a wrong implementation.
 *
 * Evaluation order (locked by `Claude Docs/pricing-examples.md` — Lane 1
 * must preserve it):
 *   1. service subtotal          (qty tier rule wins)
 *   2. duration multiplier
 *   3. date surcharge            (specific_date > named_period > weekday,
 *                                  priority as tiebreak; one winner only)
 *   4. percentage discounts
 *   5. fixed addons
 *   6. minimum-fee floor
 *   7. distance_fee              (separate line — never absorbed into subtotal;
 *                                  skipped when ctx.distance_km is null with
 *                                  reason "no_venue_location")
 *   8. VAT line                  (always written; rate=0 in v1 ZATCA-readiness)
 *   9. total                     (clamp > 0, round once)
 */

import {
  QUOTE_ENGINE_VERSION,
  type QuoteSnapshot,
  type QuoteSource,
} from "@/lib/domain/quote";
import type { PricingRuleType } from "./rules";

/** Package snapshot at the time of quote, as delivered to the engine. */
export type PricingPackageInput = {
  id: string;
  name: string;
  base_price_halalas: number;
  unit: QuoteSnapshot["line_items"][number]["unit"];
  min_qty: number;
  max_qty: number | null;
};

/** Live rule row filtered by the caller to active + valid-date + supplier-scope. */
export type PricingRuleInput = {
  id: string;
  rule_type: PricingRuleType;
  config: unknown; // validated via parsePricingRuleConfig before dispatch
  priority: number;
  version: number;
  package_id: string | null;
};

/** Context passed by the caller. Pure inputs — no network, no DB. */
export type PricingCtx = {
  event: {
    id: string;
    starts_at: string; // ISO-8601
    ends_at: string; // ISO-8601
    guest_count: number | null;
    venue_lat: number | null;
    venue_lng: number | null;
  };
  pkg: PricingPackageInput;
  qty: number;
  rules: PricingRuleInput[];
  /** Distance injected by caller (via distance.ts). `null` means unknown venue. */
  distance_km: number | null;
  source: QuoteSource;
  /** Free-form overrides / addons the supplier typed in the quote builder. */
  addons: {
    setup_fee_halalas: number;
    teardown_fee_halalas: number;
    travel_fee_halalas_override: number | null; // free-form override of computed travel
    inclusions: string[];
    exclusions: string[];
    cancellation_terms: string;
    payment_schedule: string;
    deposit_pct: number;
    notes: string | null;
    expires_at: string | null;
  };
};

export type PricingResult = {
  snapshot: QuoteSnapshot;
  applied_rule_ids: string[];
  skipped: Array<{ rule_id: string; reason: string }>;
};

/**
 * STUB — Lane 1 implements the real evaluation. The stub returns a
 * minimal-valid snapshot (single line item from the package, no rules, no
 * addons) so Lane 0 can typecheck the rest of the codebase against the
 * shape. Any test that exercises real pricing MUST fail against this stub.
 */
export function composePrice(ctx: PricingCtx): PricingResult {
  const line_total = ctx.pkg.base_price_halalas * ctx.qty;
  const snapshot: QuoteSnapshot = {
    engine_version: QUOTE_ENGINE_VERSION,
    currency: "SAR",
    source: ctx.source,
    line_items: [
      {
        kind: "package",
        label: ctx.pkg.name,
        qty: ctx.qty,
        unit: ctx.pkg.unit,
        unit_price_halalas: ctx.pkg.base_price_halalas,
        total_halalas: line_total,
      },
    ],
    subtotal_halalas: line_total,
    travel_fee_halalas: 0,
    setup_fee_halalas: ctx.addons.setup_fee_halalas,
    teardown_fee_halalas: ctx.addons.teardown_fee_halalas,
    vat_rate_pct: 0,
    vat_amount_halalas: 0,
    total_halalas:
      line_total + ctx.addons.setup_fee_halalas + ctx.addons.teardown_fee_halalas,
    deposit_pct: ctx.addons.deposit_pct,
    payment_schedule: ctx.addons.payment_schedule,
    cancellation_terms: ctx.addons.cancellation_terms,
    inclusions: ctx.addons.inclusions,
    exclusions: ctx.addons.exclusions,
    notes: ctx.addons.notes,
    expires_at: ctx.addons.expires_at,
    inputs_digest: "", // caller recomputes via buildRevisionSnapshot
  };
  return {
    snapshot,
    applied_rule_ids: [],
    skipped: ctx.rules.map((r) => ({ rule_id: r.id, reason: "engine_stub" })),
  };
}
