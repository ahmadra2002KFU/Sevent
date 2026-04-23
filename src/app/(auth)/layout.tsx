import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAccessForUser } from "@/lib/auth/access";

/**
 * Bounce already-authenticated visitors away from /sign-in and /sign-up. The
 * proxy only gates role-prefixed routes, so without this guard the browser
 * back button (or a bookmarked link) would render the sign-in form to a
 * logged-in user and look like a silent logout. Reuses the same resolver
 * that `signInAction` calls, so the landing destination is consistent.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const decision = await resolveAccessForUser(user.id);
    if (decision.state !== "unauthenticated") {
      redirect(decision.bestDestination);
    }
  }

  return <>{children}</>;
}
