// Sprint 4 Lane 0 stub — Lane 4 (general-purpose) replaces with the
// read-only organizer bookings list (RFQ, supplier, status, confirm deadline).

export const dynamic = "force-dynamic";

export default function OrganizerBookingsListPage() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Bookings</h1>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        Sprint 4 Lane 4 will render bookings tied to your events here.
      </p>
    </main>
  );
}
