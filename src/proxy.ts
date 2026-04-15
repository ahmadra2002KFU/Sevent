import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

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
  const { response, user, supabase } = await updateSession(request);
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

  // Role gating. Uses the profiles table populated by the on-signup trigger
  // (see supabase/migrations/*_profiles.sql). If the profile row is missing
  // (race window between auth.users insert and trigger completion) we let the
  // request through; the page handles the "no profile" case.
  if (supabase) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const expectedRole = protectedPrefix.slice(1); // "/organizer" -> "organizer"
    const actualRole = profile?.role;

    if (actualRole && actualRole !== expectedRole && actualRole !== "admin") {
      const homeByRole: Record<string, string> = {
        organizer: "/organizer/dashboard",
        supplier: "/supplier/dashboard",
        admin: "/admin/dashboard",
        agency: "/organizer/dashboard",
      };
      const redirectTo = homeByRole[actualRole] ?? "/";
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
