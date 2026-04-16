import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listTopLevelCategories } from "@/lib/domain/publicBrowse";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "Browse categories · Sevent",
    description:
      "Every verified Sevent supplier category. Pick a category to discover venues, catering, photography and more across Saudi Arabia.",
  };
}

export default async function CategoriesPage() {
  const [t, brand, categories] = await Promise.all([
    getTranslations("public.categories"),
    getTranslations("brand"),
    listTopLevelCategories(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-sevent-gold)]">
          {brand("name")}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-sm text-[var(--color-muted-foreground)]">
          {t("subtitle")}
        </p>
      </header>

      {categories.length === 0 ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-6 text-sm text-[var(--color-muted-foreground)]">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/categories/${c.slug}`}
                className="group flex h-full flex-col justify-between gap-4 rounded-lg border border-[var(--color-border)] bg-white p-5 transition hover:border-[var(--color-sevent-green)]/40 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {c.name_en}
                  </h2>
                  <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-[var(--color-sevent-green)]/10 px-2 py-1 text-xs font-medium text-[var(--color-sevent-green)]">
                    {c.supplier_count}
                  </span>
                </div>
                <span className="text-sm font-medium text-[var(--color-sevent-green)] group-hover:underline">
                  {t("viewSubcategory")} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="border-t border-[var(--color-border)] pt-6 text-xs text-[var(--color-muted-foreground)]">
        <Link href="/" className="underline hover:text-[var(--color-foreground)]">
          ← {brand("name")}
        </Link>
      </footer>
    </main>
  );
}
