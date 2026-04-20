/**
 * Notification reader — centralized SELECT shape for the bell + inbox page.
 *
 * Uses the service-role admin client (see `requireRole` docs in
 * `@/lib/supabase/server`) because `@supabase/ssr` does not reliably forward
 * the user's access_token for RLS-scoped reads. Callers must pass an `admin`
 * handle and the authenticated `user_id`; this helper filters on `user_id` in
 * code to enforce ownership.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  payload_jsonb: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationReadResult = {
  unreadCount: number;
  recent: NotificationRow[];
};

export type ReadNotificationsParams = {
  admin: SupabaseClient;
  user_id: string;
  /** Max rows to return in `recent`. Defaults to 50. */
  limit?: number;
};

/**
 * Read the user's most recent notifications and unread count in parallel.
 *
 * Contract:
 *  - `unreadCount` is the exact count of rows where `read_at IS NULL`.
 *  - `recent` is ordered `created_at DESC` and capped at `limit`.
 *  - Ownership is enforced by explicit `.eq("user_id", user_id)` filters.
 */
export async function readNotificationsForUser(
  params: ReadNotificationsParams,
): Promise<NotificationReadResult> {
  const { admin, user_id } = params;
  const limit = params.limit ?? 50;

  const [unreadRes, recentRes] = await Promise.all([
    admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id)
      .is("read_at", null),
    admin
      .from("notifications")
      .select("id, user_id, kind, payload_jsonb, read_at, created_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const unreadCount = unreadRes.count ?? 0;
  const recent = (recentRes.data ?? []) as NotificationRow[];

  return { unreadCount, recent };
}

/**
 * Read only the unread count. Cheaper variant for the bell badge.
 */
export async function readUnreadCountForUser(
  admin: SupabaseClient,
  user_id: string,
): Promise<number> {
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user_id)
    .is("read_at", null);
  return count ?? 0;
}
