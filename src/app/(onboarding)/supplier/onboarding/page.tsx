import { redirect } from "next/navigation";
import { loadOnboardingBootstrap } from "./loader";
import { OnboardingWizard } from "./wizard";

export const dynamic = "force-dynamic";

/**
 * Wizard entry. The per-step heading + subtitle lives inside the wizard
 * itself (see `wizard.tsx`) because the step is client-side state. The
 * onboarding shell (logo, save-and-exit, language, avatar) is provided
 * by `(onboarding)/supplier/onboarding/layout.tsx`.
 */
export default async function SupplierOnboardingPage() {
  const bootstrap = await loadOnboardingBootstrap();

  // The wizard hard-codes a `legal_type` fallback when none is set, which
  // silently skips the path picker. Redirect instead so users always see the
  // freelancer-vs-company choice before the wizard mounts.
  if (!bootstrap.supplier || !bootstrap.supplier.legal_type) {
    redirect("/supplier/onboarding/path");
  }

  return <OnboardingWizard bootstrap={bootstrap} />;
}
