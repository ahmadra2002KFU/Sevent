import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth/access";
import { loadOnboardingBootstrap } from "./loader";
import { OnboardingWizard } from "./wizard";

export const dynamic = "force-dynamic";

/**
 * Wizard entry. The per-step heading + subtitle lives inside the wizard
 * itself (see `wizard.tsx`) because the step is client-side state. The
 * onboarding shell (logo, save-and-exit, language, avatar) is provided
 * by `(onboarding)/supplier/onboarding/layout.tsx`.
 *
 * Gate: `supplier.onboarding.wizard` admits in_onboarding / pending_review /
 * approved / rejected — any state with an existing suppliers row. A fresh
 * `supplier.no_row` user is redirected by requireAccess to the path picker.
 */
export default async function SupplierOnboardingPage() {
  const { admin, decision, user } = await requireAccess(
    "supplier.onboarding.wizard",
  );

  const bootstrap = await loadOnboardingBootstrap({
    admin,
    supplierId: decision.supplierId,
    userId: user.id,
  });

  // Defence-in-depth: the resolver already redirects `supplier.no_row` users
  // away from the wizard, so this fallback only fires on a race window
  // between the resolver read and the bootstrap read.
  if (!bootstrap.supplier || !bootstrap.supplier.legal_type) {
    redirect("/supplier/onboarding/path");
  }

  return <OnboardingWizard bootstrap={bootstrap} />;
}
