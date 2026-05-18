import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Building2, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccess } from "@/lib/auth/access";
import { markAsIndividualAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Post-signup choice page. Reachable from a "Set up company" CTA on the
 * dashboard or via direct navigation. Renders three mutually-exclusive paths:
 *
 *   1. Continue as individual — flips legal_type=NULL → 'individual' and
 *      sends the user to the dashboard. The current dashboard surface is
 *      unchanged for individuals.
 *   2. Set up a company — links to /organizer/onboarding/company which runs
 *      create_organizer_company_tx on submit.
 *   3. I was invited — informational; the actual accept flow runs from the
 *      invite link in the email (PR 5).
 *
 * Page-level gating: requireAccess admits both `organizer.active` and
 * `organizer.no_company`, but a user already in `organizer.no_company` would
 * be middleware-redirected to /organizer/onboarding/company before reaching
 * this route. Profiles with legal_type already set are bounced to the
 * dashboard so the choice isn't re-presented.
 */
export default async function OrganizerOnboardingCompanyChoicePage() {
  const { user, admin } = await requireAccess("organizer.onboarding");
  const t = await getTranslations("organizer.onboarding.companyChoice");

  // Short-circuit if the user has already declared a legal_type. Brand-new
  // organizers (legal_type=NULL) are the only audience for this page.
  const { data: profileRow } = await admin
    .from("profiles")
    .select("organizer_legal_type")
    .eq("id", user.id)
    .maybeSingle();
  const legalType = (
    profileRow as { organizer_legal_type?: string | null } | null
  )?.organizer_legal_type;
  if (legalType === "individual") {
    redirect("/organizer/dashboard");
  }
  if (legalType === "company") {
    // no_company resolver state already routes here, but explicit redirect
    // catches the edge case where someone declared company without yet
    // creating one and lands on /company-choice via a stale link.
    redirect("/organizer/onboarding/company");
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-10">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-brand-navy-900">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-1">
        {/* Individual */}
        <Card>
          <CardHeader className="flex flex-row items-start gap-4 pb-3">
            <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-cobalt-100 text-brand-cobalt-500">
              <UserRound className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">{t("individualLabel")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("individualDescription")}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form action={markAsIndividualAction}>
              <Button type="submit" variant="outline">
                {t("individualCta")}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Company */}
        <Card>
          <CardHeader className="flex flex-row items-start gap-4 pb-3">
            <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-gold-100 text-brand-gold-500">
              <Building2 className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">{t("companyLabel")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("companyDescription")}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/organizer/onboarding/company">
                {t("companyCta")}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Invited */}
        <Card>
          <CardHeader className="flex flex-row items-start gap-4 pb-3">
            <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Mail className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">{t("inviteLabel")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("inviteDescription")}
              </p>
            </div>
          </CardHeader>
        </Card>
      </div>
    </section>
  );
}
