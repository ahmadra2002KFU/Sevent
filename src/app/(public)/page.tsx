import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const brand = await getTranslations("brand");
  const items = (t.raw("valueProp.items") as Array<{
    title: string;
    body: string;
  }>).map((item, index) => ({ ...item, key: index }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-20 px-6 py-16 sm:py-24">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-8 w-8 rounded-full"
            style={{
              background:
                "linear-gradient(135deg, var(--color-sevent-green), var(--color-sevent-gold))",
            }}
          />
          <span className="text-lg font-semibold tracking-tight">
            {brand("name")}
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/sign-in"
            className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-[var(--color-primary-foreground)] hover:opacity-90"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <section className="grid gap-10 sm:grid-cols-[1.1fr_1fr] sm:items-center">
        <div className="flex flex-col gap-6">
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-sevent-gold)]">
            {t("hero.eyebrow")}
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {t("hero.title")}
          </h1>
          <p className="max-w-xl text-lg text-[var(--color-muted-foreground)]">
            {t("hero.subtitle")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="rounded-md bg-[var(--color-primary)] px-5 py-2.5 text-[var(--color-primary-foreground)] hover:opacity-90"
            >
              {t("hero.ctaOrganizer")}
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md border border-[var(--color-border)] px-5 py-2.5 text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
            >
              {t("hero.ctaSupplier")}
            </Link>
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {t("comingSoon")}
          </p>
        </div>
        <div
          className="rounded-2xl p-8 shadow-sm"
          style={{
            background:
              "linear-gradient(160deg, var(--color-sevent-green), var(--color-sevent-dark))",
            color: "#fff",
          }}
        >
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-sevent-gold)]">
            Pilot · Riyadh + Jeddah
          </p>
          <p className="mt-3 text-2xl font-medium">
            Venues · Catering · Photography · Decor · and more.
          </p>
          <p className="mt-4 text-sm opacity-80">
            Verified suppliers. Structured requests. Digital contracts. Ratings
            tied to completed bookings.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-8">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("valueProp.heading")}
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.key}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/60 p-6"
            >
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-[var(--color-border)] pt-8 text-sm text-[var(--color-muted-foreground)]">
        © {new Date().getFullYear()} {brand("name")} · {brand("tagline")}
      </footer>
    </main>
  );
}
