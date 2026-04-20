/**
 * Content-hash stability tests for `buildRevisionSnapshot`.
 *
 * The `quote_revisions.content_hash` column is the authoritative identity of
 * a quote revision — every downstream contract, comparison view and audit
 * trail compares against it. If two callers with the same input can produce
 * different hashes (key order, string encoding, number precision), the whole
 * revision system silently breaks.
 *
 * These tests nail down the invariants:
 *   (a) identical inputs → identical `content_hash`
 *   (b) changing any single field → different hash (qty, price, notes,
 *       line_items ORDER, inclusions ORDER)
 *   (c) floats in `total_halalas` throw during canonicalize — NEVER silently
 *       serialise as 12345.6
 *   (d) bigint anywhere throws
 */

import { describe, expect, it } from "vitest";
import {
  QUOTE_ENGINE_VERSION,
  buildRevisionSnapshot,
  canonicalize,
  type BuildRevisionSnapshotInput,
  type QuoteLineItem,
} from "@/lib/domain/quote";

// Minimal-valid input fixture. Every field is a safe integer or string so
// the canonicalize pass succeeds — each mutation below toggles one field at
// a time to prove the hash reacts to exactly that field.
function baseInput(): BuildRevisionSnapshotInput {
  const line_items: QuoteLineItem[] = [
    {
      kind: "package",
      label: "Pkg A",
      qty: 2,
      unit: "event",
      unit_price_halalas: 100_00,
      total_halalas: 200_00,
    },
    {
      kind: "qty_discount",
      label: "Discount",
      qty: 1,
      unit: "unit",
      unit_price_halalas: -20_00,
      total_halalas: -20_00,
      meta: { discount_pct: "10" },
    },
  ];
  return {
    engine_version: QUOTE_ENGINE_VERSION,
    currency: "SAR",
    source: "rule_engine",
    line_items,
    subtotal_halalas: 180_00,
    travel_fee_halalas: 0,
    setup_fee_halalas: 0,
    teardown_fee_halalas: 0,
    vat_rate_pct: 0,
    vat_amount_halalas: 0,
    total_halalas: 180_00,
    deposit_pct: 30,
    payment_schedule: "deposit",
    cancellation_terms: "standard",
    inclusions: ["staff", "equipment"],
    exclusions: [],
    notes: null,
    expires_at: null,
    inputs: {
      event_id: "evt-1",
      event_starts_at: "2026-07-15T18:00:00Z",
      event_ends_at: "2026-07-15T22:00:00Z",
      guest_count: 50,
      venue_lat: 24.7,
      venue_lng: 46.7,
      package_id: "pkg-1",
      distance_km: 12.3,
    },
  };
}

describe("buildRevisionSnapshot — content_hash stability", () => {
  it("(a) identical input produces identical content_hash on repeated calls", () => {
    const a = buildRevisionSnapshot(baseInput());
    const b = buildRevisionSnapshot(baseInput());
    expect(a.content_hash).toBe(b.content_hash);
    // sha256 hex is 64 chars.
    expect(a.content_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("(a) key insertion order in the input object does not change the hash", () => {
    const original = baseInput();
    // Re-build the input with keys inserted in a different order. canonicalize
    // must sort keys before hashing.
    const shuffled: BuildRevisionSnapshotInput = {
      inputs: original.inputs,
      total_halalas: original.total_halalas,
      subtotal_halalas: original.subtotal_halalas,
      currency: original.currency,
      source: original.source,
      line_items: original.line_items,
      engine_version: original.engine_version,
      travel_fee_halalas: original.travel_fee_halalas,
      setup_fee_halalas: original.setup_fee_halalas,
      teardown_fee_halalas: original.teardown_fee_halalas,
      vat_rate_pct: original.vat_rate_pct,
      vat_amount_halalas: original.vat_amount_halalas,
      deposit_pct: original.deposit_pct,
      payment_schedule: original.payment_schedule,
      cancellation_terms: original.cancellation_terms,
      inclusions: original.inclusions,
      exclusions: original.exclusions,
      notes: original.notes,
      expires_at: original.expires_at,
    };
    expect(buildRevisionSnapshot(original).content_hash).toBe(
      buildRevisionSnapshot(shuffled).content_hash,
    );
  });

  it("(b) changing qty on a line_item changes the hash", () => {
    const original = baseInput();
    const mutated = baseInput();
    mutated.line_items = [
      { ...original.line_items[0], qty: 3 },
      original.line_items[1],
    ];
    expect(buildRevisionSnapshot(original).content_hash).not.toBe(
      buildRevisionSnapshot(mutated).content_hash,
    );
  });

  it("(b) changing unit_price_halalas on a line_item changes the hash", () => {
    const original = baseInput();
    const mutated = baseInput();
    mutated.line_items = [
      { ...original.line_items[0], unit_price_halalas: 99_00 },
      original.line_items[1],
    ];
    expect(buildRevisionSnapshot(original).content_hash).not.toBe(
      buildRevisionSnapshot(mutated).content_hash,
    );
  });

  it("(b) changing notes from null to a string changes the hash", () => {
    const original = baseInput();
    const mutated = baseInput();
    mutated.notes = "Please arrive 30 min early.";
    expect(buildRevisionSnapshot(original).content_hash).not.toBe(
      buildRevisionSnapshot(mutated).content_hash,
    );
  });

  it("(b) reordering line_items changes the hash (order is semantic)", () => {
    const original = baseInput();
    const mutated = baseInput();
    mutated.line_items = [original.line_items[1], original.line_items[0]];
    expect(buildRevisionSnapshot(original).content_hash).not.toBe(
      buildRevisionSnapshot(mutated).content_hash,
    );
  });

  it("(b) reordering inclusions array changes the hash (order is semantic)", () => {
    const original = baseInput();
    const mutated = baseInput();
    mutated.inclusions = ["equipment", "staff"]; // reversed
    expect(buildRevisionSnapshot(original).content_hash).not.toBe(
      buildRevisionSnapshot(mutated).content_hash,
    );
  });

  it("(b) changing a single input (e.g. guest_count) changes inputs_digest AND content_hash", () => {
    const a = buildRevisionSnapshot(baseInput());
    const modified = baseInput();
    modified.inputs.guest_count = 75;
    const b = buildRevisionSnapshot(modified);
    expect(a.snapshot.inputs_digest).not.toBe(b.snapshot.inputs_digest);
    expect(a.content_hash).not.toBe(b.content_hash);
  });

  it("(c) a float in total_halalas throws during canonicalize", () => {
    const bad = baseInput();
    // Force a non-integer into a monetary field — canonicalize's
    // Number.isSafeInteger guard must reject it.
    bad.total_halalas = 180_00.5 as number;
    expect(() => buildRevisionSnapshot(bad)).toThrow(/non-integer|unsafe number/);
  });

  it("(c) a float on a line_item total_halalas throws during canonicalize", () => {
    const bad = baseInput();
    bad.line_items = [
      { ...baseInput().line_items[0], total_halalas: 200.5 as number },
      baseInput().line_items[1],
    ];
    expect(() => buildRevisionSnapshot(bad)).toThrow(/non-integer|unsafe number/);
  });

  it("(d) a bigint anywhere in the snapshot throws", () => {
    const bad = baseInput();
    // Money is modelled as `number` (halalas) for safety reasons spelled out
    // in quote.ts — bigint would be a TS-only escape, and canonicalize
    // rejects it even before JSON.stringify would.
    (bad as unknown as { total_halalas: bigint }).total_halalas = BigInt(18000);
    expect(() => buildRevisionSnapshot(bad)).toThrow(/bigint/);
  });

  it("(d) a bigint inside line_item.meta throws", () => {
    const bad = baseInput();
    bad.line_items = [
      {
        ...baseInput().line_items[0],
        meta: { some_id: BigInt(42) as unknown as number },
      },
      baseInput().line_items[1],
    ];
    expect(() => buildRevisionSnapshot(bad)).toThrow(/bigint/);
  });

  it("NFC normalization: visually-identical unicode strings produce the same hash", () => {
    // The precomposed form (U+00E9) and the decomposed form (e + U+0301) both
    // render as "é". canonicalize NFCs strings so they hash identically —
    // critical for Arabic / mixed-script quote notes.
    const composed = baseInput();
    composed.notes = "Caf\u00e9"; // U+00E9
    const decomposed = baseInput();
    decomposed.notes = "Cafe\u0301"; // e + U+0301
    expect(buildRevisionSnapshot(composed).content_hash).toBe(
      buildRevisionSnapshot(decomposed).content_hash,
    );
  });

  it("canonicalize invariant: snapshot is fully serialisable post-build", () => {
    const { snapshot } = buildRevisionSnapshot(baseInput());
    const canonical = canonicalize(snapshot);
    const json = JSON.stringify(canonical);
    // Re-parsing and re-canonicalizing yields the same string — idempotent.
    expect(JSON.stringify(canonicalize(JSON.parse(json)))).toBe(json);
  });
});
