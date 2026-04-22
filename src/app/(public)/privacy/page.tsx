import { getLocale, getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations({ locale: "en", namespace: "privacy" });
  return {
    title: `${t("title")} · Sevent`,
  };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = await getTranslations("privacy");
  const isRtl = locale === "ar";

  return (
    <main
      dir={isRtl ? "rtl" : "ltr"}
      className="mx-auto w-full max-w-3xl px-6 py-16 text-brand-navy sm:py-20"
    >
      <div
        role="note"
        className="mb-8 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
      >
        {t("draftBanner")}
      </div>

      <h1 className="mb-8 text-3xl font-semibold tracking-tight sm:text-4xl">
        {t("title")}
      </h1>

      <div className="space-y-5 text-base leading-relaxed text-brand-navy/85">
        <p>{t("body.p1")}</p>
        <p>{t("body.p2")}</p>
        <p>{t("body.p3")}</p>
        <p>{t("body.p4")}</p>
        <p>{t("body.p5")}</p>
      </div>
    </main>
  );
}
