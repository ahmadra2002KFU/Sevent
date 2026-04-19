import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; ignored. Session refresh is
          // performed by the middleware on the next request.
        }
      },
    },
  });
}

/**
 * Authenticate the current request and return both the user and a service-role
 * Supabase handle for RLS-free reads scoped by the page logic.
 *
 * Motivation: @supabase/ssr@0.10.2 with the new `sb_publishable_*` key format
 * doesn't reliably forward the user's access_token to PostgREST for RLS-scoped
 * SELECTs in server components / server actions — `auth.getUser()` works but
 * `.from(table).select(...)` returns empty even for rows the user owns. Until
 * that upstream gap is addressed, every server-side read on a user-scoped page
 * should go through this helper: authenticate once with the user client, then
 * read via the bypass-RLS admin client while enforcing ownership in code.
 *
 * Returns `null` when the request has no authenticated user so callers can
 * redirect to sign-in.
 */
export async function authenticateAndGetAdminClient(): Promise<
  | { user: { id: string; email: string | null }; admin: ReturnType<typeof createSupabaseServiceRoleClient> }
  | null
> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    user: { id: user.id, email: user.email ?? null },
    admin: createSupabaseServiceRoleClient(),
  };
}

export type AppRole = "admin" | "organizer" | "supplier" | "agency";

export type RoleGateResult =
  | { status: "unauthenticated" }
  | { status: "forbidden"; role: string | null; userId: string }
  | {
      status: "ok";
      user: { id: string; email: string | null };
      admin: ReturnType<typeof createSupabaseServiceRoleClient>;
      role: AppRole;
    };

/**
 * Centralized role gate for server components + server actions.
 *
 * Why this exists: `@supabase/ssr@0.10.2` + the new `sb_publishable_*` key
 * format does not reliably forward the user's access_token to PostgREST on
 * SSR requests, so the historical pattern
 *
 *   const supabase = await createSupabaseServerClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   const { data: profile } = await supabase
 *     .from("profiles").select("role").eq("id", user.id).maybeSingle();
 *
 * returns `profile = null` even for a valid admin, and the page renders
 * "Admin role required". Every new surface that tried that pattern hit the
 * same bug, so we always do the role lookup via service-role now.
 *
 * Security notes:
 * - Service-role bypasses RLS, so the caller's `user.id` is the only identity
 *   signal downstream. Always stamp writes with `user.id` or filter reads by
 *   an ownership column; do not hand the admin handle to untrusted code paths.
 * - Three distinct outcomes (unauth / forbidden / ok) let callers render the
 *   right UX — redirect to sign-in vs. show access-denied vs. proceed — which
 *   matters for logging + observability.
 */
export async function requireRole(
  allowed: AppRole | AppRole[],
): Promise<RoleGateResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "unauthenticated" };

  const admin = createSupabaseServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = ((profile as { role: string } | null)?.role ?? null) as string | null;

  const allowedList = Array.isArray(allowed) ? allowed : [allowed];
  if (!role || !allowedList.includes(role as AppRole)) {
    return { status: "forbidden", role, userId: user.id };
  }

  return {
    status: "ok",
    user: { id: user.id, email: user.email ?? null },
    admin,
    role: role as AppRole,
  };
}

/**
 * Returns a Supabase client authenticated as the service-role, with NO user
 * session and NO cookies attached. This really bypasses RLS because PostgREST
 * sees only the service-role JWT in the `apikey` slot — no competing
 * `Authorization: Bearer <user-jwt>` header from SSR cookies.
 *
 * Use only after you have authenticated the caller (e.g. via `auth.getUser()`
 * on the user-scoped client). Never use for unauthenticated requests.
 */
export function createSupabaseServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Service-role env missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
