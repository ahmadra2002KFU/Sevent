import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  ACCESS_HEADER_NAME,
  resolveAccessForUser,
  signAccessPayload,
} from "@/lib/auth/access";
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

  // Forward the resolved decision to the page render via a signed header so
  // `requireAccess()` can skip a duplicate auth + role round-trip. HMAC stops
  // a forged client header from being trusted; middleware overwrites the
  // header on every request, so a cached/forged value can't poison a session.
  // Returns null when SEVENT_ACCESS_SIGNING_SECRET is unset — in that case
  // we just fall through to the original (slower) response without the
  // optimization.
  const token = await signAccessPayload({
    userId: user.id,
    email: user.email ?? null,
    role: decision.role,
    state: decision.state,
    bestDestination: decision.bestDestination,
    allowedRoutePrefixes: decision.allowedRoutePrefixes,
    features: decision.features,
    supplierId: decision.supplierId,
    iat: Date.now(),
  });

  if (!token) {
    return response;
  }

  // Re-create the response with the access header injected on the forwarded
  // request so the page render sees it via `headers()` from "next/headers".
  // Cookies set by `updateSession` (refreshed Supabase auth tokens) are
  // copied across so they still reach the browser.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ACCESS_HEADER_NAME, token);
  const finalResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });
  for (const cookie of response.cookies.getAll()) {
    finalResponse.cookies.set(cookie);
  }
  return finalResponse;
}

export const config = {
  matcher: ["/organizer/:path*", "/supplier/:path*", "/admin/:path*"],
};
