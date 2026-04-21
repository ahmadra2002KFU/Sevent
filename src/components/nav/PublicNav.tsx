import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";

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
            className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            {nav("browse")}
          </Link>
          <LanguageSwitcher />
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link href="/sign-in">{nav("signIn")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">{nav("signUp")}</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
