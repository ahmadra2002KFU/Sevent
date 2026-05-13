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
