import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SignUpMenu } from "./SignUpMenu";

/**
 * Public surface top nav. Landing-section links are `/#anchor` hashes so they
 * jump straight to the matching section heading id on `/`, and still behave
 * (navigate home) when invoked from a nested public page like /categories.
 */
export async function PublicNav() {
  const nav = await getTranslations("nav");
  return (
    <header className="border-b border-border bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          aria-label="Sevent home"
          className="flex min-w-0 items-center gap-2"
        >
          <Logo variant="wordmark" className="h-7 w-auto shrink-0 sm:h-8" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/categories"
            className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
          >
            {nav("browse")}
          </Link>
          <Link
            href="/#how-heading"
            className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
          >
            {nav("howItWorks")}
          </Link>
          <Link
            href="/#supplier-showcase-heading"
            className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
          >
            {nav("forSuppliers")}
          </Link>
          <Link
            href="/#faq-heading"
            className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
          >
            {nav("faq")}
          </Link>
          <LanguageSwitcher />
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link href="/sign-in">{nav("signIn")}</Link>
          </Button>
          <SignUpMenu
            triggerLabel={nav("signUp")}
            organizerLabel={nav("signUpAsOrganizer")}
            supplierLabel={nav("signUpAsSupplier")}
            organizerHint={nav("signUpAsOrganizerHint")}
            supplierHint={nav("signUpAsSupplierHint")}
          />
        </nav>
      </div>
    </header>
  );
}
