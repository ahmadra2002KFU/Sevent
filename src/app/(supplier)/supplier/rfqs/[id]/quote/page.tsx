// Sprint 4 Lane 0 stub — Lane 2 (frontend-developer) replaces with the
// real QuoteBuilderForm + sendQuoteAction. Kept as a stub so routing,
// typecheck, and next build stay green after Lane 0.

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function SupplierQuoteBuilderPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Quote builder</h1>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        RFQ {id} — Sprint 4 Lane 2 will land the real builder here.
      </p>
    </main>
  );
}
