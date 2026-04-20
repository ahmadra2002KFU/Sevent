/**
 * Quote snapshot canonicalization + content-hash utilities.
 *
 * The hash stored in `quote_revisions.content_hash` is the SHA-256 of the
 * canonical JSON form of the snapshot. Any future consumer that recomputes
 * the hash must arrive at byte-for-byte the same string — so this module
 * pins down every choice that could drift between implementations: key
 * order, integer handling, string normalization, undefined stripping.
 *
 * The `content_hash` is a column on `quote_revisions`, never a field inside
 * `snapshot_jsonb`. The snapshot being hashed must not contain its own hash.
 */

import { createHash } from "node:crypto";

export const QUOTE_ENGINE_VERSION = "1.0.0" as const;

export type QuoteSource = "rule_engine" | "free_form" | "mixed";

export type QuoteLineItemKind =
  | "package"
  | "qty_discount"
  | "date_surcharge"
  | "distance_fee"
  | "duration_multiplier"
  | "free_form";

export type QuoteUnit = "event" | "hour" | "day" | "person" | "unit";

export type QuoteLineItem = {
  kind: QuoteLineItemKind;
  label: string;
  qty: number;
  unit: QuoteUnit;
  unit_price_halalas: number;
  total_halalas: number;
  meta?: Record<string, string | number | boolean>;
};

export type QuoteSnapshot = {
  engine_version: typeof QUOTE_ENGINE_VERSION;
  currency: "SAR";
  source: QuoteSource;
  line_items: QuoteLineItem[];
  subtotal_halalas: number;
  travel_fee_halalas: number;
  setup_fee_halalas: number;
  teardown_fee_halalas: number;
  vat_rate_pct: number;
  vat_amount_halalas: number;
  total_halalas: number;
  deposit_pct: number;
  payment_schedule: string;
  cancellation_terms: string;
  inclusions: string[];
  exclusions: string[];
  notes: string | null;
  expires_at: string | null;
  inputs_digest: string;
};

/**
 * Deterministic canonicalization of a JSON-compatible value.
 *
 * Rules (each one exists to prevent a specific source of hash drift):
 * - Object keys are sorted lexicographically by UTF-16 code unit order (same
 *   ordering `Array.prototype.sort` uses on strings), so two callers can't
 *   disagree on key order.
 * - `undefined` properties are stripped; `null` is preserved.
 * - Array order is preserved (line_items order is semantically meaningful —
 *   sorting it would silently rewrite the quote).
 * - Strings are NFC-normalized so visually identical Arabic or decomposed
 *   Unicode can't produce different bytes.
 * - Numbers must be safe integers. Floats are banned to prevent IEEE-754
 *   drift (e.g. multiplier 1.15 serialising differently across engines).
 *   Throw loudly so a bug surfaces at hash time, not six months later when
 *   a recomputation mysteriously disagrees.
 * - `bigint` is rejected outright — `JSON.stringify` refuses to serialise it
 *   anyway; raising here gives a useful error message.
 */
export function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === "bigint") {
    throw new Error("canonicalize: bigint is not supported in quote snapshots");
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`canonicalize: non-finite number ${value}`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        `canonicalize: non-integer or unsafe number ${value} — use halalas (integer) or stringify multipliers in meta`,
      );
    }
    return value;
  }
  if (typeof value === "string") return value.normalize("NFC");
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      const v = obj[k];
      if (v === undefined) continue;
      out[k] = canonicalize(v);
    }
    return out;
  }
  // Functions, symbols, undefined at root — none are valid in snapshots.
  throw new Error(`canonicalize: unsupported value type ${typeof value}`);
}

/**
 * SHA-256 of the canonical JSON form, lowercase hex. Uses node:crypto on
 * purpose — one implementation, one answer. If this ever needs to run in
 * the browser, stand up a WASM sha256 and cross-check against this module.
 */
export function sha256Hex(value: unknown): string {
  const canonical = canonicalize(value);
  const serialized = JSON.stringify(canonical);
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

export type BuildRevisionSnapshotInput = Omit<QuoteSnapshot, "inputs_digest"> & {
  inputs: {
    event_id: string;
    event_starts_at: string; // ISO-8601
    event_ends_at: string; // ISO-8601
    guest_count: number | null;
    venue_lat: number | null;
    venue_lng: number | null;
    package_id: string | null;
    distance_km: number | null; // passed through canonicalize → must be safe int in halalas, but this is km
  };
};

/**
 * Build a `quote_revisions.snapshot_jsonb` payload + its content_hash.
 *
 * The `inputs_digest` lets downstream consumers (the comparison view, the
 * contract PDF) detect whether the rfq / event inputs have drifted since the
 * snapshot was taken. The digest is over a normalized, integer-only input
 * record — distance_km is rounded to an integer here because `canonicalize`
 * rejects non-integer numbers.
 */
export function buildRevisionSnapshot(input: BuildRevisionSnapshotInput): {
  snapshot: QuoteSnapshot;
  content_hash: string;
} {
  const {
    inputs,
    ...rest
  } = input;

  // Integer-safe shape for inputs_digest hashing. distance_km is rounded to
  // meters before conversion to halalas isn't meaningful — we just want an
  // integer-safe representation, so round to integer km.
  const inputsCanonical = {
    engine_version: QUOTE_ENGINE_VERSION,
    event_id: inputs.event_id,
    event_starts_at: inputs.event_starts_at,
    event_ends_at: inputs.event_ends_at,
    guest_count: inputs.guest_count,
    venue_lat_e7:
      inputs.venue_lat === null ? null : Math.round(inputs.venue_lat * 1e7),
    venue_lng_e7:
      inputs.venue_lng === null ? null : Math.round(inputs.venue_lng * 1e7),
    package_id: inputs.package_id,
    distance_km_int:
      inputs.distance_km === null ? null : Math.round(inputs.distance_km),
  };
  const inputs_digest = sha256Hex(inputsCanonical);

  const snapshot: QuoteSnapshot = {
    ...rest,
    inputs_digest,
  };

  const content_hash = sha256Hex(snapshot);
  return { snapshot, content_hash };
}
