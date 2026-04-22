import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/nav/LanguageSwitcher";

/**
 * Persistent footer for the public surface. Uses neutral-100 as a warm,
 * low-contrast platform band under the main content. Grid layout: logo +
 * tagline on the start edge, two quick-link columns, language switch trailing.
 */
export async function PublicFooter() {
  const [brand, nav, footer] = await Promise.all([
    getTranslations("brand"),
    getTranslations("nav"),
    getTranslations("public.footer"),
  ]);

  return (
    <footer className="mt-24 border-t border-border bg-neutral-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <div className="flex flex-col gap-3">
          <Logo variant="wordmark" className="h-8 w-auto" />
          <p className="max-w-xs text-sm text-muted-foreground">
            {brand("tagline")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-navy-900">
            {footer("exploreHeading")}
          </p>
          <Link
            href="/categories"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {nav("browse")}
          </Link>
          <Link
            href="/sign-up?role=organizer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {footer("organizerLink")}
          </Link>
          <Link
            href="/sign-up/supplier"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {footer("supplierLink")}
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-navy-900">
            {footer("accountHeading")}
          </p>
          <Link
            href="/sign-in"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {nav("signIn")}
          </Link>
          <Link
            href="/sign-up"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {nav("signUp")}
          </Link>
        </div>

        <div className="flex flex-col items-start gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-navy-900">
            {footer("languageHeading")}
          </p>
          <LanguageSwitcher />
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {brand("name")}. {footer("rightsReserved")}
          </p>
          <p>{footer("pilotNote")}</p>
        </div>
      </div>
    </footer>
  );
}
