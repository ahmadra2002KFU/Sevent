import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import type { SupplierVerificationStatus } from "@/lib/supabase/types";
import { loadOnboardingBootstrap } from "./loader";
import { OnboardingWizard } from "./wizard";

export const dynamic = "force-dynamic";

function verificationPill(
  status: SupplierVerificationStatus,
  t: (key: string) => string,
) {
  if (status === "approved") {
    return (
      <StatusPill status="approved" label={t("verification.approved")} />
    );
  }
  if (status === "rejected") {
    return <StatusPill status="rejected" label={t("verification.rejected")} />;
  }
  return <StatusPill status="pending" label={t("verification.pending")} />;
}

export default async function SupplierOnboardingPage() {
  const [t, tDashboard, bootstrap] = await Promise.all([
    getTranslations("supplier.onboarding"),
    getTranslations("supplier.dashboard"),
    loadOnboardingBootstrap(),
  ]);

  // The wizard hard-codes a `legal_type` fallback when none is set, which
  // silently skips the path picker. Redirect instead so users always see the
  // freelancer-vs-company choice before the wizard mounts.
  if (!bootstrap.supplier || !bootstrap.supplier.legal_type) {
    redirect("/supplier/onboarding/path");
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          bootstrap.supplier
            ? verificationPill(
                bootstrap.supplier
                  .verification_status as SupplierVerificationStatus,
                tDashboard,
              )
            : null
        }
      />

      <OnboardingWizard bootstrap={bootstrap} />
    </section>
  );
}
