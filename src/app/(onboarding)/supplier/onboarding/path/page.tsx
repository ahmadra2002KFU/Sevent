import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/supabase/server";
import { PathClient, type PathClientLabels } from "./PathClient";

export const dynamic = "force-dynamic";

/**
 * Screen 2 — path picker. Sits between sign-up and the 3-step wizard so the
 * first wizard step already knows whether to ask for CR vs National ID.
 *
 * Gate:
 *   - unauthenticated / wrong role  → `/sign-in`
 *   - supplier row already has `legal_type` → `/supplier/onboarding` (wizard)
 */
export default async function SupplierOnboardingPathPage() {
  const gate = await requireRole("supplier");
  if (gate.status === "unauthenticated") redirect("/sign-in");
  if (gate.status === "forbidden") redirect("/sign-in");

  const { user, admin } = gate;
  const { data: supplier } = await admin
    .from("suppliers")
    .select("legal_type")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (supplier?.legal_type) {
    redirect("/supplier/onboarding");
  }

  const t = await getTranslations("supplier.onboarding.path");
  const tResume = await getTranslations("supplier.onboarding.resume");

  const labels: PathClientLabels = {
    eyebrow: t("eyebrow"),
    title: t("title"),
    sub: t("sub"),
    needsTitle: t("needsTitle"),
    etaPrefix: t("etaPrefix"),
    etaSuffix: t("etaSuffix"),
    cta: t("cta"),
    back: t("back"),
    resume: {
      title: tResume("title"),
      body: tResume("body", { step: 1, total: 3 }),
      cta: tResume("cta"),
    },
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
