// Sprint 4 Lane 0 stub — Lane 4 (general-purpose) replaces with the booking
// detail page (read-only in Sprint 4; Sprint 5 adds confirm/decline actions).

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function SupplierBookingDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Booking</h1>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        Booking {id} — Sprint 4 Lane 4 renders the quote snapshot + confirm deadline here.
      </p>
    </main>
  );
}
