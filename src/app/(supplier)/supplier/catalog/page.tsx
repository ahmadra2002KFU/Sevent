import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { loadCatalogBootstrap } from "./loader";
import { CatalogClient } from "./catalog-client";

export const dynamic = "force-dynamic";

export default async function SupplierCatalogPage() {
  const t = await getTranslations("supplier.catalog");
  const bootstrap = await loadCatalogBootstrap();

  if (!bootstrap.ok) {
    return (
      <section className="flex flex-col gap-4">
        <header>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
        </header>
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {bootstrap.error}
        </p>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          <Link
            href="/supplier/onboarding"
            className="underline hover:text-[var(--color-foreground)]"
          >
            {t("goToOnboarding")}
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t("subtitle")}
        </p>
        <p className="mt-1 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-xs text-[var(--color-muted-foreground)]">
          <span className="font-mono text-[10px]">{bootstrap.supplier.slug}</span>
          <span aria-hidden>·</span>
          <span>
            {t("statusLabel")}:{" "}
            <span className="font-medium text-[var(--color-foreground)]">
              {bootstrap.supplier.verification_status}
            </span>
          </span>
          {bootstrap.supplier.is_published ? (
            <>
              <span aria-hidden>·</span>
              <Link
                href={`/s/${bootstrap.supplier.slug}`}
                className="underline hover:text-[var(--color-foreground)]"
                prefetch={false}
              >
                {t("viewPublic")}
              </Link>
            </>
          ) : null}
        </p>
      </header>

      <CatalogClient
        supplierId={bootstrap.supplier.id}
        packages={bootstrap.packages}
        rules={bootstrap.rules}
        subcategories={bootstrap.subcategories}
      />
    </section>
  );
}
