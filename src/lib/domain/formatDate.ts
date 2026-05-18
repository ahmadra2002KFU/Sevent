// Locale-aware date formatting helpers. Single source of truth so every
// dashboard / list / detail page reaches the same format for the same locale.
// Lives in `src/lib/domain/` so it can be imported from both server and
// client components — callers supply `locale`; the helpers do not call
// `useLocale()` / `getLocale()` themselves.

export type SupportedLocale = "en" | "ar";

/**
 * Maps an app locale to the BCP-47 tag every `Intl.*` formatter should use.
 * Exported so money / number / relative-time helpers and any other
 * locale-aware formatter share one decision instead of hardcoding `"en-SA"`.
 */
export function intlLocaleFor(locale: SupportedLocale): string {
  return locale === "ar" ? "ar-SA" : "en-SA";
}

// Internal alias kept for the date helpers below.
function intlLocale(locale: SupportedLocale): string {
  return intlLocaleFor(locale);
}

/** Locale-aware plain number (Arabic-Indic digits on `ar`). */
export function fmtNumber(
  value: number | null | undefined,
  locale: SupportedLocale,
  opts?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  try {
    return new Intl.NumberFormat(intlLocale(locale), opts).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Locale-aware percentage. `value` is the percent number itself (e.g. `15`
 * for 15%), not a 0–1 ratio — matches how `vat_rate_pct` / `deposit_pct` are
 * stored on quote snapshots.
 */
export function fmtPercent(
  value: number | null | undefined,
  locale: SupportedLocale,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  try {
    return new Intl.NumberFormat(intlLocale(locale), {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(value / 100);
  } catch {
    return `${value}%`;
  }
}

/**
 * Locale-aware relative time ("3 days ago" / "قبل ٣ أيام"). Replaces ad-hoc
 * `date-fns` usage that defaulted to English regardless of locale. Picks the
 * largest sensible unit from the elapsed delta.
 */
export function fmtRelative(
  iso: string | null | undefined,
  locale: SupportedLocale,
): string {
  if (!iso) return "";
  try {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return iso;
    const diffSec = Math.round((then - Date.now()) / 1000);
    const abs = Math.abs(diffSec);
    const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), {
      numeric: "auto",
    });
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
      ["year", 31536000],
      ["month", 2592000],
      ["week", 604800],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
      ["second", 1],
    ];
    for (const [unit, secs] of units) {
      if (abs >= secs || unit === "second") {
        return rtf.format(Math.round(diffSec / secs), unit);
      }
    }
    return iso;
  } catch {
    return iso;
  }
}

export function fmtDate(
  iso: string | null | undefined,
  locale: SupportedLocale,
): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function fmtDateTime(
  iso: string | null | undefined,
  locale: SupportedLocale,
): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
