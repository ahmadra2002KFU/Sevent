export default function AdminVerificationsPage() {
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Verifications queue</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Lane 3 (general-purpose) owns this route. Review supplier docs;
          approve/reject with notes; triggers approval/rejection emails.
        </p>
      </header>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Stub — implementation lands in Sprint 2 · Lane 3.
      </p>
    </section>
  );
}
