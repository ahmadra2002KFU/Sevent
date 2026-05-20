import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Building2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAsIndividualAction } from "@/app/(onboarding)/organizer/onboarding/company-choice/actions";

/**
 * Slim, dismissible onramp shown at the top of `/organizer/dashboard` while
 * `profiles.organizer_legal_type IS NULL` (organizer hasn't declared a path).
 *
 * The primary, always-available entry into company creation now lives in the
 * account dropdown ("Register a company"); this hint is just a lightweight
 * nudge. Dismissing it reuses `markAsIndividualAction`, which flips
 * legal_type NULL→'individual' server-side so the hint stays gone on every
 * device — and 'individual' behaves identically to NULL (the dashboard works
 * the same). The user can still register a company anytime from the dropdown.
 */
export async function OrganizerOnboardingBanner() {
  const t = await getTranslations("organizer.dashboard.onboardingBanner");

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-gold-100 bg-brand-gold-100/40 px-4 py-3">
      <Building2
        className="size-5 shrink-0 text-brand-cobalt-500"
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-sm text-brand-navy-900">{t("hint")}</p>
      <div className="flex items-center gap-1.5">
        <Button asChild size="sm" className="shrink-0">
          <Link href="/organizer/onboarding/company">{t("register")}</Link>
        </Button>
        <form action={markAsIndividualAction}>
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="shrink-0"
            aria-label={t("dismiss")}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </form>
      </div>
    </div>
  );
}
