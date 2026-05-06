/**
 * Threaded admin↔user messaging — read helpers.
 *
 * Mirrors the pattern in `src/lib/notifications/reader.ts`: callers pass a
 * service-role `admin` client and the relevant identity, and the helper
 * filters on the ownership column in code (because @supabase/ssr does not
 * reliably forward the user's access_token for RLS-scoped reads — see
 * `src/lib/supabase/server.ts:84-105`). Every reader exposed here is safe to
 * call from a server component or server action that has already
 * authenticated the caller via `requireRole`/`requireAccess`.
 *
 * The thread is the row in `public.app_feedback` (extended in migration
 * 20260505050000 from one-way feedback into a thread container). Replies live
 * in `public.feedback_messages`, FK'd by `thread_id`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Row shapes (no generated DB types in this project — match the migration)
// ---------------------------------------------------------------------------

export type FeedbackInitiator = "user" | "admin";
export type FeedbackStatus = "new" | "triaged" | "resolved";
export type FeedbackCategory =
  | "bug"
  | "feature"
  | "confusing"
  | "praise"
  | "other";

export type ThreadRow = {
  id: string;
  user_id: string | null;
  role: AppRole;
  initiator: FeedbackInitiator;
  category: FeedbackCategory | null;
  subject: string | null;
  message: string;
  status: FeedbackStatus;
  campaign_id: string | null;
  read_at_user: string | null;
  read_at_admin: string | null;
  last_message_at: string;
  closed_at: string | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  sender_role: AppRole;
  body: string;
  edited_at: string | null;
  created_at: string;
};

const THREAD_COLS =
  "id, user_id, role, initiator, category, subject, message, status, campaign_id, read_at_user, read_at_admin, last_message_at, closed_at, created_at";

const MESSAGE_COLS =
  "id, thread_id, sender_id, sender_role, body, edited_at, created_at";

// ---------------------------------------------------------------------------
// Admin list — paginated thread inbox with filters
// ---------------------------------------------------------------------------

export type AdminThreadFilters = {
  /** Defaults to `"all"` so admin compose threads (no category) are visible. */
  status?: FeedbackStatus | "all";
  role?: AppRole | "all";
  category?: FeedbackCategory | "all";
  /** When `true`, only threads where the admin has unread activity. */
  unreadOnly?: boolean;
  /** Free-text match against `subject` and `message`. Case-insensitive. */
  search?: string;
};

export type ListThreadsForAdminParams = {
  admin: SupabaseClient;
  filters?: AdminThreadFilters;
  page?: number;
  pageSize?: number;
};

export type ListThreadsResult = {
  rows: ThreadRow[];
  totalCount: number;
  totalPages: number;
};

export async function listThreadsForAdmin(
  params: ListThreadsForAdminParams,
): Promise<ListThreadsResult> {
  const pageSize = params.pageSize ?? 25;
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = params.admin
    .from("app_feedback")
    .select(THREAD_COLS, { count: "exact" })
    .order("last_message_at", { ascending: false })
    .range(from, to);

  const f = params.filters ?? {};
  if (f.status && f.status !== "all") q = q.eq("status", f.status);
  if (f.role && f.role !== "all") q = q.eq("role", f.role);
  if (f.category && f.category !== "all") q = q.eq("category", f.category);
  if (f.unreadOnly) {
    // The bump trigger clears read_at_admin on every non-admin message, so
    // "unread for admin" reduces to a simple IS NULL check.
    q = q.is("read_at_admin", null);
  }
  if (f.search && f.search.trim().length > 0) {
    const term = f.search.trim().replace(/[%_]/g, (m) => `\\${m}`);
    q = q.or(`subject.ilike.%${term}%,message.ilike.%${term}%`);
  }

  const { data, count, error } = await q;
  if (error) {
    console.error("[messaging/threads] listThreadsForAdmin failed", error);
    return { rows: [], totalCount: 0, totalPages: 1 };
  }
  const rows = (data ?? []) as ThreadRow[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return { rows, totalCount, totalPages };
}

// ---------------------------------------------------------------------------
// User list — paginated own-thread inbox
// ---------------------------------------------------------------------------

export type ListThreadsForUserParams = {
  admin: SupabaseClient;
  user_id: string;
  page?: number;
  pageSize?: number;
  /** When `true`, only the caller's threads with unread activity. */
  unreadOnly?: boolean;
};

export async function listThreadsForUser(
  params: ListThreadsForUserParams,
): Promise<ListThreadsResult> {
  const pageSize = params.pageSize ?? 25;
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = params.admin
    .from("app_feedback")
    .select(THREAD_COLS, { count: "exact" })
    .eq("user_id", params.user_id)
    .order("last_message_at", { ascending: false })
    .range(from, to);

  if (params.unreadOnly) {
    // Bump trigger keeps `read_at_user` null on any admin message, so
    // unread reduces to IS NULL.
    q = q.is("read_at_user", null);
  }

  const { data, count, error } = await q;
  if (error) {
    console.error("[messaging/threads] listThreadsForUser failed", error);
    return { rows: [], totalCount: 0, totalPages: 1 };
  }
  return {
    rows: (data ?? []) as ThreadRow[],
    totalCount: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

// ---------------------------------------------------------------------------
// Single thread — header + messages, scoped to the viewer
// ---------------------------------------------------------------------------

export type ThreadViewer =
  | { kind: "admin" }
  | { kind: "owner"; user_id: string };

export type GetThreadForViewerParams = {
  admin: SupabaseClient;
  thread_id: string;
  viewer: ThreadViewer;
  /** Cap on messages returned. Default 200 (a thread larger than this is rare;
   * UI can paginate later if needed). */
  messageLimit?: number;
};

export type GetThreadForViewerResult =
  | { ok: true; thread: ThreadRow; messages: MessageRow[] }
  | { ok: false; code: "not_found" | "forbidden" | "error"; error?: string };

export async function getThreadForViewer(
  params: GetThreadForViewerParams,
): Promise<GetThreadForViewerResult> {
  const { admin, thread_id, viewer } = params;
  const messageLimit = params.messageLimit ?? 200;

  let threadQ = admin
    .from("app_feedback")
    .select(THREAD_COLS)
    .eq("id", thread_id)
    .limit(1);

  if (viewer.kind === "owner") {
    threadQ = threadQ.eq("user_id", viewer.user_id);
  }

  const { data: threadRows, error: threadErr } = await threadQ;
  if (threadErr) {
    console.error("[messaging/threads] getThreadForViewer thread err", threadErr);
    return { ok: false, code: "error", error: threadErr.message };
  }
  const thread = (threadRows ?? [])[0] as ThreadRow | undefined;
  if (!thread) {
    return { ok: false, code: "not_found" };
  }

  const { data: msgRows, error: msgErr } = await admin
    .from("feedback_messages")
    .select(MESSAGE_COLS)
    .eq("thread_id", thread_id)
    .order("created_at", { ascending: true })
    .limit(messageLimit);
  if (msgErr) {
    console.error("[messaging/threads] getThreadForViewer msgs err", msgErr);
    return { ok: false, code: "error", error: msgErr.message };
  }

  return { ok: true, thread, messages: (msgRows ?? []) as MessageRow[] };
}

// ---------------------------------------------------------------------------
// Message tail — used by the polling endpoint
// ---------------------------------------------------------------------------

export type GetMessagesSinceParams = {
  admin: SupabaseClient;
  thread_id: string;
  /** ISO timestamp; messages with `created_at > since` are returned. */
  since: string;
  viewer: ThreadViewer;
  limit?: number;
};

export type GetMessagesSinceResult =
  | { ok: true; messages: MessageRow[] }
  | { ok: false; code: "not_found" | "forbidden" | "error"; error?: string };

/**
 * Returns messages newer than `since` for a thread the viewer can read.
 *
 * For owner viewers we first verify ownership of the thread (one round-trip)
 * and then fetch messages — this avoids returning rows for someone else's
 * thread even if a frontend caller passes a thread_id they shouldn't see.
 */
export async function getMessagesSince(
  params: GetMessagesSinceParams,
): Promise<GetMessagesSinceResult> {
  const { admin, thread_id, since, viewer } = params;
  const limit = params.limit ?? 50;

  if (viewer.kind === "owner") {
    const { data: ownerCheck, error: checkErr } = await admin
      .from("app_feedback")
      .select("id")
      .eq("id", thread_id)
      .eq("user_id", viewer.user_id)
      .limit(1);
    if (checkErr) {
      console.error("[messaging/threads] getMessagesSince owner check err", checkErr);
      return { ok: false, code: "error", error: checkErr.message };
    }
    if (!ownerCheck || ownerCheck.length === 0) {
      return { ok: false, code: "forbidden" };
    }
  }

  const { data, error } = await admin
    .from("feedback_messages")
    .select(MESSAGE_COLS)
    .eq("thread_id", thread_id)
    .gt("created_at", since)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[messaging/threads] getMessagesSince err", error);
    return { ok: false, code: "error", error: error.message };
  }
  return { ok: true, messages: (data ?? []) as MessageRow[] };
}

// ---------------------------------------------------------------------------
// Counts — for bell badges / inbox headers
// ---------------------------------------------------------------------------

export async function countUnreadThreadsForUser(
  admin: SupabaseClient,
  user_id: string,
): Promise<number> {
  const { count, error } = await admin
    .from("app_feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user_id)
    .is("read_at_user", null);
  if (error) {
    console.error("[messaging/threads] countUnreadThreadsForUser err", error);
    return 0;
  }
  return count ?? 0;
}

export async function countUnreadThreadsForAdmin(
  admin: SupabaseClient,
): Promise<number> {
  const { count, error } = await admin
    .from("app_feedback")
    .select("id", { count: "exact", head: true })
    .is("read_at_admin", null);
  if (error) {
    console.error("[messaging/threads] countUnreadThreadsForAdmin err", error);
    return 0;
  }
  return count ?? 0;
}
