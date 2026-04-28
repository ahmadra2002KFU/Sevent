/**
 * Pricing engine — pure function, no I/O.
 *
 * Sprint 4 Lane 1: real implementation of `composePrice`. Matches the 13
 * deterministic cases in `Claude Docs/pricing-examples.md` to 0 halalas.
 *
 * Evaluation order (locked by `Claude Docs/pricing-examples.md` — DO NOT
 * reorder these steps; every case in the doc depends on exact sequencing):
 *   1. service subtotal          (qty tier rule wins: if both all_units and
 *                                  incremental match, lower `priority` wins)
 *   2. duration multiplier       (fractional multiplier stringified in meta —
 *                                  canonicalize rejects non-integer numbers)
 *   3. date surcharge            (specific_date > named_period > weekday/
 *                                  weekend; tiebreak by priority ASC; exactly
 *                                  one winner — never stacked)
 *   4. percentage discounts      (supplier-level — applied to service subtotal
 *                                  only, never to travel)
 *   5. fixed addons              (setup_fee, teardown_fee from ctx.addons —
 *                                  outside subtotal, inside total)
 *   6. minimum-fee floor         (per-package clamp; bumps service up)
 *   7. distance_fee              (ALWAYS a separate line_item — never absorbed
 *                                  into subtotal. When ctx.distance_km is null
 *                                  the rule is skipped with reason
 *                                  "no_venue_location" but the engine still
 *                                  returns a valid snapshot with travel = 0)
 *   8. VAT line                  (ZATCA standard 15% on the full taxable base
 *                                  = subtotal + setup + teardown + travel.
 *                                  When ctx.prices_include_vat is true, the
 *                                  supplier's entered prices are gross and we
 *                                  reverse-derive VAT from the base; otherwise
 *                                  VAT is added on top.)
 *   9. total                     (exclusive mode: base + vat. inclusive mode:
 *                                  base (vat already inside). clamp >= 0; single
 *                                  Math.round at the end for subtotal so floats
 *                                  like 12.5% discount round once — never per-line)
 *
 * Invariants:
 * - Pure function; no Date.now(), no Math.random. Same ctx → same output.
 * - Every persisted monetary number is an integer `Halalas` (canonicalize
 *   throws on floats; multipliers stringified in meta).
 * - Travel is always reported on `snapshot.travel_fee_halalas` and as a
 *   dedicated line_item; never rolled into subtotal.
 */

import {
  QUOTE_ENGINE_VERSION,
  type QuoteLineItem,
  type QuoteSnapshot,
  type QuoteSource,
  type QuoteUnit,
} from "@/lib/domain/quote";
import { parsePricingRuleConfig, type PricingRuleType } from "./rules";

/** Saudi ZATCA standard VAT rate. */
export const VAT_RATE_PCT = 15;

/** Package snapshot at the time of quote, as delivered to the engine. */
export type PricingPackageInput = {
  id: string;
  name: string;
  base_price_halalas: number;
  unit: QuoteUnit;
  min_qty: number;
  max_qty: number | null;
  /** Optional per-package minimum-fee floor. Applied in step 6. */
  min_fee_halalas?: number | null;
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
  /**
   * Supplier-level percentage discount applied to service subtotal (never to
   * travel). Percent as 0–100 number (e.g. 15 for 15%). v1 has no Zod schema
   * for a "percentage_discount" rule type — this lives on the ctx until a
   * future rule type replaces it. Null/undefined means no discount.
   */
  supplier_discount_pct?: number | null;
  /**
   * Whether the supplier-entered prices already include VAT (true) or are
   * net of VAT (false / undefined → defaults to false). Drives step 8: in
   * inclusive mode we reverse-derive VAT from the gross base and the total
   * equals the base; in exclusive mode VAT is added on top.
   */
  prices_include_vat?: boolean;
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

// =============================================================================
// Helpers
// =============================================================================

/** Extract calendar-day YYYY-MM-DD from ISO-8601; parses reliably via Date. */
function extractIsoDate(iso: string): string {
  // Trust well-formed ISO input (Zod validation upstream). First 10 chars are
  // the date portion regardless of timezone suffix — we need the *local* date
  // of the event as typed, not a UTC-converted one.
  return iso.slice(0, 10);
}

/** Weekday key for comparison against `date_surcharge.weekday.days`. */
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
function isoDateToWeekdayKey(isoDate: string): (typeof WEEKDAY_KEYS)[number] {
  // Parse as UTC midnight to avoid host-timezone skew.
  const d = new Date(`${isoDate}T00:00:00Z`);
  return WEEKDAY_KEYS[d.getUTCDay()];
}

/** Lexical YYYY-MM-DD comparison is correct since the format is zero-padded. */
function isoDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

// =============================================================================
// composePrice
// =============================================================================

export function composePrice(ctx: PricingCtx): PricingResult {
  const applied_rule_ids: string[] = [];
  const skipped: Array<{ rule_id: string; reason: string }> = [];
  const line_items: QuoteLineItem[] = [];

  const { pkg, qty, rules, addons } = ctx;
  const eventDate = extractIsoDate(ctx.event.starts_at);
  const eventWeekday = isoDateToWeekdayKey(eventDate);

  // --- 1. service subtotal with qty tier rule -----------------------------
  //
  // Base line is always present. Qty tier may (a) discount every unit
  // (all_units) or (b) replace per-unit pricing with stepped tiers
  // (incremental). If both kinds match for the same qty, the one with the
  // lower `priority` number wins; the loser is recorded in `skipped`.
  const basePackageLine: QuoteLineItem = {
    kind: "package",
    label: pkg.name,
    qty,
    unit: pkg.unit,
    unit_price_halalas: pkg.base_price_halalas,
    total_halalas: pkg.base_price_halalas * qty,
  };
  line_items.push(basePackageLine);

  /** Float-accurate running service subtotal. Rounded once at step 9 boundary. */
  let serviceFloat = pkg.base_price_halalas * qty;

  type QtyCandidate = {
    rule: PricingRuleInput;
    effectFloat: number; // change to serviceFloat if this rule wins
    line: QuoteLineItem; // line_item representing the delta
  };
  const qtyCandidates: QtyCandidate[] = [];

  for (const r of rules) {
    if (r.rule_type === "qty_tier_all_units") {
      const cfg = parsePricingRuleConfig("qty_tier_all_units", r.config);
      // Highest matching breakpoint (largest gte <= qty) applies.
      let matched: { gte: number; discount_pct: number } | null = null;
      for (const bp of cfg.breakpoints) {
        if (qty >= bp.gte && (matched === null || bp.gte > matched.gte)) {
          matched = bp;
        }
      }
      if (!matched) {
        skipped.push({ rule_id: r.id, reason: "qty_below_all_tiers" });
        continue;
      }
      const base = pkg.base_price_halalas * qty;
      const afterDiscount = base * (1 - matched.discount_pct / 100);
      const deltaFloat = afterDiscount - base;
      const deltaInt = Math.round(deltaFloat);
      qtyCandidates.push({
        rule: r,
        effectFloat: afterDiscount,
        line: {
          kind: "qty_discount",
          label: `Qty discount ${matched.discount_pct}% (gte ${matched.gte})`,
          qty: 1,
          unit: "unit",
          unit_price_halalas: deltaInt,
          total_halalas: deltaInt,
          meta: {
            rule_id: r.id,
            discount_pct: String(matched.discount_pct),
            breakpoint_gte: matched.gte,
          },
        },
      });
    } else if (r.rule_type === "qty_tier_incremental") {
      const cfg = parsePricingRuleConfig("qty_tier_incremental", r.config);
      // Stepped-tier sum: count units in [from..to] (inclusive) up to qty.
      let incTotal = 0;
      for (const bp of cfg.breakpoints) {
        const hi = bp.to ?? Number.POSITIVE_INFINITY;
        const unitsInTier = Math.max(
          0,
          Math.min(qty, hi) - bp.from + 1,
        );
        if (unitsInTier > 0) {
          incTotal += unitsInTier * bp.price_halalas;
        }
      }
      const base = pkg.base_price_halalas * qty;
      const deltaInt = Math.round(incTotal - base);
      qtyCandidates.push({
        rule: r,
        effectFloat: incTotal,
        line: {
          kind: "qty_discount",
          label: `Incremental qty pricing`,
          qty: 1,
          unit: "unit",
          unit_price_halalas: deltaInt,
          total_halalas: deltaInt,
          meta: {
            rule_id: r.id,
            incremental_total_halalas: incTotal,
          },
        },
      });
    }
  }

  if (qtyCandidates.length > 0) {
    // Lower priority number wins. Stable-sort by priority then by rule id for
    // determinism if two rules share priority.
    qtyCandidates.sort((a, b) => {
      if (a.rule.priority !== b.rule.priority) {
        return a.rule.priority - b.rule.priority;
      }
      return a.rule.id < b.rule.id ? -1 : a.rule.id > b.rule.id ? 1 : 0;
    });
    const winner = qtyCandidates[0];
    applied_rule_ids.push(winner.rule.id);
    // Losers: other qty_tier rules that matched.
    for (const loser of qtyCandidates.slice(1)) {
      skipped.push({ rule_id: loser.rule.id, reason: "qty_tier_lower_priority" });
    }
    serviceFloat = winner.effectFloat;
    line_items.push(winner.line);
  }

  // --- 2. duration multiplier ---------------------------------------------
  //
  // Picks the tier with the largest `applies_from_days <= qty`. Multiplier
  // is recorded as a string in `meta.multiplier` so canonicalize doesn't
  // reject the snapshot for a non-integer number.
  const durationRules = rules.filter((r) => r.rule_type === "duration_multiplier");
  for (const r of durationRules) {
    const cfg = parsePricingRuleConfig("duration_multiplier", r.config);
    // Find highest applies_from_days <= qty.
    let winningTier: (typeof cfg.tiers)[number] | null = null;
    for (const t of cfg.tiers) {
      if (
        qty >= t.applies_from_days &&
        (winningTier === null || t.applies_from_days > winningTier.applies_from_days)
      ) {
        winningTier = t;
      }
    }
    if (!winningTier) {
      skipped.push({ rule_id: r.id, reason: "duration_below_all_tiers" });
      continue;
    }
    const before = serviceFloat;
    const after = before * winningTier.multiplier;
    // Apply optional daily cap (cap * qty). daily_cap_halalas is integer.
    let capped = after;
    if (cfg.daily_cap_halalas !== undefined) {
      const capTotal = cfg.daily_cap_halalas * qty;
      if (capped > capTotal) capped = capTotal;
    }
    const deltaInt = Math.round(capped - before);
    line_items.push({
      kind: "duration_multiplier",
      label: winningTier.label ?? `Duration multiplier x${winningTier.multiplier}`,
      qty: 1,
      unit: "unit",
      unit_price_halalas: deltaInt,
      total_halalas: deltaInt,
      meta: {
        rule_id: r.id,
        multiplier: String(winningTier.multiplier),
        applies_from_days: winningTier.applies_from_days,
      },
    });
    serviceFloat = capped;
    applied_rule_ids.push(r.id);
  }

  // --- 3. date surcharge (exactly one winner) -----------------------------
  //
  // Precedence by scope: specific_date > named_period > weekday. Ties within
  // a scope: lower priority number wins (treat "priority" as ordinal, lower
  // is more important). Losers are NOT recorded as skipped because the spec
  // says only applicable rules are "skipped for reasons"; tied-out date
  // surcharges are legitimately ignored by design. We still log them so
  // operators can debug precedence surprises.
  type DateCandidate = {
    rule: PricingRuleInput;
    scopeRank: number; // 0 = specific, 1 = named, 2 = weekday
    cfg: ReturnType<typeof parsePricingRuleConfig<"date_surcharge">>;
  };
  const dateCandidates: DateCandidate[] = [];
  for (const r of rules) {
    if (r.rule_type !== "date_surcharge") continue;
    const cfg = parsePricingRuleConfig("date_surcharge", r.config);
    if (cfg.scope === "specific_date") {
      if (cfg.date === eventDate) {
        dateCandidates.push({ rule: r, scopeRank: 0, cfg });
      } else {
        skipped.push({ rule_id: r.id, reason: "date_surcharge_date_mismatch" });
      }
    } else if (cfg.scope === "named_period") {
      if (isoDateInRange(eventDate, cfg.start, cfg.end)) {
        dateCandidates.push({ rule: r, scopeRank: 1, cfg });
      } else {
        skipped.push({ rule_id: r.id, reason: "date_surcharge_outside_period" });
      }
    } else {
      // weekday
      if (cfg.days.includes(eventWeekday)) {
        dateCandidates.push({ rule: r, scopeRank: 2, cfg });
      } else {
        skipped.push({ rule_id: r.id, reason: "date_surcharge_weekday_mismatch" });
      }
    }
  }

  if (dateCandidates.length > 0) {
    dateCandidates.sort((a, b) => {
      if (a.scopeRank !== b.scopeRank) return a.scopeRank - b.scopeRank;
      if (a.rule.priority !== b.rule.priority) return a.rule.priority - b.rule.priority;
      return a.rule.id < b.rule.id ? -1 : a.rule.id > b.rule.id ? 1 : 0;
    });
    const winner = dateCandidates[0];
    for (const loser of dateCandidates.slice(1)) {
      skipped.push({ rule_id: loser.rule.id, reason: "date_surcharge_lower_precedence" });
    }
    const before = serviceFloat;
    let after = before;
    const mult = winner.cfg.multiplier;
    const flat = winner.cfg.flat_addon_halalas;
    if (mult !== undefined) after = after * mult;
    if (flat !== undefined) after = after + flat;
    const deltaInt = Math.round(after - before);
    line_items.push({
      kind: "date_surcharge",
      label: `Date surcharge (${winner.cfg.scope})`,
      qty: 1,
      unit: "unit",
      unit_price_halalas: deltaInt,
      total_halalas: deltaInt,
      meta: {
        rule_id: winner.rule.id,
        scope: winner.cfg.scope,
        ...(mult !== undefined ? { multiplier: String(mult) } : {}),
        ...(flat !== undefined ? { flat_addon_halalas: flat } : {}),
      },
    });
    serviceFloat = after;
    applied_rule_ids.push(winner.rule.id);
  }

  // --- 4. supplier-level percentage discount ------------------------------
  //
  // Applied to service subtotal only — never to travel. Invalid discount pct
  // (>100%) produces a negative intermediate value which will be clamped by
  // step 6 (or by the final total clamp). No Zod schema validates this yet;
  // that's tracked as future work.
  if (
    ctx.supplier_discount_pct !== undefined &&
    ctx.supplier_discount_pct !== null &&
    ctx.supplier_discount_pct !== 0
  ) {
    const pct = ctx.supplier_discount_pct;
    const before = serviceFloat;
    const after = before * (1 - pct / 100);
    const deltaInt = Math.round(after - before);
    line_items.push({
      kind: "qty_discount", // no dedicated kind; reuse qty_discount for any pct off service
      label: `Supplier discount ${pct}%`,
      qty: 1,
      unit: "unit",
      unit_price_halalas: deltaInt,
      total_halalas: deltaInt,
      meta: {
        discount_kind: "supplier_percent",
        discount_pct: String(pct),
      },
    });
    serviceFloat = after;
  }

  // --- 5. fixed addons ----------------------------------------------------
  //
  // Addons are NOT part of subtotal — they're billed separately via the
  // snapshot.setup_fee_halalas / teardown_fee_halalas columns and counted
  // into `total_halalas`. We still emit line_items so the PDF renders them.
  const setupFee = Math.max(0, Math.round(addons.setup_fee_halalas));
  const teardownFee = Math.max(0, Math.round(addons.teardown_fee_halalas));

  // --- 6. minimum-fee floor clamp -----------------------------------------
  //
  // Package-level minimum service fee. If the computed service is below the
  // floor, clamp up (never down) and emit a visible line item so the quote
  // reader sees why the price didn't drop further.
  const floor = pkg.min_fee_halalas ?? null;
  if (floor !== null && floor > 0) {
    // Clamp BEFORE final rounding so a discount that rounds to exactly the
    // floor doesn't bump up to floor + 1.
    const currentRounded = Math.round(serviceFloat);
    if (currentRounded < floor) {
      const deltaInt = floor - currentRounded;
      line_items.push({
        kind: "free_form",
        label: `Minimum fee floor`,
        qty: 1,
        unit: "unit",
        unit_price_halalas: deltaInt,
        total_halalas: deltaInt,
        meta: { floor_halalas: floor },
      });
      serviceFloat = floor;
    }
  }

  // Final subtotal: single Math.round on the float accumulator. Clamp to 0
  // so pathological configs (e.g. 110% discount, Case 12) never produce a
  // negative subtotal.
  let subtotal_halalas = Math.round(serviceFloat);
  if (subtotal_halalas < 0) subtotal_halalas = 0;

  // --- 7. travel fee (always separate) ------------------------------------
  //
  // Free-form override skips rule evaluation entirely. Otherwise evaluate
  // exactly one `distance_fee` rule: if multiple are present, lower priority
  // wins (same convention as qty tier). When ctx.distance_km is null, the
  // rule is skipped with reason "no_venue_location" — this is the only
  // branch that returns a valid snapshot despite a matching rule not firing.
  let travel_fee_halalas = 0;
  const distanceRules = rules.filter((r) => r.rule_type === "distance_fee");

  if (addons.travel_fee_halalas_override !== null) {
    travel_fee_halalas = Math.max(0, Math.round(addons.travel_fee_halalas_override));
    // Rules are skipped (the free-form override takes precedence).
    for (const r of distanceRules) {
      skipped.push({ rule_id: r.id, reason: "travel_fee_overridden" });
    }
    if (travel_fee_halalas > 0) {
      line_items.push({
        kind: "distance_fee",
        label: `Travel fee (override)`,
        qty: 1,
        unit: "unit",
        unit_price_halalas: travel_fee_halalas,
        total_halalas: travel_fee_halalas,
        meta: { override: true },
      });
    }
  } else if (distanceRules.length > 0) {
    // Select winner by priority ASC.
    const sorted = [...distanceRules].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    const winner = sorted[0];
    for (const loser of sorted.slice(1)) {
      skipped.push({ rule_id: loser.id, reason: "distance_fee_lower_priority" });
    }

    if (ctx.distance_km === null) {
      skipped.push({ rule_id: winner.id, reason: "no_venue_location" });
    } else {
      const cfg = parsePricingRuleConfig("distance_fee", winner.config);
      const billableKm = Math.max(0, ctx.distance_km - cfg.free_radius_km);
      // ceil(billableKm * sar_per_km * 100) halalas — matches Case 8.
      const rawHalalas = Math.ceil(billableKm * cfg.sar_per_km * 100);
      let computed = Math.max(cfg.min_fee_halalas ?? 0, rawHalalas);
      if (cfg.max_fee_halalas !== undefined) {
        computed = Math.min(computed, cfg.max_fee_halalas);
      }
      travel_fee_halalas = computed;
      applied_rule_ids.push(winner.id);
      if (computed > 0) {
        line_items.push({
          kind: "distance_fee",
          label: `Travel fee (${ctx.distance_km} km)`,
          qty: 1,
          unit: "unit",
          unit_price_halalas: computed,
          total_halalas: computed,
          meta: {
            rule_id: winner.id,
            distance_km_int: Math.round(ctx.distance_km),
            billable_km_int: Math.round(billableKm),
            sar_per_km: String(cfg.sar_per_km),
          },
        });
      }
    }
  }

  // --- 8. VAT line --------------------------------------------------------
  //
  // ZATCA standard rate. Base is everything taxable: service subtotal plus
  // the addon fees and the travel line. If the supplier marked prices as
  // VAT-inclusive, reverse-derive the VAT portion from the gross base
  // (vat = base × rate / (100 + rate)); otherwise add it on top.
  const vat_rate_pct = VAT_RATE_PCT;
  const taxable_base_halalas =
    subtotal_halalas + setupFee + teardownFee + travel_fee_halalas;
  const prices_include_vat = ctx.prices_include_vat === true;
  let vat_amount_halalas = prices_include_vat
    ? Math.round(
        (taxable_base_halalas * VAT_RATE_PCT) / (100 + VAT_RATE_PCT),
      )
    : Math.round((taxable_base_halalas * VAT_RATE_PCT) / 100);
  if (vat_amount_halalas < 0) vat_amount_halalas = 0;

  // --- 9. total -----------------------------------------------------------
  //
  // Inclusive mode: total equals the gross base the supplier already entered.
  // Exclusive mode: base + VAT. Clamp >= 0 as a defence in depth — each
  // component is already non-negative but a future rule type might produce a
  // negative travel fee (e.g. travel credit) and we want the customer-facing
  // total to never go negative without loud failure.
  let total_halalas = prices_include_vat
    ? taxable_base_halalas
    : taxable_base_halalas + vat_amount_halalas;
  if (total_halalas < 0) total_halalas = 0;

  const snapshot: QuoteSnapshot = {
    engine_version: QUOTE_ENGINE_VERSION,
    currency: "SAR",
    source: ctx.source,
    line_items,
    subtotal_halalas,
    travel_fee_halalas,
    setup_fee_halalas: setupFee,
    teardown_fee_halalas: teardownFee,
    vat_rate_pct,
    vat_amount_halalas,
    prices_include_vat,
    total_halalas,
    deposit_pct: addons.deposit_pct,
    payment_schedule: addons.payment_schedule,
    cancellation_terms: addons.cancellation_terms,
    inclusions: addons.inclusions,
    exclusions: addons.exclusions,
    notes: addons.notes,
    expires_at: addons.expires_at,
    inputs_digest: "", // caller recomputes via buildRevisionSnapshot
  };

  return { snapshot, applied_rule_ids, skipped };
}
