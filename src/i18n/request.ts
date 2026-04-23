import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { registerZodLocale } from "@/lib/zod/i18n";

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
  const first = accept.split(",")[0]?.split("-")[0];
  if (isSupported(first)) return first;

  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  // Install the Zod v4 locale so server actions / RSC validators render
  // missing-default messages in the resolved locale. Per-request because the
  // error-map lives on Zod's process-global config.
  await registerZodLocale(locale);
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
