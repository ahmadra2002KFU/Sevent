# Stress-seed: 100 Riyadh suppliers

## Why this exists

Auto-match ranking is hard to eyeball with the 25-supplier baseline seed
(`pnpm seed`) — there are often only 1–2 approved suppliers per subcategory, so
the top-5 shortlist is whatever happens to exist. To actually test the
auto-match engine under realistic competition we want **many** suppliers in the
same city (Riyadh) and category so the ranker's tiebreaks, rotation penalty,
responsiveness weight, and deterministic ordering can be observed end-to-end.

This seed adds **100 extra Riyadh suppliers** on top of whatever is already in
the database. It is intentionally dumb data:

- No portfolio photos, no verification docs uploaded (auto-match ignores both).
- Procedural business names (`Najd Ballroom 037`, `Al Malqa Lens 081`, …).
- Deterministic per-index via a seeded RNG — reruns produce the same values,
  so the seed is idempotent by email.
- All `verification_status='approved'` + `is_published=true` so they show up
  in both matchmaking and `/categories/[parent]` public browse.

**It is not meant to ship.** Clean it up before any pilot launch or demo that
touches real suppliers.

## Distribution

Total: 100 suppliers, all in Riyadh, split across 8 subcategories:

| Subcategory | Count |
| --- | --- |
| `venue-ballroom` | 12 |
| `venue-outdoor` | 12 |
| `venue-conference` | 12 |
| `catering-buffet` | 13 |
| `catering-plated` | 13 |
| `catering-coffee` | 13 |
| `photo-wedding` | 13 |
| `photo-corporate` | 12 |

Each supplier gets:

- 1 `suppliers` row with jittered `capacity` (50–1000), `concurrent_event_limit`
  (1–3), `service_area_cities=['Riyadh']`, `languages=['ar','en']`.
- 1 `supplier_categories` link to the matching subcategory.
- 1 `packages` row with unit appropriate to the category
  (`event` / `person` / `day`) and a `base_price_halalas` jittered ±25% around
  the category median (e.g. ballroom median 45 000 SAR).
- 1 `pricing_rules` row — rule type rotates across all five
  (`qty_tier_all_units`, `qty_tier_incremental`, `distance_fee`,
  `date_surcharge`, `duration_multiplier`) so coverage is even.

No `supplier_media`, no `supplier_docs`, no availability blocks. Those tables
are unused by the auto-match query and would only slow the seed.

## Login credentials

- **Emails:** `rstress-001@sevent.dev` … `rstress-100@sevent.dev`
- **Password:** `StressPass123!`

Numbering order matches the category table above: suppliers 001–012 are
ballroom, 013–024 are outdoor, and so on.

## Commands

```bash
# Add the 100 stress suppliers (idempotent — safe to re-run).
pnpm seed:stress

# Remove them. FK cascades clean packages / pricing_rules / categories links.
pnpm seed:stress:clean
```

Both scripts load `.env.local` directly (no need to `export` envs inline like
the baseline `pnpm seed` currently requires — that's a Sprint-4 housekeeping
item for `seed-users.ts`).

## How to verify it worked

After `pnpm seed:stress`:

1. Studio → SQL: `select count(*) from suppliers where base_city='Riyadh' and is_published;` should be ≥108 (8 baseline + 100 stress; more if you've run onboarding flows).
2. `/categories/venues?city=Riyadh` should render ballroom, outdoor, and conference suppliers mixed together (36 total from stress + any baseline).
3. Organizer-side: create a Riyadh · wedding event → start the RFQ wizard → pick catering · plated → top-5 auto-match should be filled with stress suppliers; changing `guest_count` between 20 / 40 / 80 should re-shuffle the ranking (different qty-range fits).

## Cleanup failure modes

`seed-stress-clean` deletes via `auth.admin.deleteUser(id)`, which cascades:

```
auth.users → profiles → suppliers → supplier_categories
                                 → packages
                                 → pricing_rules
                                 → availability_blocks
                                 → supplier_media
                                 → supplier_docs
```

**But `bookings` and `quotes` use `ON DELETE RESTRICT`.** If during testing you
actually accepted a quote from a `rstress-*` supplier, their delete will fail
with a FK error. The script surfaces each failure by email and exits 1.

Recovery options:

1. Delete the offending booking / quote rows manually in Studio, then re-run
   `pnpm seed:stress:clean`.
2. Nuclear option: `pnpm exec supabase db reset && pnpm seed` (wipes everything,
   reseeds the canonical 25-supplier baseline, no stress users).

## Known caveats (non-blockers for stress testing)

- Auto-match's travel-fit signal uses only `base_city` for now (Places
  Autocomplete + Distance Matrix land in Sprint 6). Every stress supplier is
  in Riyadh, so that signal is constant across the stress pool — the ranker's
  differentiation comes from capability-fit + responsiveness + rotation, which
  is the interesting behaviour to observe anyway.
- Responsiveness for a brand-new stress supplier is always 0.5 (neutral) until
  they accumulate ≥5 invites in the rolling 30-day window. Send a few RFQs to
  the same supplier over a session and their rank should climb or drop
  measurably.
- Rotation penalty kicks in at ≥3 invites in the last 14 days. To watch it
  bite, send ≥3 RFQs of the same category in a row from one organizer and the
  previously-picked suppliers should slide down in the next shortlist.

## Sprint 4 note

When Sprint 4 lands the pricing engine and booking state machine, stress
suppliers make it easy to exercise:

- **Pricing engine:** each supplier has exactly one rule across 5 rule types,
  so you can pick any stress supplier to drive a specific rule path through
  `composePrice()`.
- **Soft-hold race:** 100 suppliers = easy to craft overlapping RFQs against
  the same supplier to prove the `availability_blocks` overlap trigger
  rejects the second `accept_quote_tx` correctly.

When Sprint 4 is merged, re-read this doc to decide whether to re-seed against
the expanded schema (no migration changes expected to the tables this script
writes, but worth confirming).
