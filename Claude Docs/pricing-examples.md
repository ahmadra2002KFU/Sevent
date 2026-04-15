# Sevent — Pricing engine test cases

Deterministic examples for `composePrice(ctx, rules)` at `src/lib/domain/pricing/engine.ts`.
All amounts in halalas (100 halalas = 1 SAR). Each case below must pass as a
Vitest unit test in Sprint 4. Adding a new rule type requires adding ≥2 cases
here first.

Evaluation order (fixed):
1. Service subtotal (base package price × qty logic)
2. Duration multiplier applied to subtotal
3. Date surcharge (one rule wins: `specific_date > named_period > weekday/weekend`, ties break by highest `priority`)
4. Percentage discounts (supplier-level) applied to service subtotal
5. Fixed addons (setup, teardown, flat date addons)
6. Minimum-fee floor (clamp)
7. Travel fee (separate line, never absorbed)
8. VAT line (0 in v1; column present so ZATCA integration is additive)
9. Total = service + addons + travel + VAT; clamp ≥ 0; round once to halalas

---

## Case 1 — Flat per-event package, no rules

**Input**
- Package: `base_price=500_00` halalas, `unit='event'`, qty=1
- Rules: none
- Event date: 2026-07-15 (Wednesday)
- Travel: none applicable

**Expected**
- subtotal = 500_00
- travel = 0
- total = 500_00

## Case 2 — Per-person catering, all-units qty tier discount

**Input**
- Package: `base_price=150_00`, `unit='person'`, qty=80
- Rule: `qty_tier_all_units` config `{ breakpoints: [{ gte: 50, discount_pct: 15 }, { gte: 100, discount_pct: 20 }] }`
- Event date: 2026-05-20 (Wed), no surcharges applicable

**Expected**
- Base: 80 × 150_00 = 12_000_00
- Tier 50+ matches → 15% off applied to *every* unit: 12_000_00 × 0.85 = 10_200_00
- subtotal = 10_200_00
- total = 10_200_00

## Case 3 — Per-person catering, incremental qty tier

**Input**
- Same package as Case 2, qty=120
- Rule: `qty_tier_incremental` config
  `{ breakpoints: [{ from: 1, to: 49, price_halalas: 150_00 }, { from: 50, to: 99, price_halalas: 135_00 }, { from: 100, to: null, price_halalas: 120_00 }] }`

**Expected**
- 49 × 150_00 = 7_350_00
- 50 × 135_00 = 6_750_00
- 21 × 120_00 = 2_520_00
- subtotal = 16_620_00

## Case 4 — Duration multiplier (equipment rental: day → week)

**Input**
- Package: `base_price=500_00`, `unit='day'`, qty=7 (days)
- Rule: `duration_multiplier` config `{ tiers: [{ unit: 'day', multiplier: 1.0 }, { unit: 'week', days: 7, multiplier: 0.9, applies_from_days: 7 }] }`
- No other rules

**Expected**
- Base: 7 × 500_00 = 3_500_00
- 7-day trigger → multiplier 0.9: 3_500_00 × 0.9 = 3_150_00
- subtotal = 3_150_00

## Case 5 — Date surcharge, named period (Ramadan evening +20%)

**Input**
- Package: `base_price=2000_00`, `unit='event'`, qty=1
- Rule A: `date_surcharge` priority=100, config `{ named_period: { name: 'ramadan', start: '2026-02-18', end: '2026-03-19' }, multiplier: 1.2 }`
- Event date: 2026-03-05

**Expected**
- service = 2000_00 × 1.2 = 2400_00

## Case 6 — Date surcharge precedence: specific_date wins over named_period

**Input**
- Same package as Case 5
- Rule A: named_period Ramadan multiplier 1.2, priority 100
- Rule B: `specific_date` '2026-03-05' flat_addon=500_00 priority 200
- Event date: 2026-03-05

**Expected**
- Specific-date wins → service = 2000_00 + 500_00 = 2500_00
- Named-period rule is ignored (not stacked)

## Case 7 — Weekend multiplier only when no higher-precedence rule

**Input**
- Package: `base_price=1000_00`, `unit='event'`, qty=1
- Rule: `date_surcharge` weekend multiplier 1.15, priority 50
- Event date: 2026-06-13 (Saturday — weekend in Saudi Fri/Sat)

**Expected**
- service = 1000_00 × 1.15 = 1150_00

## Case 8 — Travel fee computed from Distance Matrix, kept as separate line

**Input**
- Package: `base_price=1500_00`, `unit='event'`, qty=1
- Rule: `distance_fee` config `{ sar_per_km: 3.5, free_radius_km: 20, min_fee_halalas: 50_00 }`
- Supplier base → venue distance (cached): 35 km

**Expected**
- billable_km = max(0, 35 − 20) = 15
- computed = max(50_00, ceil(15 × 3.5 × 100)) = max(50_00, 52_50) = 52_50
- travel_fee = 52_50
- service = 1500_00
- total = 1550_00 (service + travel)

## Case 9 — Minimum-fee floor catches aggressive discounts

**Input**
- Package: `base_price=100_00`, `unit='event'`, qty=1, min_fee_halalas=200_00 (package-level)
- Rule: supplier-level percentage discount 60% off (invalid in UI but DB-level test)

**Expected**
- service_after_pct = 100_00 × 0.4 = 40_00
- min-fee floor clamps to 200_00
- subtotal = 200_00

## Case 10 — Setup + teardown addons (fixed halalas)

**Input**
- Package: `base_price=800_00`, unit='event', qty=1
- Rule: no pricing rule; quote declares `setup_fee_halalas=150_00`, `teardown_fee_halalas=100_00`

**Expected**
- service = 800_00
- addons = 150_00 + 100_00 = 250_00
- total = 1050_00

## Case 11 — Rounding: halala output is integer, never a float

**Input**
- Package: `base_price=123_45` (1.2345 SAR — pathological), unit='person', qty=7
- Rule: qty tier `gte: 5 discount_pct: 12.5`

**Expected**
- Raw: 7 × 123_45 = 864_15
- Discount: 864_15 × (1 − 0.125) = 756_131.25
- Round once to integer halalas: **756_13** (banker's rounding: use `Math.round` after multiplication, never per-line floats)
- subtotal = 756_13
- Invariant: every persisted monetary column is `bigint` halalas with a single rounding step at the end

## Case 12 — Zero or negative total clamp

**Input**
- Package: `base_price=500_00`, unit='event', qty=1
- Rule: invalid supplier discount 110% (should be rejected by Zod, but if somehow persisted)

**Expected**
- service_after_pct = 500_00 × (1 − 1.1) = −50_00
- clamp min 0 → subtotal = 0
- total = max(0, 0 + travel + vat + addons)

## Case 13 — VAT column present but zero in v1

**Input**
- Any package / rules
- ZATCA integration not live

**Expected**
- `vat_rate_pct = 0`
- `vat_amount_halalas = 0`
- Contract PDF still renders the VAT line (so future non-zero values require no UI changes)

---

## Invariants the engine MUST hold

1. Every monetary output is `bigint` halalas.
2. The engine is pure: `composePrice(ctx, rules)` has no I/O — distance is injected by the caller.
3. Distance is always a *separate* line in the quote JSON and contract.
4. Only **one** date surcharge rule applies per event date (precedence: specific_date > named_period > weekday/weekend; ties by `priority` desc).
5. `quote_revisions.content_hash` is SHA-256 over the canonicalized snapshot JSON (sorted keys, no whitespace).
6. Supplier can override any computed value in "free_form" mode; `quotes.source` reflects this.
