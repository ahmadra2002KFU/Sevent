/**
 * Mark-read helpers — wraps the `mark_feedback_thread_read*` RPCs from
 * migration 20260505090000.
 *
 * The RPCs are SECURITY DEFINER and validate the caller in-function, so we
 * do NOT need to broaden the admin-only UPDATE policy on `app_feedback` to
 * let users flip `read_at_user`. This is a deliberate fix for round-1
 * finding F-1 (owner UPDATE policy too broad).
 *
 * The user RPC keys off `auth.uid()` — meaning the service-role client
 * cannot impersonate a user via this call (the function runs as the role
 * that owns it, but `auth.uid()` is sourced from the JWT). We pass the
 * service-role client here only because every messaging caller already
 * holds one from `requireRole`; in practice these RPCs are also callable
 * from the user-scoped client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type MarkReadResult =
  | { ok: true }
  | { ok: false; error: string };

export async function markThreadReadAsUser(params: {
  admin: SupabaseClient;
  thread_id: string;
}): Promise<MarkReadResult> {
  const { error } = await params.admin.rpc("mark_feedback_thread_read", {
    p_thread_id: params.thread_id,
  });
  if (error) {
    console.error("[messaging/read] mark_feedback_thread_read failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function markThreadReadAsAdmin(params: {
  admin: SupabaseClient;
  thread_id: string;
}): Promise<MarkReadResult> {
  const { error } = await params.admin.rpc("mark_feedback_thread_read_admin", {
    p_thread_id: params.thread_id,
  });
  if (error) {
    console.error("[messaging/read] mark_feedback_thread_read_admin failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
