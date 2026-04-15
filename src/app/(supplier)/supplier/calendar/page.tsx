export default function SupplierCalendarPage() {
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Lane 4 (frontend-developer) owns this route. Read-only month view +
          form-based manual block add/edit/delete.
        </p>
      </header>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Stub — implementation lands in Sprint 2 · Lane 4.
      </p>
    </section>
  );
}
