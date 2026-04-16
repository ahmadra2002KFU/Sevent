type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
  const { id: _id } = await params;
  return <p>RFQ detail (supplier) — built in Sprint 3 Lane 2.</p>;
}
