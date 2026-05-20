import { OnboardingTopbar } from "@/components/supplier/onboarding/OnboardingTopbar";
import FeedbackWidgetLazy from "@/components/feedback/FeedbackWidgetLazy";

/**
 * Focused onboarding chrome for the ORGANIZER funnel. Sits outside the
 * `(organizer)` route group so onboarding routes do NOT inherit the full
 * `TopNav` — brand-new organizers stay in a task-oriented shell (logo /
 * language / save-and-exit / avatar) until they pick a path and, if relevant,
 * finish company setup. Mirrors the supplier onboarding layout; the topbar is
 * the shared component pointed at the organizer surfaces.
 */
export default function OrganizerOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-neutral-50">
      <OnboardingTopbar
        homeHref="/organizer/onboarding/company-choice"
        exitHref="/organizer/dashboard"
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <FeedbackWidgetLazy />
    </div>
  );
}
