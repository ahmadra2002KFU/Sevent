import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAccess } from "@/lib/auth/access";
import { ChoiceClient, type ChoiceClientLabels } from "./ChoiceClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Post-signup choice screen. The brand-new organizer is routed here from the
 * auth callback (and via the dashboard onboarding banner). Renders three
 * mutually-exclusive paths inside the focused onboarding shell:
 *
 *   1. Continue as individual — flips legal_type NULL → 'individual' and sends
 *      the user to the dashboard.
 *   2. Set up a company — links to /organizer/onboarding/company.
 *   3. I was invited — paste the invite link from the email to jump to the
 *      hardened accept page.
 *
 * Self-heal: profiles that already declared a legal_type are bounced away so
 * the choice isn't re-presented (individual → dashboard, company → /company).
 */
export default async function OrganizerOnboardingCompanyChoicePage({
  searchParams,
}: PageProps) {
  const { user, admin } = await requireAccess("organizer.onboarding");
  const t = await getTranslations("organizer.onboarding.companyChoice");
  const params = await searchParams;

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
    redirect("/organizer/onboarding/company");
  }

  const labels: ChoiceClientLabels = {
    title: t("title"),
    sub: t("subtitle"),
    needsTitle: t("needsTitle"),
    etaPrefix: t("etaPrefix"),
    continueCta: t("continueCta"),
    continueLoading: t("continueLoading"),
    individual: {
      title: t("individualLabel"),
      desc: t("individualDescription"),
      steps: [
        t("individualStep1"),
        t("individualStep2"),
        t("individualStep3"),
      ],
      eta: t("individualEta"),
    },
    company: {
      title: t("companyLabel"),
      desc: t("companyDescription"),
      steps: [t("companyStep1"), t("companyStep2"), t("companyStep3")],
      eta: t("companyEta"),
      tag: t("companyTag"),
    },
    invited: {
      title: t("inviteLabel"),
      desc: t("inviteDescription"),
      steps: [t("inviteStep1"), t("inviteStep2")],
      eta: t("inviteEta"),
    },
    invite: {
      pasteLabel: t("invitePasteLabel"),
      pastePlaceholder: t("invitePastePlaceholder"),
      pasteCta: t("invitePasteCta"),
      pasteError: t("invitePasteError"),
      help: t("inviteHelp"),
    },
  };

  const initialError = params.error === "db" ? t("individualError") : null;

  return <ChoiceClient labels={labels} initialError={initialError} />;
}
