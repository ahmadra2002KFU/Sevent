type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PublicSupplierProfilePage({ params }: PageProps) {
  const { slug } = await params;
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-sevent-gold)]">
          Supplier profile
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          /s/{slug}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Lane 2 (frontend-developer) owns this route. Portfolio, active
          packages with &ldquo;from&rdquo; prices, verified badge, bio,
          languages, published reviews.
        </p>
      </header>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Stub — implementation lands in Sprint 2 · Lane 2.
      </p>
    </main>
  );
}
