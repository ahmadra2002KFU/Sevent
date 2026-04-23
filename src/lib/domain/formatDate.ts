// Locale-aware date formatting helpers. Single source of truth so every
// dashboard / list / detail page reaches the same format for the same locale.
// Lives in `src/lib/domain/` so it can be imported from both server and
// client components — callers supply `locale`; the helpers do not call
// `useLocale()` / `getLocale()` themselves.

export type SupportedLocale = "en" | "ar";

function intlLocale(locale: SupportedLocale): string {
  return locale === "ar" ? "ar-SA" : "en-SA";
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
