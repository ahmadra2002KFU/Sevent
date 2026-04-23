/**
 * Zod v4 locale bootstrap.
 *
 * Installs the bundled Arabic (or English) locale error map globally so every
 * schema constructed via `import { z } from "zod"` picks up the right default
 * messages for validators without an explicit `{ message }` override.
 *
 * Wiring:
 *  - Server: called from `src/i18n/request.ts` once per request, after the
 *    next-intl locale is resolved. Server actions and RSC validators therefore
 *    see the correct locale.
 *  - Client: called from `src/app/_components/ZodLocaleBootstrap.tsx` inside
 *    a `useEffect` keyed on `useLocale()`, so react-hook-form / zodResolver
 *    validations render Arabic issues in Arabic, English in English.
 *
 * Per-field custom keys (attached via `.min(2, { message: "i18n.key" })` in
 * `src/lib/domain/onboarding.ts`) still take priority — this catch-all only
 * kicks in where no explicit override exists.
 *
 * Zod v4 ships the locales via the barrel `zod/v4/locales` — each entry is a
 * factory returning `{ localeError }`.
 */
import { z } from "zod";
import { ar, en } from "zod/v4/locales";

type Locale = "ar" | "en";

export function registerZodLocale(locale: Locale): void {
  const factory = locale === "ar" ? ar : en;
  z.config({ localeError: factory().localeError });
}
