export default function SupplierOnboardingPage() {
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Onboarding</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Lane 1 (backend-architect) owns this route. 3-step wizard: business
          info → document upload → base location + service area + capacity.
        </p>
      </header>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Stub — implementation lands in Sprint 2 · Lane 1.
      </p>
    </section>
  );
}
