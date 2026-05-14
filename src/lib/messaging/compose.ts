/**
 * Admin compose — single-user, role-broadcast, and all-users dispatch.
 *
 * For broadcasts (role/all) we:
 *   1. Insert one `feedback_campaigns` row (immutable audit log).
 *   2. Resolve the recipient profile id list inside the same transaction
 *      semantically (Supabase doesn't support cross-table TX from JS, so we
 *      issue parallel inserts and rely on the unique partial index
 *      `(campaign_id, user_id)` for idempotency on retry).
 *   3. Insert one `app_feedback` parent thread per recipient.
 *   4. Insert one `feedback_messages` row per thread carrying the body.
 *   5. Update `feedback_campaigns.recipient_count` to the actual successful
 *      insert count (in case some recipients were missing or the unique index
 *      caught duplicates from a previous run).
 *
 * Per-recipient notification rows are written by the caller via `notify.ts`.
 *
 * v1 cap: bulk sends to >5000 recipients return `code: "too_many"`. The cap
 * lives here (not in the page) so any caller benefits.
 *
 * Idempotency:
 *   - composeToUser accepts an explicit `request_id` (UUIDv4) — re-runs with
 *     the same id are caught by the unique partial index on
 *     `app_feedback.request_id`.
 *   - composeToRole / composeToAll re-runs MUST reuse the same campaign_id
 *     to be idempotent (caller's responsibility — the action layer mints
 *     a stable id per submit and is OK to retry the same id).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole } from "@/lib/supabase/server";
import type { ThreadRow } from "@/lib/messaging/threads";

const BULK_RECIPIENT_CAP = 5000;

const THREAD_COLS =
  "id, user_id, role, initiator, category, subject, message, status, campaign_id, read_at_user, read_at_admin, last_message_at, closed_at, created_at";

export type ComposeError =
  | "validation"
  | "not_found"
  | "too_many"
  | "no_recipients"
  | "error";

export type ComposeUserOk = {
  ok: true;
  mode: "user";
  thread_id: string;
  recipient_count: 1;
  /**
   * `true` when this call actually inserted a new thread; `false` when it was
   * an idempotent replay (the `request_id` already existed, e.g. a double
   * submit). Callers MUST NOT re-fire notifications/emails when `false` —
   * otherwise a double-click sends duplicate `message.received` emails.
   */
  created: boolean;
};

export type ComposeBulkOk = {
  ok: true;
  mode: "role" | "all";
  campaign_id: string;
  recipient_count: number;
};

export type ComposeOk = ComposeUserOk | ComposeBulkOk;

export type ComposeFail = { ok: false; code: ComposeError; error?: string };

export type ComposeUserResult = ComposeUserOk | ComposeFail;
export type ComposeBulkResult = ComposeBulkOk | ComposeFail;
export type ComposeResult = ComposeOk | ComposeFail;

function clampSubject(s: string | null | undefined): string {
  return (s ?? "").trim().slice(0, 200);
}

function validateBody(raw: unknown): { ok: true; body: string } | { ok: false; reason: string } {
  if (typeof raw !== "string") return { ok: false, reason: "body must be a string" };
  const trimmed = raw.trim();
  if (trimmed.length < 1) return { ok: false, reason: "body is empty" };
  if (trimmed.length > 10000) return { ok: false, reason: "body exceeds 10,000 chars" };
  return { ok: true, body: trimmed };
}

// ---------------------------------------------------------------------------
// composeToUser — single recipient
// ---------------------------------------------------------------------------

export type ComposeToUserParams = {
  admin: SupabaseClient;
  sender_admin_id: string;
  target_user_id: string;
  subject: string;
  body: string;
  /** UUID for idempotency. Re-runs with the same id no-op via the unique index. */
  request_id: string;
};

export async function composeToUser(params: ComposeToUserParams): Promise<ComposeUserResult> {
  const v = validateBody(params.body);
  if (!v.ok) return { ok: false, code: "validation", error: v.reason };

  const subject = clampSubject(params.subject);
  if (subject.length === 0) {
    return { ok: false, code: "validation", error: "subject is empty" };
  }

  // Resolve recipient role from profiles.
  const { data: profileRow, error: profErr } = await params.admin
    .from("profiles")
    .select("role")
    .eq("id", params.target_user_id)
    .maybeSingle();
  if (profErr) {
    console.error("[messaging/compose] composeToUser profile err", profErr);
    return { ok: false, code: "error", error: profErr.message };
  }
  if (!profileRow) return { ok: false, code: "not_found", error: "no such user" };
  const role = (profileRow as { role: string }).role as AppRole;

  // Insert thread + first message.
  const { data: threadRows, error: threadErr } = await params.admin
    .from("app_feedback")
    .insert({
      user_id: params.target_user_id,
      role,
      initiator: "admin",
      subject,
      message: v.body.slice(0, 10000),
      status: "new",
      request_id: params.request_id,
    })
    .select(THREAD_COLS)
    .limit(1);
  if (threadErr) {
    // Unique violation on request_id — treat as idempotent success: look up
    // the existing row.
    if (threadErr.code === "23505" /* unique_violation */) {
      const { data: existingRows } = await params.admin
        .from("app_feedback")
        .select("id")
        .eq("request_id", params.request_id)
        .limit(1);
      const existing = (existingRows ?? [])[0] as { id: string } | undefined;
      if (existing) {
        return {
          ok: true,
          mode: "user",
          thread_id: existing.id,
          recipient_count: 1,
          created: false,
        };
      }
    }
    console.error("[messaging/compose] composeToUser thread err", threadErr);
    return { ok: false, code: "error", error: threadErr.message };
  }
  const thread = (threadRows ?? [])[0] as ThreadRow | undefined;
  if (!thread) return { ok: false, code: "error", error: "no row returned" };

  const { error: msgErr } = await params.admin
    .from("feedback_messages")
    .insert({
      thread_id: thread.id,
      sender_id: params.sender_admin_id,
      sender_role: "admin",
      body: v.body,
    });
  if (msgErr) {
    console.error("[messaging/compose] composeToUser message err", msgErr);
    // Thread exists without a message — caller can retry, but surface error.
    return { ok: false, code: "error", error: msgErr.message };
  }

  return {
    ok: true,
    mode: "user",
    thread_id: thread.id,
    recipient_count: 1,
    created: true,
  };
}

// ---------------------------------------------------------------------------
// composeToRole / composeToAll — bulk
// ---------------------------------------------------------------------------

export type ComposeBulkParams = {
  admin: SupabaseClient;
  sender_admin_id: string;
  /** When `null`, sends to every authenticated user (every profile row). */
  role: AppRole | null;
  subject: string;
  body: string;
  /** UUID — caller mints this; re-runs with the same id are idempotent. */
  campaign_id: string;
};

export type RecipientCountResult =
  | { ok: true; count: number }
  | { ok: false; code: "error"; error: string };

/**
 * Returns how many recipients a bulk send would target right now. Used by the
 * compose page's live preview before submission.
 */
export async function countRecipients(
  admin: SupabaseClient,
  role: AppRole | null,
): Promise<RecipientCountResult> {
  let q = admin.from("profiles").select("id", { count: "exact", head: true });
  if (role !== null) q = q.eq("role", role);
  const { count, error } = await q;
  if (error) {
    console.error("[messaging/compose] countRecipients err", error);
    return { ok: false, code: "error", error: error.message };
  }
  return { ok: true, count: count ?? 0 };
}

export async function composeBulk(params: ComposeBulkParams): Promise<ComposeBulkResult> {
  const v = validateBody(params.body);
  if (!v.ok) return { ok: false, code: "validation", error: v.reason };

  const subject = clampSubject(params.subject);
  if (subject.length === 0) {
    return { ok: false, code: "validation", error: "subject is empty" };
  }

  // Resolve recipient profile ids.
  let q = params.admin
    .from("profiles")
    .select("id, role")
    .order("id", { ascending: true });
  if (params.role !== null) q = q.eq("role", params.role);

  const { data: profileRows, error: profErr } = await q;
  if (profErr) {
    console.error("[messaging/compose] composeBulk profile err", profErr);
    return { ok: false, code: "error", error: profErr.message };
  }
  const profiles = (profileRows ?? []) as { id: string; role: AppRole }[];
  if (profiles.length === 0) {
    return { ok: false, code: "no_recipients" };
  }
  if (profiles.length > BULK_RECIPIENT_CAP) {
    return { ok: false, code: "too_many", error: `${BULK_RECIPIENT_CAP} max` };
  }

  // 1) Campaign row (idempotent on (id) — if caller retries with same id and
  // the row already exists, we proceed and the unique index on (campaign_id,
  // user_id) absorbs duplicate per-recipient inserts.)
  const targetType: "role" | "all" = params.role === null ? "all" : "role";
  const targetSpec = params.role === null ? {} : { role: params.role };

  const { error: campErr } = await params.admin
    .from("feedback_campaigns")
    .insert({
      id: params.campaign_id,
      sender_admin_id: params.sender_admin_id,
      target_type: targetType,
      target_spec: targetSpec,
      subject,
      body: v.body.slice(0, 10000),
      recipient_count: 0,
    });
  if (campErr && campErr.code !== "23505" /* duplicate ok on retry */) {
    console.error("[messaging/compose] composeBulk campaign err", campErr);
    return { ok: false, code: "error", error: campErr.message };
  }

  // 2) Per-recipient threads (with first messages). We do these in sequential
  // batches to keep memory stable and to surface partial failures cleanly.
  // Idempotency comes from a pre-filter SELECT keyed on campaign_id (we skip
  // recipients who already have a thread for this campaign on retry). The
  // unique partial index on (campaign_id, user_id) backstops races at the DB.
  // We can't drive ON CONFLICT from supabase-js because the index is partial
  // (`where campaign_id is not null`) and PG rejects ON CONFLICT without the
  // matching predicate (error 42P10).
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < profiles.length; i += BATCH) {
    const slice = profiles.slice(i, i + BATCH);
    const userIds = slice.map((p) => p.id);

    const { data: existingRows, error: existingErr } = await params.admin
      .from("app_feedback")
      .select("user_id")
      .eq("campaign_id", params.campaign_id)
      .in("user_id", userIds);
    if (existingErr) {
      console.error("[messaging/compose] composeBulk dedupe err", existingErr);
      return { ok: false, code: "error", error: existingErr.message };
    }
    const existingSet = new Set(
      ((existingRows ?? []) as { user_id: string }[]).map((r) => r.user_id),
    );

    const threadInserts = slice
      .filter((p) => !existingSet.has(p.id))
      .map((p) => ({
        user_id: p.id,
        role: p.role,
        initiator: "admin" as const,
        subject,
        message: v.body.slice(0, 10000),
        status: "new" as const,
        campaign_id: params.campaign_id,
      }));
    if (threadInserts.length === 0) continue;

    const { data: threadRows, error: threadErr } = await params.admin
      .from("app_feedback")
      .insert(threadInserts)
      .select("id, user_id");
    if (threadErr) {
      console.error("[messaging/compose] composeBulk thread batch err", threadErr);
      return { ok: false, code: "error", error: threadErr.message };
    }

    const newThreads = (threadRows ?? []) as { id: string; user_id: string }[];
    if (newThreads.length === 0) continue;

    const messageInserts = newThreads.map((t) => ({
      thread_id: t.id,
      sender_id: params.sender_admin_id,
      sender_role: "admin" as const,
      body: v.body,
    }));
    const { error: msgErr } = await params.admin
      .from("feedback_messages")
      .insert(messageInserts);
    if (msgErr) {
      console.error("[messaging/compose] composeBulk message batch err", msgErr);
      return { ok: false, code: "error", error: msgErr.message };
    }
    inserted += newThreads.length;
  }

  // 3) Update recipient_count on the campaign for visibility (idempotent set
  // to the highest known value — a retry that adds a few more recipients
  // bumps it up).
  if (inserted > 0) {
    const { error: updErr } = await params.admin
      .from("feedback_campaigns")
      .update({ recipient_count: inserted })
      .eq("id", params.campaign_id);
    if (updErr) {
      console.warn("[messaging/compose] composeBulk count update err", updErr);
    }
  }

  return {
    ok: true,
    mode: targetType,
    campaign_id: params.campaign_id,
    recipient_count: inserted,
  };
}
