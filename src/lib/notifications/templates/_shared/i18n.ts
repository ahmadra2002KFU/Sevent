/**
 * Locale primitives for email templates.
 *
 * Every template takes `locale: Locale` and uses these helpers to pick the
 * right direction / font / brand name. Strings themselves live in sibling
 * `.strings.ts` files per architecture.md.
 */

import { BRAND, BRAND_NAME } from "../_brand";

export type Locale = "en" | "ar";

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "ar"] as const;

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function fontFor(locale: Locale): string {
  return BRAND.fonts[locale];
}

export function brandName(locale: Locale): string {
  return BRAND_NAME[locale];
}

export function postalAddress(locale: Locale): string {
  return BRAND.postalAddress[locale];
}

/**
 * Pick a value per locale. Convenience for caller code:
 *   pick(locale, { en: "Welcome", ar: "مرحبا" })
 */
export function pick<T>(locale: Locale, by: { en: T; ar: T }): T {
  return by[locale];
}

/** Aligns text to the start of the writing direction (left in EN, right in AR). */
export function textAlignStart(locale: Locale): "left" | "right" {
  return locale === "ar" ? "right" : "left";
}

/**
 * BCP-47 tag for `Intl.*` formatters inside email templates. One decision,
 * shared — templates must not hardcode `"ar-SA"` / `"en-GB"` / `"en-US"`
 * inline (they drift and produce mixed-locale output in the wrong email).
 */
export function intlLocaleFor(locale: Locale): string {
  return locale === "ar" ? "ar-SA" : "en-SA";
}

/**
 * Shared `Intl.DateTimeFormat` wrapper for email templates. Owning the
 * `new Intl.DateTimeFormat(...)` call here lets the ESLint `no-restricted-
 * syntax` guardrail forbid the raw constructor everywhere else in the
 * template tree (which is how `"en-GB"` literals previously regrew on the
 * PasswordChanged / BookingCreated / BookingConfirmed templates).
 *
 * Caller passes a Date (or ISO string) + locale + `Intl` options; the
 * helper picks the BCP-47 tag via `intlLocaleFor`, applies `Asia/Riyadh`
 * as the default time zone (every Sevent email is for KSA recipients), and
 * gracefully degrades to the ISO string on bad input.
 */
export function formatEmailDateTime(
  input: Date | string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "full", timeStyle: "short" },
): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return typeof input === "string" ? input : "";
  }
  try {
    return new Intl.DateTimeFormat(intlLocaleFor(locale), {
      timeZone: "Asia/Riyadh",
      ...options,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * Shared `Intl.NumberFormat` wrapper for email templates — same rationale
 * as {@link formatEmailDateTime}: keep the raw constructor in one place so
 * the ESLint guardrail can forbid it everywhere else in the template tree.
 *
 * Caller passes the value + locale + options. Returns the formatted
 * number string, or the value's `toString()` form if the formatter throws.
 */
export function formatEmailNumber(
  value: number,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string {
  try {
    return new Intl.NumberFormat(intlLocaleFor(locale), options).format(value);
  } catch {
    return String(value);
  }
}
