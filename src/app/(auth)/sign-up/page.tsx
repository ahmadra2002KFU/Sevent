import { getLocale, getTranslations } from "next-intl/server";
import { SignUpExperience } from "./SignUpExperience";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ role?: string }>;
};

/**
 * Single sign-up entry point. Holds both the organizer and supplier tracks in
 * one client experience that toggles in place — no navigation between roles.
 * `?role=supplier` seeds the supplier funnel; the legacy `/sign-up/organizer`
 * and `/sign-up/supplier` routes redirect here.
 */
export default async function SignUpPage({ searchParams }: PageProps) {
  const { role } = await searchParams;
  const initialRole = role === "supplier" ? "supplier" : "organizer";

  const [t, tSupplier, tCommon, locale] = await Promise.all([
    getTranslations("auth.signUp"),
    getTranslations("auth.signUp.supplier"),
    getTranslations("auth.common"),
    getLocale(),
  ]);
  const signUpLocale: "en" | "ar" = locale === "ar" ? "ar" : "en";

  return (
    <SignUpExperience
      initialRole={initialRole}
      locale={signUpLocale}
      labels={{
        backHome: tCommon("backHome"),
        toggle: {
          organizer: t("roleToggle.organizer"),
          supplier: t("roleToggle.supplier"),
        },
        hero: {
          headline: t("valueHero.headline"),
          subtitle: t("valueHero.subtitle"),
          whyTitle: t("valueHero.whyTitle"),
          why: [
            {
              icon: "trending-up",
              title: t("valueHero.whyTrendingTitle"),
              desc: t("valueHero.whyTrendingDesc"),
            },
            {
              icon: "shield-check",
              title: t("valueHero.whyShieldTitle"),
              desc: t("valueHero.whyShieldDesc"),
            },
            {
              icon: "badge-check",
              title: t("valueHero.whyBadgeTitle"),
              desc: t("valueHero.whyBadgeDesc"),
            },
          ],
          footnote: t("valueHero.footnote"),
        },
        organizer: {
          title: t("title"),
          subtitle: t("subtitle"),
          haveAccount: t("haveAccount"),
          signIn: t("signIn"),
          form: {
            fullNameLabel: t("fullNameLabel"),
            fullNamePlaceholder: t("fullNamePlaceholder"),
            emailLabel: t("emailLabel"),
            emailPlaceholder: t("emailPlaceholder"),
            phoneLabel: t("phoneLabel"),
            phoneCountryCode: t("phoneCountryCode"),
            phonePlaceholder: t("phonePlaceholder"),
            passwordLabel: t("passwordLabel"),
            passwordPlaceholder: t("passwordPlaceholder"),
            passwordHint: t("passwordHint"),
            submit: t("submit"),
            submitting: t("submitting"),
            errorFullName: t("errorFullName"),
            errorEmail: t("errorEmail"),
            errorPhone: t("errorPhone"),
            errorPassword: t("errorPassword"),
          },
        },
        supplier: {
          eyebrow: tSupplier("eyebrow"),
          title: tSupplier("title"),
          alreadyHaveAccount: tSupplier("alreadyHaveAccount"),
          signIn: tSupplier("signIn"),
          form: {
            emailLabel: tSupplier("emailLabel"),
            emailPlaceholder: tSupplier("emailPlaceholder"),
            phoneLabel: tSupplier("phoneLabel"),
            phoneCountryCode: tSupplier("phoneCountryCode"),
            phonePlaceholder: tSupplier("phonePlaceholder"),
            passwordLabel: tSupplier("passwordLabel"),
            passwordHint: tSupplier("passwordHint"),
            cta: tSupplier("cta"),
            submitting: tSupplier("submitting"),
            terms: tSupplier("terms"),
            termsLinkTerms: tSupplier("termsLinkTerms"),
            termsLinkPrivacy: tSupplier("termsLinkPrivacy"),
            errorEmail: tSupplier("errorEmail"),
            errorPhone: tSupplier("errorPhone"),
            errorPassword: tSupplier("errorPassword"),
            errorTerms: tSupplier("errorTerms"),
          },
        },
      }}
    />
  );
}
