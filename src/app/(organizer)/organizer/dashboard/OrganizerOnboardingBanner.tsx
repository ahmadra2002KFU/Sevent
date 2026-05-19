import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Building2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { markAsIndividualAction } from "../onboarding/company-choice/actions";

/**
 * Post-signup choice surface, rendered inline at the top of
 * `/organizer/dashboard` when `profiles.organizer_legal_type IS NULL`.
 *
 * Without this banner the choice flow lived only at the dedicated
 * `/organizer/onboarding/company-choice` URL, which was never linked from
 * the dashboard — new signups landed on the dashboard with no visible
 * onramp into the company path (PR 7 follow-up: discoverability hole).
 *
 * The banner is intentionally lightweight: two parallel CTAs (one link,
 * one form-action) and a single sentence of copy. Once the user picks,
 * `organizer_legal_type` flips away from NULL and the banner disappears
 * on the next render.
 */
export async function OrganizerOnboardingBanner() {
  const t = await getTranslations("organizer.dashboard.onboardingBanner");

  return (
    <Card className="border-brand-gold-100 bg-gradient-to-br from-brand-gold-100/60 to-brand-cobalt-100/40">
      <CardContent className="flex flex-col gap-5 p-6 sm:p-7">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold tracking-tight text-brand-navy-900 sm:text-xl">
            {t("title")}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            asChild
            size="lg"
            className="h-auto justify-start gap-3 px-4 py-3"
          >
            <Link href="/organizer/onboarding/company">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white/15 text-white">
                <Building2 className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col items-start text-left">
                <span className="text-sm font-semibold leading-tight">
                  {t("companyLabel")}
                </span>
                <span className="text-[11px] font-normal text-white/85">
                  {t("companyHint")}
                </span>
              </span>
              <ArrowRight
                className="ms-auto size-4 shrink-0 rtl:rotate-180"
                aria-hidden
              />
            </Link>
          </Button>

          <form action={markAsIndividualAction}>
            <Button
              type="submit"
              variant="outline"
              size="lg"
              className="h-auto w-full justify-start gap-3 border-brand-navy-900/15 bg-white px-4 py-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-cobalt-100 text-brand-cobalt-500">
                <UserRound className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col items-start text-left">
                <span className="text-sm font-semibold leading-tight text-brand-navy-900">
                  {t("individualLabel")}
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {t("individualHint")}
                </span>
              </span>
              <ArrowRight
                className="ms-auto size-4 shrink-0 text-muted-foreground rtl:rotate-180"
                aria-hidden
              />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
