import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolveAccessForUser } from "@/lib/auth/access";
import { isRouteAllowed } from "@/lib/auth/featureMatrix";

const ROLE_PREFIXES = ["/organizer", "/supplier", "/admin"] as const;
type ProtectedPrefix = (typeof ROLE_PREFIXES)[number];

function findProtectedPrefix(pathname: string): ProtectedPrefix | null {
  return (
    ROLE_PREFIXES.find(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) ?? null
  );
}

/**
 * Request-scoped authorization gate.
 *
 * Delegates to `resolveAccessForUser` for a single source of truth —
 * role + onboarding + verification state collapse into one `AccessDecision`
 * that the middleware, sign-in action, layouts, pages, and actions all read
 * from the same file. Previously this function re-implemented a thinner
 * role-only gate which was trivially skippable (agency redirect loop, no
 * supplier state check, trusted `next` query param downstream).
 *
 * Public routes (not matching any `ROLE_PREFIXES`) short-circuit after
 * session refresh — we don't pay the extra profile/supplier query cost
 * when the request doesn't need an access decision.
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;
  const protectedPrefix = findProtectedPrefix(pathname);

  if (!protectedPrefix) {
    return response;
  }

  const decision = await resolveAccessForUser(user?.id ?? null);

  if (decision.state === "unauthenticated") {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (!isRouteAllowed(pathname, decision.allowedRoutePrefixes)) {
    return NextResponse.redirect(
      new URL(decision.bestDestination, request.url),
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
