import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { resolveAccessForUser } from "@/lib/auth/access";
import { sanitizeNextParam } from "@/lib/auth/nextParam";
import { enqueueEmail } from "@/lib/notifications/outbox";

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
 *
 * First sign-in welcome: organizers and suppliers each get a one-time welcome
 * email enqueued here. The enqueue is idempotent (stable per-user dedup_key +
 * ON CONFLICT DO NOTHING on email_outbox), so the magic-link / recovery flows
 * that also hit this route never produce a second email.
 *
 * Guided onboarding: a brand-new organizer (organizer_legal_type IS NULL with
 * no company membership) is routed to the company-choice screen instead of the
 * dashboard so the path decision is the first thing they see. "individual" is a
 * legitimate end-state, so this guides rather than gates — the dashboard stays
 * fully reachable afterwards.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  // Behind Cloudflare → host → container loopback, `request.url` resolves to
  // the container's bind address (0.0.0.0:3000) rather than the public host.
  // Anchor redirects to APP_URL so the Location header keeps the user on the
  // canonical hostname.
  const redirectBase = process.env.APP_URL ?? request.url;

  if (!code) {
    return NextResponse.redirect(
      new URL("/sign-in?error=missing_code", redirectBase),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );
  if (exchangeError) {
    const msg = encodeURIComponent(exchangeError.message);
    return NextResponse.redirect(
      new URL(`/sign-in?error=${msg}`, redirectBase),
    );
  }

  // The session cookie is now set on the user-scoped client, so RLS lets the
  // user read their own profiles row. We deliberately do NOT use the
  // service-role client to READ here — the callback should fail closed if the
  // just-set session can't see its own profile.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/sign-in?confirmed=1", redirectBase),
    );
  }

  const decision = await resolveAccessForUser(user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, language, full_name, organizer_legal_type")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as { role: string } | null)?.role ?? null;
  const language =
    (profile as { language?: string } | null)?.language === "ar" ? "ar" : "en";
  const fullName =
    (profile as { full_name?: string | null } | null)?.full_name ?? null;
  const legalType =
    (profile as { organizer_legal_type?: string | null } | null)
      ?.organizer_legal_type ?? null;

  // One-time welcome email for organizers + suppliers. Enqueued via the
  // service-role client because email_outbox is a service-only table under
  // RLS. Wrapped so a notification hiccup can never break the auth redirect.
  if (role === "organizer" || role === "supplier") {
    try {
      const admin = createSupabaseServiceRoleClient();
      const templateKind =
        role === "organizer" ? "welcome.organizer" : "welcome.supplier";
      const result = await enqueueEmail(admin, {
        recipientProfileId: user.id,
        recipientEmail: user.email ?? "",
        templateKind,
        locale: language,
        payload: {
          recipientName: fullName,
          appUrl: process.env.APP_URL ?? "http://localhost:3000",
        },
        // STABLE per-user key (not payload-hashed) → at most one welcome ever.
        dedupKey: `${templateKind}/${user.id}`,
      });
      if (!result.ok) {
        console.error("[auth/callback] welcome enqueue failed", {
          userId: user.id,
          role,
          error: result.error,
        });
      }
    } catch (err) {
      console.error("[auth/callback] welcome enqueue threw", {
        userId: user.id,
        role,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Deep-link preservation (e.g. organizer invite accept). Sanitized against
  // the user's own allowed prefixes so a crafted ?next can't cross roles.
  const safeNext = sanitizeNextParam(next, decision.allowedRoutePrefixes);
  if (safeNext) {
    return NextResponse.redirect(new URL(safeNext, redirectBase));
  }

  switch (role) {
    case "admin":
      return NextResponse.redirect(
        new URL("/admin/verifications", redirectBase),
      );
    case "organizer": {
      // Guide brand-new organizers (no declared legal type, no company yet)
      // straight into the path-choice screen. Everyone else uses the
      // resolver's bestDestination (dashboard, or the company-creation gate
      // for a company-declared organizer who hasn't created one yet).
      const isBrandNew =
        legalType === null && decision.availableCompanyIds.length === 0;
      const target = isBrandNew
        ? "/organizer/onboarding/company-choice"
        : decision.bestDestination;
      return NextResponse.redirect(new URL(target, redirectBase));
    }
    case "supplier":
      return NextResponse.redirect(
        new URL(decision.bestDestination, redirectBase),
      );
    default:
      return NextResponse.redirect(
        new URL("/sign-in?confirmed=1", redirectBase),
      );
  }
}
