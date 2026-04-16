type PageProps = {
  params: Promise<{ parent: string }>;
};

export default async function Page({ params }: PageProps) {
  const { parent: _parent } = await params;
  return <p>Category detail — built in Sprint 3 Lane 1.</p>;
}
