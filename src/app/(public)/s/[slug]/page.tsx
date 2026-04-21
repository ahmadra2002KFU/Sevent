import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatHalalas } from "@/lib/domain/money";
import { getPublicSupplierBySlug } from "@/lib/domain/supplierProfile";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const supplier = await getPublicSupplierBySlug(slug);
  if (!supplier) return { title: "Supplier not found · Sevent" };
  return {
    title: `${supplier.business_name} · Sevent`,
    description:
      supplier.bio ??
      `Verified Sevent supplier in ${supplier.base_city}. View packages and book with a digital contract.`,
  };
}

export default async function PublicSupplierProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const [t, brand, supplier] = await Promise.all([
    getTranslations("public.supplier"),
    getTranslations("brand"),
    getPublicSupplierBySlug(slug),
  ]);

  if (!supplier) notFound();

  const hasReviews = supplier.reviewSummary.count > 0;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-sevent-gold)]">
          {brand("name")} · {t("profileEyebrow")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {supplier.business_name}
          </h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-sevent-green)]/10 px-3 py-1 text-xs font-medium text-[var(--color-sevent-green)]">
            <span aria-hidden>✓</span>
            {t("verifiedBadge")}
          </span>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-muted-foreground)]">
          <span>{t("baseCity", { city: supplier.base_city })}</span>
          {supplier.service_area_cities.length > 0 ? (
            <span>
              {t("serviceArea", {
                cities: supplier.service_area_cities.join(", "),
              })}
            </span>
          ) : null}
          {supplier.languages.length > 0 ? (
            <span>{t("languages", { list: supplier.languages.join(", ") })}</span>
          ) : null}
        </p>
        {supplier.bio ? (
          <p className="max-w-3xl text-sm leading-relaxed text-[var(--color-foreground)]">
            {supplier.bio}
          </p>
        ) : null}
        {supplier.subcategories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {supplier.subcategories.map((s) => (
              <span
                key={s.id}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-3 py-1 text-xs"
              >
                {s.parent_name_en ? `${s.parent_name_en} · ` : ""}
                {s.name_en}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      {/* ============================== Portfolio ============================== */}
      <section aria-label={t("portfolioHeading")} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("portfolioHeading")}
        </h2>
        {supplier.media.length === 0 ? (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4 text-sm text-[var(--color-muted-foreground)]">
            {t("noPortfolio")}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {supplier.media.map((m) => (
              <li
                key={m.id}
                className="relative aspect-square overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]"
              >
                {/* Using next/image with `unoptimized` because the storage host */}
                {/* is not whitelisted in next.config; behaves like a plain <img>. */}
                <Image
                  src={m.public_url}
                  alt={m.title ?? supplier.business_name}
                  fill
                  unoptimized
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="object-cover"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ============================== Packages =============================== */}
      <section aria-label={t("packagesHeading")} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("packagesHeading")}
        </h2>
        {supplier.packages.length === 0 ? (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4 text-sm text-[var(--color-muted-foreground)]">
            {t("noPackages")}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {supplier.packages.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {t(`packageUnit.${p.unit}`)} · {t("qtyRange", {
                        min: p.min_qty,
                        max: p.max_qty ?? "∞",
                      })}
                    </p>
                  </div>
                  {p.from_price_visible ? (
                    <div className="text-end">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                        {t("fromLabel")}
                      </p>
                      <p className="text-lg font-semibold">
                        {formatHalalas(p.base_price_halalas)}
                      </p>
                    </div>
                  ) : null}
                </div>
                {p.description ? (
                  <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                    {p.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ============================== Reviews =============================== */}
      <section aria-label={t("reviewsHeading")} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("reviewsHeading")}
        </h2>
        {hasReviews ? (
          <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-white p-4">
            <span className="text-3xl font-semibold">
              {supplier.reviewSummary.average_overall?.toFixed(1)}
            </span>
            <span aria-hidden className="text-2xl text-[var(--color-sevent-gold)]">
              ★
            </span>
            <span className="text-sm text-[var(--color-muted-foreground)]">
              {t("reviewsCount", { count: supplier.reviewSummary.count })}
            </span>
          </div>
        ) : (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4 text-sm text-[var(--color-muted-foreground)]">
            {t("noReviews")}
          </p>
        )}
      </section>

      <footer className="border-t border-[var(--color-border)] pt-6 text-xs text-[var(--color-muted-foreground)]">
        <Link href="/" className="underline hover:text-[var(--color-foreground)]">
          {t("backToHome")}
        </Link>
      </footer>
    </main>
  );
}
