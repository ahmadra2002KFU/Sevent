// Sprint 4 Lane 0 stub — Lane 4 (general-purpose) replaces with the
// real read-only bookings list scoped to the signed-in supplier.

export const dynamic = "force-dynamic";

export default function SupplierBookingsListPage() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Bookings</h1>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        Sprint 4 Lane 4 will render accepted quotes + their confirmation state here.
      </p>
    </main>
  );
}
