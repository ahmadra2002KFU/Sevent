import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Auth callback for Supabase email-based flows (confirmation, magic link,
 * recovery). Supabase mails a link of the form
 *
 *   {APP_URL}/auth/callback?code=<one-time-code>
 *
 * The code is exchanged for a session here so the cookie is set on the same
 * request that lands the user inside the app. Without this route the user
 * would arrive at a marketing page with no session and have to sign in
 * manually after confirming their email.
 *
 * Role-aware landing: we read `profiles.role` for the freshly-authenticated
 * user and send them to the surface that role can actually use. Anything
 * unrecognized falls back to /sign-in with a friendly confirmed=1 flag.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/sign-in?error=missing_code", request.url),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );
  if (exchangeError) {
    const msg = encodeURIComponent(exchangeError.message);
    return NextResponse.redirect(
      new URL(`/sign-in?error=${msg}`, request.url),
    );
  }

  // The session cookie is now set on the user-scoped client, so RLS lets the
  // user read their own profiles row. We deliberately do NOT use the
  // service-role client here — the callback should fail closed if the
  // just-set session can't see its own profile.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = (profile as { role: string } | null)?.role ?? null;
  }

  switch (role) {
    case "admin":
      return NextResponse.redirect(
        new URL("/admin/verifications", request.url),
      );
    case "organizer":
      return NextResponse.redirect(
        new URL("/organizer/dashboard", request.url),
      );
    case "supplier":
      return NextResponse.redirect(
        new URL("/supplier/dashboard", request.url),
      );
    default:
      return NextResponse.redirect(
        new URL("/sign-in?confirmed=1", request.url),
      );
  }
}
