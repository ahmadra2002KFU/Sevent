import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CITY_OPTIONS } from "@/lib/domain/events";
import {
  getParentCategoryBySlug,
  listSubcategoriesWithSuppliers,
} from "@/lib/domain/publicBrowse";

type PageProps = {
  params: Promise<{ parent: string }>;
  searchParams: Promise<{ city?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { parent: parentSlug } = await params;
  const parent = await getParentCategoryBySlug(parentSlug);
  if (!parent) return { title: "Category not found · Sevent" };
  return {
    title: `${parent.name_en} · Sevent`,
    description: `Browse verified ${parent.name_en} suppliers in Saudi Arabia.`,
  };
}

function normalizeCity(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = CITY_OPTIONS.find((c) => c === raw);
  return match ?? null;
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ parent: parentSlug }, rawSearch] = await Promise.all([
    params,
    searchParams,
  ]);

  const parent = await getParentCategoryBySlug(parentSlug);
  if (!parent) notFound();

  const city = normalizeCity(rawSearch.city);

  const [tCats, tSearch, brand, subcategories] = await Promise.all([
    getTranslations("public.categories"),
    getTranslations("public.search"),
    getTranslations("brand"),
    listSubcategoriesWithSuppliers(parent.id, city),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-sevent-gold)]">
          {brand("name")}
        </p>
        <Link
          href="/categories"
          className="text-sm text-[var(--color-muted-foreground)] underline hover:text-[var(--color-foreground)]"
        >
          ← {tCats("title")}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          {parent.name_en}
        </h1>
      </header>

      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{tSearch("cityFilterLabel")}</span>
          <select
            name="city"
            defaultValue={city ?? ""}
            className="min-w-[12rem] rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            <option value="">{tSearch("allCities")}</option>
            {CITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-[var(--color-sevent-green)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {tSearch("cityFilterLabel")} →
        </button>
      </form>

      {subcategories.length === 0 ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-6 text-sm text-[var(--color-muted-foreground)]">
          {tCats("empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-10">
          {subcategories.map((sub) => (
            <section key={sub.id} className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold tracking-tight">
                {tSearch("subcategoryHeading", { name: sub.name_en })}
              </h2>
              {sub.suppliers.length === 0 ? (
                <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4 text-sm text-[var(--color-muted-foreground)]">
                  {tSearch("noResults")}
                </p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {sub.suppliers.map((sup) => (
                    <li key={sup.id}>
                      <Link
                        href={`/s/${sup.slug}`}
                        className="group flex h-full flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-white transition hover:border-[var(--color-sevent-green)]/40 hover:shadow-sm"
                      >
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--color-muted)]">
                          {sup.first_photo_url ? (
                            <Image
                              src={sup.first_photo_url}
                              alt={sup.business_name}
                              fill
                              unoptimized
                              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                              className="object-cover transition group-hover:scale-[1.02]"
                            />
                          ) : (
                            <div
                              aria-hidden
                              className="absolute inset-0 flex items-center justify-center"
                              style={{
                                background:
                                  "linear-gradient(135deg, var(--color-sevent-green), var(--color-sevent-gold))",
                                opacity: 0.15,
                              }}
                            >
                              <span className="text-3xl font-semibold text-[var(--color-sevent-green)]">
                                {sup.business_name
                                  .split(/\s+/)
                                  .slice(0, 2)
                                  .map((w) => w[0])
                                  .join("")
                                  .toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-4">
                          <p className="font-medium tracking-tight">
                            {sup.business_name}
                          </p>
                          <p className="text-xs text-[var(--color-muted-foreground)]">
                            {sup.base_city}
                          </p>
                          <span className="mt-auto pt-2 text-sm font-medium text-[var(--color-sevent-green)] group-hover:underline">
                            {tSearch("viewProfile")} →
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <footer className="border-t border-[var(--color-border)] pt-6 text-xs text-[var(--color-muted-foreground)]">
        <Link href="/" className="underline hover:text-[var(--color-foreground)]">
          ← {brand("name")}
        </Link>
      </footer>
    </main>
  );
}
