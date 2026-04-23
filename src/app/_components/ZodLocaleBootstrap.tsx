"use client";

/**
 * Client-side Zod v4 locale installer.
 *
 * Keyed on `useLocale()` so a locale switch re-registers the bundled Arabic
 * / English error map on Zod's process-global config. Returns nothing — it's
 * mounted once inside the root layout, just under the NextIntlClientProvider.
 *
 * Mirror of the server-side call in `src/i18n/request.ts` so the same locale
 * applies to react-hook-form / zodResolver validations on the client.
 */
import { useEffect } from "react";
import { useLocale } from "next-intl";
import { registerZodLocale } from "@/lib/zod/i18n";

export function ZodLocaleBootstrap() {
  const locale = useLocale();
  useEffect(() => {
    void registerZodLocale(locale === "ar" ? "ar" : "en");
  }, [locale]);
  return null;
}
