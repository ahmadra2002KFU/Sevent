import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Legacy /supplier/onboarding route — kept as a permanent redirect so
 * inbound links (older notification deep-links, bookmarks, internal
 * redirects from before this migration) keep working. The wizard itself
 * now lives as the "Settings" tab on /supplier/profile (see
 * `(supplier)/supplier/profile/ProfilePageTabs.tsx`).
 */
export default function SupplierOnboardingLegacyRedirect() {
  redirect("/supplier/profile?tab=settings");
}
