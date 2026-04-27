import { OnboardingTopbar } from "@/components/supplier/onboarding/OnboardingTopbar";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";

/**
 * Onboarding-only chrome. Sits outside the `(supplier)` route group so
 * supplier onboarding routes do NOT inherit the full `TopNav` — the mock
 * specifies a focused, task-oriented top bar with just logo / language /
 * save-and-exit / avatar until the supplier finishes registration.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-neutral-50">
      <OnboardingTopbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <FeedbackWidget />
    </div>
  );
}
