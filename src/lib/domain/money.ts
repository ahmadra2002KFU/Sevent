/**
 * Money handling for Sevent. All monetary values are stored and manipulated in
 * integer halalas (100 halalas = 1 SAR). This module is the **only** place
 * parsing and formatting happens — Sprint 2 lanes must not invent their own.
 *
 * Decisions (Codex-approved, Claude Docs/pricing-examples.md):
 * - Persisted monetary columns are `bigint halalas`.
 * - Rounding happens **once** at the engine boundary (Math.round).
 * - Negative totals clamp to 0.
 * - All outputs are integers — never floats between the engine and the DB.
 */

export type Halalas = number;

const HALALAS_PER_SAR = 100;

/** Coerces a user-entered SAR string/number into integer halalas. */
export function sarToHalalas(sar: number | string): Halalas {
  const value = typeof sar === "string" ? Number(sar.replace(/[,\s]/g, "")) : sar;
  if (!Number.isFinite(value)) {
    throw new Error(`sarToHalalas: not a finite number: ${sar}`);
  }
  if (value < 0) {
    throw new Error(`sarToHalalas: value must be >= 0: ${sar}`);
  }
  return Math.round(value * HALALAS_PER_SAR);
}

/** Converts halalas to a decimal SAR number (for display / form pre-fill). */
export function halalasToSar(halalas: Halalas): number {
  assertHalalas(halalas);
  return halalas / HALALAS_PER_SAR;
}

/** Formats halalas as a localized SAR string ("1,234.50 SAR"). */
export function formatHalalas(
  halalas: Halalas,
  opts: { locale?: string; withCurrency?: boolean } = {},
): string {
  assertHalalas(halalas);
  const { locale = "en-SA", withCurrency = true } = opts;
  const amount = halalasToSar(halalas);
  const formatter = new Intl.NumberFormat(locale, {
    style: withCurrency ? "currency" : "decimal",
    currency: "SAR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return formatter.format(amount);
}

/** Runtime guard — throws if a value is not a safe integer. */
export function assertHalalas(value: unknown): asserts value is Halalas {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`assertHalalas: expected integer, got ${typeof value}: ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`assertHalalas: value exceeds safe integer range: ${value}`);
  }
}

/** Clamp a (possibly negative or fractional) computed number to non-negative integer halalas. */
export function clampToHalalas(value: number): Halalas {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  return rounded < 0 ? 0 : rounded;
}

/** Sum any number of halalas values deterministically. */
export function sumHalalas(...values: Halalas[]): Halalas {
  let total = 0;
  for (const v of values) {
    assertHalalas(v);
    total += v;
  }
  return total;
}

/** Applies a percent discount/multiplier to halalas and rounds back to integer halalas. */
export function applyPercent(halalas: Halalas, percent: number): Halalas {
  assertHalalas(halalas);
  if (!Number.isFinite(percent)) {
    throw new Error(`applyPercent: percent must be finite: ${percent}`);
  }
  return clampToHalalas(halalas * percent);
}
