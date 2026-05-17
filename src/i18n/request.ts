import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { enterRequestLocale } from "@/lib/zod/i18n.server";
import { negotiateAcceptLanguage } from "./negotiateAcceptLanguage";

const SUPPORTED_LOCALES = ["en", "ar"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = "en";

function isSupported(value: string | undefined): value is Locale {
  return !!value && SUPPORTED_LOCALES.includes(value as Locale);
}

async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  if (isSupported(cookieLocale)) return cookieLocale;

  const headerStore = await headers();
  const accept = headerStore.get("accept-language") ?? "";
  const negotiated = negotiateAcceptLanguage<Locale>(accept, SUPPORTED_LOCALES);
  if (negotiated) return negotiated;

  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  // Install the Zod v4 locale for THIS request's async context. Uses
  // `AsyncLocalStorage.enterWith` under the hood — concurrent en/ar
  // requests can no longer race over a process-global `z.config()` call.
  // See `src/lib/zod/i18n.server.ts` for the dispatcher implementation.
  enterRequestLocale(locale);
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
