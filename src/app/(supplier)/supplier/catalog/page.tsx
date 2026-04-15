export default function SupplierCatalogPage() {
  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Catalog</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Lane 2 (frontend-developer) owns this route. Packages CRUD + pricing
          rules CRUD (one Zod-validated form per rule_type).
        </p>
      </header>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Stub — implementation lands in Sprint 2 · Lane 2.
      </p>
    </section>
  );
}
