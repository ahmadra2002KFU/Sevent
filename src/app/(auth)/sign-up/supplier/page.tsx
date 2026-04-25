import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { SupplierSignupHero } from "@/components/auth/SupplierSignupHero";
import { SupplierSignUpForm } from "./form";

export const dynamic = "force-dynamic";

type WhyEntry = { title: string; desc: string };

export default async function SignUpSupplierPage() {
  const [t, tCommon, locale] = await Promise.all([
    getTranslations("auth.signUp.supplier"),
    getTranslations("auth.common"),
    getLocale(),
  ]);

  const why = t.raw("valueHero.why") as WhyEntry[];
  const signUpLocale: "en" | "ar" = locale === "ar" ? "ar" : "en";

  return (
    <main className="flex min-h-screen bg-neutral-50">
      {/* Left navy value panel — hidden below lg so mobile layouts stack cleanly */}
      <SupplierSignupHero
        labels={{
          headline: t("valueHero.headline"),
          whyTitle: t("valueHero.whyTitle"),
          why,
          footnote: t("valueHero.footnote"),
        }}
      />

      {/* Right form column — mockup `direction-a.jsx:70-114`.
          `justify-center` centers the form inside the remaining space so on
          ultra-wide screens the form doesn't hug the hero edge with a wall
          of whitespace on the other side. */}
      <div className="flex flex-1 justify-center overflow-y-auto px-6 py-10 sm:px-10 lg:py-20">
        <div className="w-full max-w-[420px]">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
            {tCommon("backHome")}
          </Link>

          <div className="text-[12.5px] font-bold uppercase tracking-wider text-brand-cobalt-500">
            {t("eyebrow")}
          </div>
          <h1 className="mt-2 text-[30px] font-extrabold leading-tight tracking-tight text-brand-navy-900">
            {t("title")}
          </h1>
          <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted-foreground">
            {t("alreadyHaveAccount")}{" "}
            <Link
              href="/sign-in"
              className="font-semibold text-brand-cobalt-500 transition-colors hover:text-brand-cobalt-400"
            >
              {t("signIn")}
            </Link>
          </p>

          <div
            role="note"
            className="mt-6 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-relaxed text-amber-900"
          >
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t("autoConfirmNotice")}</span>
          </div>

          <div className="mt-8">
            <SupplierSignUpForm
              locale={signUpLocale}
              labels={{
                emailLabel: t("emailLabel"),
                emailPlaceholder: t("emailPlaceholder"),
                phoneLabel: t("phoneLabel"),
                phoneCountryCode: t("phoneCountryCode"),
                phonePlaceholder: t("phonePlaceholder"),
                passwordLabel: t("passwordLabel"),
                passwordHint: t("passwordHint"),
                cta: t("cta"),
                submitting: t("submitting"),
                terms: t("terms"),
                termsLinkTerms: t("termsLinkTerms"),
                termsLinkPrivacy: t("termsLinkPrivacy"),
                errorEmail: t("errorEmail"),
                errorPhone: t("errorPhone"),
                errorPassword: t("errorPassword"),
                errorTerms: t("errorTerms"),
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
