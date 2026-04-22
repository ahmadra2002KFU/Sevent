import { OnboardingTopbar } from "@/components/supplier/onboarding/OnboardingTopbar";

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
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <OnboardingTopbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
