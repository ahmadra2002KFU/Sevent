import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/nav/LanguageSwitcher";
import { UserMenu } from "@/components/nav/UserMenu";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Focused onboarding chrome. Mirrors the Direction-A mock's `ATopbar`:
 * minimal logo + language toggle + save-and-exit + avatar, with no app
 * navigation. Used as the top bar for the `(onboarding)` route group so
 * suppliers (and now organizers) stay in a task-oriented shell until they
 * finish registration.
 *
 * `homeHref`/`exitHref` default to the supplier surfaces for backwards
 * compatibility; the organizer onboarding layout passes its own targets so
 * the same chrome serves both funnels without a duplicate component.
 */
export async function OnboardingTopbar({
  homeHref = "/supplier/onboarding",
  exitHref = "/supplier/dashboard",
}: {
  homeHref?: string;
  exitHref?: string;
} = {}) {
  const [user, tCommon] = await Promise.all([
    getCurrentUser(),
    getTranslations("auth.common"),
  ]);

  const email = user?.email ?? "";

  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Link
          href={homeHref}
          prefetch={false}
          aria-label="Sevent home"
          className="flex min-h-[44px] shrink-0 items-center"
        >
          <Logo variant="wordmark" className="h-5 w-auto sm:h-6" />
        </Link>

        <div className="flex-1" />

        <Link
          href={exitHref}
          prefetch={false}
          className="hidden whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
        >
          {tCommon("saveAndExit")}
        </Link>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />

        <LanguageSwitcher tone="light" />

        {user ? (
          <UserMenu email={email} displayName={null} tone="light" />
        ) : null}
      </div>
    </header>
  );
}
