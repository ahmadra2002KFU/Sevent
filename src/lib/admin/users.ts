/**
 * Admin users surface — read helpers.
 *
 * Mirrors the pattern in `src/lib/messaging/threads.ts`: callers pass a
 * service-role `admin` client and the helper does the read. Both helpers here
 * are backed by DB objects that are granted to `service_role` only (see
 * migration 20260514110000), so they MUST be called from a server context that
 * has already authenticated the caller via `requireAccess("messaging.admin.*")`.
 *
 * - `listUsersForAdmin` powers the `/admin/users` list page via the
 *   `admin_list_users_with_stats` RPC (search + role filter + pagination +
 *   per-user thread stats in one round-trip).
 * - `getUserWithEmail` is a point lookup over the `profiles_with_email` view —
 *   used to resolve a recipient when compose is opened with `?user_id=`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Row shapes (no generated DB types in this project — match the migration)
// ---------------------------------------------------------------------------

export type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  created_at: string;
  thread_count: number;
  unread_count: number;
  last_activity: string | null;
};

export type UserWithEmail = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
};

// ---------------------------------------------------------------------------
// listUsersForAdmin — paginated user list with messaging stats
// ---------------------------------------------------------------------------

export type ListUsersForAdminParams = {
  admin: SupabaseClient;
  /** Free-text match against `full_name` and `email`. Case-insensitive. */
  search?: string;
  /** Role filter. Omit or pass "all" for every role. */
  role?: AppRole | "all";
  page?: number;
  pageSize?: number;
};

export type ListUsersResult = {
  rows: AdminUserRow[];
  totalCount: number;
  totalPages: number;
};

type RpcRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  created_at: string;
  thread_count: number | string;
  unread_count: number | string;
  last_activity: string | null;
  total_count: number | string;
};

export async function listUsersForAdmin(
  params: ListUsersForAdminParams,
): Promise<ListUsersResult> {
  const pageSize = params.pageSize ?? 25;
  const page = Math.max(1, params.page ?? 1);
  const offset = (page - 1) * pageSize;
  const search = params.search?.trim();
  const role = params.role && params.role !== "all" ? params.role : null;

  const { data, error } = await params.admin.rpc("admin_list_users_with_stats", {
    p_search: search && search.length > 0 ? search : null,
    p_role: role,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (error) {
    console.error("[admin/users] listUsersForAdmin failed", error);
    return { rows: [], totalCount: 0, totalPages: 1 };
  }

  const rpcRows = (data ?? []) as RpcRow[];
  // The RPC carries the total in every row via `count(*) over ()`. An empty
  // page (no matches, or offset past the end) has no rows → total is 0.
  const totalCount = rpcRows.length > 0 ? Number(rpcRows[0].total_count) : 0;
  const rows: AdminUserRow[] = rpcRows.map((r) => ({
    id: r.id,
    email: r.email,
    full_name: r.full_name,
    role: r.role,
    created_at: r.created_at,
    thread_count: Number(r.thread_count),
    unread_count: Number(r.unread_count),
    last_activity: r.last_activity,
  }));

  return {
    rows,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

// ---------------------------------------------------------------------------
// getUserWithEmail — single user point lookup (profiles + auth.users.email)
// ---------------------------------------------------------------------------

export async function getUserWithEmail(
  admin: SupabaseClient,
  userId: string,
): Promise<UserWithEmail | null> {
  const { data, error } = await admin
    .from("profiles_with_email")
    .select("id, full_name, email, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[admin/users] getUserWithEmail failed", error);
    return null;
  }
  return (data as UserWithEmail | null) ?? null;
}
