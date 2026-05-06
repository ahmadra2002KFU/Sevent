/**
 * Threaded admin↔user messaging — reply writers.
 *
 * Both helpers:
 *   • take the service-role admin client (RLS bypassed by design — see
 *     `src/lib/supabase/server.ts:84-105` for the @supabase/ssr context),
 *   • validate ownership in code (admin: role check before the call;
 *     owner: `thread.user_id === sender_id` is checked here),
 *   • insert into `public.feedback_messages` (after-insert trigger bumps
 *     `app_feedback.last_message_at`),
 *   • mark the thread read for the sender side as a side-effect (so the
 *     bell badge clears automatically when you reply).
 *
 * Reply errors do not roll back any caller-visible state; the discriminated
 * result lets the action layer surface the failure to the user.
 *
 * Notifications to the OTHER party are emitted from `notify.ts` and called
 * by the action layer, not here — keeps the writer pure for tests.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole } from "@/lib/supabase/server";
import type { MessageRow } from "@/lib/messaging/threads";
import {
  markThreadReadAsAdmin,
  markThreadReadAsUser,
} from "@/lib/messaging/read";

export type ReplyResult =
  | { ok: true; message: MessageRow }
  | { ok: false; code: "validation" | "not_found" | "forbidden" | "closed" | "error"; error?: string };

const MESSAGE_COLS =
  "id, thread_id, sender_id, sender_role, body, edited_at, created_at";

function validateBody(raw: unknown): { ok: true; body: string } | { ok: false; reason: string } {
  if (typeof raw !== "string") return { ok: false, reason: "body must be a string" };
  const trimmed = raw.trim();
  if (trimmed.length < 1) return { ok: false, reason: "body is empty" };
  if (trimmed.length > 10000) return { ok: false, reason: "body exceeds 10,000 chars" };
  return { ok: true, body: trimmed };
}

// ---------------------------------------------------------------------------
// User reply
// ---------------------------------------------------------------------------

export type ReplyAsUserParams = {
  admin: SupabaseClient;
  /** The authenticated caller's user id — must equal `thread.user_id`. */
  user_id: string;
  user_role: AppRole;
  thread_id: string;
  body: string;
};

export async function replyAsUser(params: ReplyAsUserParams): Promise<ReplyResult> {
  const v = validateBody(params.body);
  if (!v.ok) return { ok: false, code: "validation", error: v.reason };

  // Verify ownership + thread state in a single round-trip.
  const { data: threadRows, error: threadErr } = await params.admin
    .from("app_feedback")
    .select("id, user_id, closed_at")
    .eq("id", params.thread_id)
    .limit(1);
  if (threadErr) {
    console.error("[messaging/replies] replyAsUser thread err", threadErr);
    return { ok: false, code: "error", error: threadErr.message };
  }
  const t = (threadRows ?? [])[0] as
    | { id: string; user_id: string | null; closed_at: string | null }
    | undefined;
  if (!t) return { ok: false, code: "not_found" };
  if (t.user_id !== params.user_id) return { ok: false, code: "forbidden" };
  if (t.closed_at) return { ok: false, code: "closed" };

  const { data: insertRows, error: insertErr } = await params.admin
    .from("feedback_messages")
    .insert({
      thread_id: params.thread_id,
      sender_id: params.user_id,
      sender_role: params.user_role,
      body: v.body,
    })
    .select(MESSAGE_COLS)
    .limit(1);
  if (insertErr) {
    console.error("[messaging/replies] replyAsUser insert err", insertErr);
    return { ok: false, code: "error", error: insertErr.message };
  }
  const inserted = (insertRows ?? [])[0] as MessageRow | undefined;
  if (!inserted) return { ok: false, code: "error", error: "no row returned" };

  // Best-effort: mark this user's view as read up-to-now. A failure here only
  // leaves the unread dot on; the message itself is already persisted.
  void markThreadReadAsUser({ admin: params.admin, thread_id: params.thread_id });

  return { ok: true, message: inserted };
}

// ---------------------------------------------------------------------------
// Admin reply
// ---------------------------------------------------------------------------

export type ReplyAsAdminParams = {
  admin: SupabaseClient;
  /** The authenticated admin's auth.users.id — stamped on the message. */
  sender_admin_id: string;
  thread_id: string;
  body: string;
  /** When `true`, the action also flips status from `new` → `triaged`. */
  triageOnReply?: boolean;
};

export async function replyAsAdmin(params: ReplyAsAdminParams): Promise<ReplyResult> {
  const v = validateBody(params.body);
  if (!v.ok) return { ok: false, code: "validation", error: v.reason };

  // Pull thread state to detect closed threads + decide whether to triage.
  const { data: threadRows, error: threadErr } = await params.admin
    .from("app_feedback")
    .select("id, status, closed_at")
    .eq("id", params.thread_id)
    .limit(1);
  if (threadErr) {
    console.error("[messaging/replies] replyAsAdmin thread err", threadErr);
    return { ok: false, code: "error", error: threadErr.message };
  }
  const t = (threadRows ?? [])[0] as
    | { id: string; status: "new" | "triaged" | "resolved"; closed_at: string | null }
    | undefined;
  if (!t) return { ok: false, code: "not_found" };
  if (t.closed_at) return { ok: false, code: "closed" };

  const { data: insertRows, error: insertErr } = await params.admin
    .from("feedback_messages")
    .insert({
      thread_id: params.thread_id,
      sender_id: params.sender_admin_id,
      sender_role: "admin",
      body: v.body,
    })
    .select(MESSAGE_COLS)
    .limit(1);
  if (insertErr) {
    console.error("[messaging/replies] replyAsAdmin insert err", insertErr);
    return { ok: false, code: "error", error: insertErr.message };
  }
  const inserted = (insertRows ?? [])[0] as MessageRow | undefined;
  if (!inserted) return { ok: false, code: "error", error: "no row returned" };

  if (params.triageOnReply && t.status === "new") {
    const { error: updErr } = await params.admin
      .from("app_feedback")
      .update({ status: "triaged" })
      .eq("id", params.thread_id);
    if (updErr) {
      console.error("[messaging/replies] replyAsAdmin triage upd err", updErr);
      // non-fatal — message is already in.
    }
  }

  void markThreadReadAsAdmin({ admin: params.admin, thread_id: params.thread_id });

  return { ok: true, message: inserted };
}
