import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";

export async function PublicNav() {
  const nav = await getTranslations("nav");
  return (
    <header className="border-b border-border bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          aria-label="Sevent home"
          className="flex items-center gap-2"
        >
          <Logo variant="wordmark" className="h-8 w-auto" />
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/categories"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {nav("browse")}
          </Link>
          <LanguageSwitcher />
          <Button asChild variant="outline" size="sm">
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
