import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const ROLE_PREFIXES = ["/organizer", "/supplier", "/admin"] as const;
type ProtectedPrefix = (typeof ROLE_PREFIXES)[number];

function findProtectedPrefix(pathname: string): ProtectedPrefix | null {
  return (
    ROLE_PREFIXES.find(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) ?? null
  );
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;
  const protectedPrefix = findProtectedPrefix(pathname);

  if (!protectedPrefix) {
    return response;
  }

  if (!user) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Role gating. We authenticated `user` above through the cookie-bound SSR
  // client's auth.getUser(); here we read their role via the service-role
  // client because @supabase/ssr + new sb_publishable_* keys don't forward
  // the user JWT to PostgREST reliably in all contexts, causing RLS-scoped
  // reads to silently return null (same gap we hit in server actions).
  const admin = createSupabaseServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const expectedRole = protectedPrefix.slice(1); // "/organizer" -> "organizer"
  const actualRole = (profile as { role: string } | null)?.role;

  // If the profile row is missing (race window between auth.users insert and
  // the on-signup trigger) send them home rather than admitting them to a
  // section they may not belong in.
  if (!actualRole) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (actualRole !== expectedRole && actualRole !== "admin") {
    const homeByRole: Record<string, string> = {
      organizer: "/organizer/dashboard",
      supplier: "/supplier/dashboard",
      admin: "/admin/dashboard",
      agency: "/organizer/dashboard",
    };
    const redirectTo = homeByRole[actualRole] ?? "/";
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
