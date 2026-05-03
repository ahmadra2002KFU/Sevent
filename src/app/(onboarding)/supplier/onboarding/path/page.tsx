import { getTranslations } from "next-intl/server";
import { requireAccess } from "@/lib/auth/access";
import { PathClient, type PathClientLabels } from "./PathClient";

export const dynamic = "force-dynamic";

/**
 * Screen 2 — path picker. Sits between sign-up and the 3-step wizard so the
 * first wizard step already knows whether to ask for CR vs National ID.
 *
 * Gate: `supplier.onboarding.path` is only admitted for `supplier.no_row`;
 * any supplier who already has a row (legal_type present → in_onboarding /
 * pending_review / approved / rejected) gets redirected to their
 * bestDestination by requireAccess. This prevents an approved supplier from
 * re-picking their path and overwriting legal_type.
 */
export default async function SupplierOnboardingPathPage() {
  await requireAccess("supplier.onboarding.path");

  const t = await getTranslations("supplier.onboarding.path");

  const labels: PathClientLabels = {
    eyebrow: t("eyebrow"),
    title: t("title"),
    sub: t("sub"),
    needsTitle: t("needsTitle"),
    etaPrefix: t("etaPrefix"),
    etaSuffix: t("etaSuffix"),
    cta: t("cta"),
    ctaLoading: t("ctaLoading"),
    back: t("back"),
    freelancer: {
      title: t("freelancer.title"),
      desc: t("freelancer.desc"),
      steps: [
        t("freelancer.stepNationalId"),
        t("freelancer.stepIban"),
        t("freelancer.stepBio"),
      ],
      eta: t("freelancer.eta"),
    },
    company: {
      title: t("company.title"),
      desc: t("company.desc"),
      steps: [
        t("company.stepCr"),
        t("company.stepIban"),
        t("company.stepProfile"),
      ],
      eta: t("company.eta"),
      tag: t("company.tag"),
    },
  };

  return <PathClient labels={labels} />;
}
