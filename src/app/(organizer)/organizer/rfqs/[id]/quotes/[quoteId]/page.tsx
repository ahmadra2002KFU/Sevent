// Sprint 4 Lane 0 stub — Lane 3 (frontend-developer) replaces with the
// full snapshot-detail view of a single quote.

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string; quoteId: string }> };

export default async function OrganizerQuoteDetailPage({ params }: PageProps) {
  const { id, quoteId } = await params;
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Quote</h1>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        RFQ {id} · Quote {quoteId} — Sprint 4 Lane 3 will render the full snapshot here.
      </p>
    </main>
  );
}
