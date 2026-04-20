// Sprint 4 Lane 0 stub — Lane 3 (frontend-developer) replaces with the
// quote comparison table + acceptQuoteAction + conflict-badge preflight.

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function OrganizerQuotesComparisonPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Quotes</h1>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        RFQ {id} — Sprint 4 Lane 3 will render the comparison + accept flow here.
      </p>
    </main>
  );
}
