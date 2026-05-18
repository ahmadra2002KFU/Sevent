import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth/access";
import type { SupportedLocale } from "@/lib/domain/formatDate";
import { CompanyForm } from "./company-form";

export const dynamic = "force-dynamic";

/**
 * Company-creation form. Reachable from /organizer/onboarding/company-choice
 * (user picked "set up company") OR via auto-redirect when the resolver puts
 * the user in `organizer.no_company` state (legal_type='company', no
 * memberships).
 *
 * Gating: requireAccess("organizer.onboarding") admits both
 * `organizer.active` and `organizer.no_company`, which together cover the
 * two reachable paths. Other states bounce to bestDestination.
 */
export default async function OrganizerOnboardingCompanyPage() {
  await requireAccess("organizer.onboarding");
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("organizer.onboarding.company");

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-10">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/organizer/onboarding/company-choice">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t("backToChoice")}
        </Link>
      </Button>

      <header className="flex flex-col gap-1 border-b pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-brand-navy-900 sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <CompanyForm defaultLanguage={locale === "ar" ? "ar" : "en"} />
    </section>
  );
}
