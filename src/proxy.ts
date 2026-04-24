import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolveAccessForUser } from "@/lib/auth/access";
import { isRouteAllowed } from "@/lib/auth/featureMatrix";

const ROLE_PREFIXES = ["/organizer", "/supplier", "/admin"] as const;
const PAGE_GATED_PREFIXES = ["/supplier/onboarding"] as const;
type ProtectedPrefix = (typeof ROLE_PREFIXES)[number];

function findProtectedPrefix(pathname: string): ProtectedPrefix | null {
  return (
    ROLE_PREFIXES.find(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) ?? null
  );
}

function isPageGatedRoute(pathname: string): boolean {
  return PAGE_GATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
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
 * Public routes short-circuit before session refresh. Onboarding routes are
 * page-gated, so the proxy only refreshes/authenticates the session there and
 * lets the route call `requireAccess` before it loads supplier data.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedPrefix = findProtectedPrefix(pathname);

  if (!protectedPrefix) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  if (!user) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isPageGatedRoute(pathname)) {
    return response;
  }

  const decision = await resolveAccessForUser(user.id);

  if (!isRouteAllowed(pathname, decision.allowedRoutePrefixes)) {
    return NextResponse.redirect(
      new URL(decision.bestDestination, request.url),
    );
  }

  return response;
}

export const config = {
  matcher: ["/organizer/:path*", "/supplier/:path*", "/admin/:path*"],
};
