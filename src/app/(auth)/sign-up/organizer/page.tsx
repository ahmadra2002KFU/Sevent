import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { SignupValueHero } from "@/components/auth/SignupValueHero";
import { SignUpForm } from "../form";

export const dynamic = "force-dynamic";

export default async function SignUpOrganizerPage() {
  const [t, tCommon] = await Promise.all([
    getTranslations("auth.signUp"),
    getTranslations("auth.common"),
  ]);

  return (
    <main className="flex min-h-screen bg-neutral-50">
      {/* Left navy value-prop panel — hidden below lg */}
      <SignupValueHero
        labels={{
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
        }}
      />

      {/* Right form column — `justify-center` centers the form card inside
          the remaining space so on ultra-wide viewports the card doesn't
          float with a wall of whitespace on one side. */}
      <div className="flex flex-1 justify-center overflow-y-auto px-6 py-12 lg:py-16">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
            {tCommon("backHome")}
          </Link>

          <Card className="border-border bg-card shadow-brand">
            <CardHeader className="flex flex-col items-start gap-4 pb-2 lg:hidden">
              <Logo variant="wordmark" className="h-7 w-auto" />
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-brand-navy-900">
                  {t("title")}
                </h1>
                <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
              </div>
            </CardHeader>

            <CardHeader className="hidden flex-col items-start gap-2 pb-2 lg:flex">
              <h1 className="text-3xl font-extrabold tracking-tight text-brand-navy-900">
                {t("title")}
              </h1>
              <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            </CardHeader>

            <CardContent className="flex flex-col gap-5">
              <div
                role="note"
                className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-relaxed text-amber-900"
              >
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{t("autoConfirmNotice")}</span>
              </div>

              <SignUpForm
                role="organizer"
                labels={{
                  fullNameLabel: t("fullNameLabel"),
                  fullNamePlaceholder: t("fullNamePlaceholder"),
                  emailLabel: t("emailLabel"),
                  emailPlaceholder: t("emailPlaceholder"),
                  passwordLabel: t("passwordLabel"),
                  passwordPlaceholder: t("passwordPlaceholder"),
                  passwordHint: t("passwordHint"),
                  submit: t("submit"),
                  submitting: t("submitting"),
                  errorFullName: t("errorFullName"),
                  errorEmail: t("errorEmail"),
                  errorPassword: t("errorPassword"),
                }}
              />

              <p className="text-center text-sm text-muted-foreground">
                {t("haveAccount")}{" "}
                <Link
                  href="/sign-in"
                  className="font-semibold text-brand-cobalt-500 transition-colors hover:text-brand-cobalt-400"
                >
                  {t("signIn")}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
