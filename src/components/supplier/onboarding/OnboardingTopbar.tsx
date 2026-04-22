import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/nav/LanguageSwitcher";
import { UserMenu } from "@/components/nav/UserMenu";
import { authenticateAndGetAdminClient } from "@/lib/supabase/server";

/**
 * Focused onboarding chrome. Mirrors the Direction-A mock's `ATopbar`:
 * minimal logo + language toggle + save-and-exit + avatar, with no app
 * navigation. Used as the top bar for the `(onboarding)` route group so
 * suppliers stay in a task-oriented shell until they finish registration.
 */
export async function OnboardingTopbar() {
  const auth = await authenticateAndGetAdminClient();
  const tCommon = await getTranslations("auth.common");

  let displayName: string | null = null;
  let email = "";
  if (auth) {
    email = auth.user.email ?? "";
    const { data } = await auth.admin
      .from("profiles")
      .select("full_name")
      .eq("id", auth.user.id)
      .maybeSingle();
    displayName = (data as { full_name?: string } | null)?.full_name ?? null;
  }

  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-6">
        <Link
          href="/"
          aria-label="Sevent home"
          className="flex min-h-[44px] items-center"
        >
          <Logo variant="wordmark" className="h-6 w-auto" />
        </Link>

        <div className="flex-1" />

        <Link
          href="/supplier/dashboard"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {tCommon("saveAndExit")}
        </Link>

        <div className="mx-1 h-6 w-px bg-border" aria-hidden />

        <LanguageSwitcher tone="light" />

        {auth ? (
          <UserMenu email={email} displayName={displayName} tone="light" />
        ) : null}
      </div>
    </header>
  );
}
