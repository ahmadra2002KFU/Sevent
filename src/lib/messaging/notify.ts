/**
 * Bridges the messaging surface to the existing notifications system.
 *
 * On every new thread or reply, we write a row into `public.notifications`
 * for the OTHER party so the existing `NotificationBell` shows an unread
 * badge with a link into the thread. Two kinds are introduced:
 *
 *   - `message.received` — for the recipient on a new thread (admin → user
 *     compose, OR user → admin "ask admin" first message). Payload:
 *     `{ thread_id, sender_role, snippet, role }` where `role` is the
 *     recipient's role (used by `linkForNotification` to pick `/admin/...`
 *     vs `/<role>/...` deep-link).
 *   - `message.reply_received` — for the OTHER party on a reply in an
 *     existing thread. Same payload shape.
 *
 * For "compose to all" / "compose to role" admin sends we fan out one
 * notification per recipient. The notification writes are best-effort: a
 * failure here does NOT roll back the message itself (in line with the
 * notifications system's existing contract).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createNotification } from "@/lib/notifications/inApp";
import type { AppRole } from "@/lib/supabase/server";

export type MessageNotificationKind = "message.received" | "message.reply_received";

export type NotifyMessageParams = {
  admin: SupabaseClient;
  kind: MessageNotificationKind;
  /** The recipient who should see the bell badge increment. */
  recipient_user_id: string;
  /** Recipient's role, used by the inbox link builder for the deep link. */
  recipient_role: AppRole;
  thread_id: string;
  sender_role: AppRole;
  /** Trimmed message body for the inbox snippet (UI clips to ~140 chars). */
  body: string;
  /**
   * When true, the notifications → email_outbox bridge also enqueues an email
   * for this notification. Set ONLY on the single-user admin compose path
   * (a new dedicated thread). Bulk broadcasts and replies leave this unset so
   * they stay in-app only. When set, `thread_url` must also be provided.
   */
  email_notify?: boolean;
  /** Absolute deep link to the thread — used by the MessageReceived email CTA. */
  thread_url?: string;
};

const SNIPPET_MAX = 200;

export async function notifyMessage(
  params: NotifyMessageParams,
): Promise<void> {
  const snippet = params.body
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SNIPPET_MAX);

  await createNotification({
    supabase: params.admin,
    user_id: params.recipient_user_id,
    kind: params.kind,
    payload: {
      thread_id: params.thread_id,
      sender_role: params.sender_role,
      role: params.recipient_role,
      snippet,
      // Email opt-in: the bridge whitelists message.received only when this
      // flag is present, so unset notifications stay in-app only.
      ...(params.email_notify
        ? { email_notify: true, thread_url: params.thread_url }
        : {}),
    },
  });
}

/**
 * Convenience: notify ALL admin profiles. Used for user-initiated threads
 * where any admin should be able to pick it up.
 */
export async function notifyAllAdmins(
  params: Omit<NotifyMessageParams, "recipient_user_id" | "recipient_role">,
): Promise<void> {
  const { data, error } = await params.admin
    .from("profiles")
    .select("id")
    .eq("role", "admin");
  if (error) {
    console.error("[messaging/notify] notifyAllAdmins lookup failed", error);
    return;
  }
  const ids = (data ?? []).map((r: { id: string }) => r.id);
  await Promise.all(
    ids.map((recipient_user_id) =>
      notifyMessage({
        ...params,
        recipient_user_id,
        recipient_role: "admin",
      }),
    ),
  );
}
