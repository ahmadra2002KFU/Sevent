"use client";

/**
 * Client-side Zod v4 locale installer.
 *
 * Keyed on `useLocale()` so a locale switch re-registers the bundled Arabic
 * / English error map on Zod's process-global config. Returns nothing — it's
 * mounted once inside the root layout, just under the NextIntlClientProvider.
 *
 * The server-side path is separate (`src/i18n/request.ts` calls
 * `enterRequestLocale` from `@/lib/zod/i18n.server`) and uses
 * `AsyncLocalStorage` to scope the locale per request instead of mutating
 * Zod's process-global config. Browser tabs only have one locale at a time
 * so mutating the global here is safe — there is no concurrency to race.
 */
import { useEffect } from "react";
import { useLocale } from "next-intl";
import { registerZodLocaleGlobal } from "@/lib/zod/i18n.client";

export function ZodLocaleBootstrap() {
  const locale = useLocale();
  useEffect(() => {
    registerZodLocaleGlobal(locale === "ar" ? "ar" : "en");
  }, [locale]);
  return null;
}
