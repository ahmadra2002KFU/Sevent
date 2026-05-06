"use server";

/**
 * User-side messaging server actions. Mirror of `_actions/feedback.ts`
 * for the threaded surface.
 *
 * - `userReplyAction` — caller posts a reply to a thread they own.
 * - `userNewThreadAction` — caller starts a new "ask admin" thread; this
 *   creates the parent app_feedback row (initiator='user') AND inserts the
 *   first feedback_messages row, then notifies all admins.
 * - `userMarkThreadReadAction` — caller marks one of their threads as read
 *   (delegates to the SECURITY DEFINER RPC).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAccess } from "@/lib/auth/access";
import { markThreadReadAsUser } from "@/lib/messaging/read";
import { replyAsUser } from "@/lib/messaging/replies";
import { notifyAllAdmins } from "@/lib/messaging/notify";
import type {
  FeedbackCategory,
  ThreadRow,
} from "@/lib/messaging/threads";
import type { AppRole } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

const CATEGORY_VALUES = ["bug", "feature", "confusing", "praise", "other"] as const;
const categorySchema = z
  .union([z.enum(CATEGORY_VALUES), z.literal("")])
  .optional();

export type UserReplyState =
  | { status: "idle" }
  | { status: "ok" }
  | {
      status: "error";
      code: "validation" | "not_found" | "forbidden" | "closed" | "error";
      message?: string;
    };

export async function userReplyAction(
  _prev: UserReplyState,
  formData: FormData,
): Promise<UserReplyState> {
  const gate = await requireAccess("messaging.user.write");

  const idParse = idSchema.safeParse(formData.get("thread_id"));
  if (!idParse.success) {
    return { status: "error", code: "validation", message: "invalid thread id" };
  }
  const body = (formData.get("body") ?? "").toString();
  const role = (gate.decision.role ?? "organizer") as AppRole;

  const result = await replyAsUser({
    admin: gate.admin,
    user_id: gate.user.id,
    user_role: role,
    thread_id: idParse.data,
    body,
  });
  if (!result.ok) {
    return { status: "error", code: result.code, message: result.error };
  }

  // Notify every admin — best-effort, not awaited critical-path.
  void notifyAllAdmins({
    admin: gate.admin,
    kind: "message.reply_received",
    thread_id: idParse.data,
    sender_role: role,
    body,
  });

  // Map role to its messages route prefix.
  const rolePrefix = role === "supplier" ? "supplier" : "organizer";
  revalidatePath(`/${rolePrefix}/messages/${idParse.data}`);
  revalidatePath(`/${rolePrefix}/messages`);
  return { status: "ok" };
}

const newThreadSchema = z.object({
  subject: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  body: z.string().trim().min(1, "empty").max(10000, "too long"),
  category: categorySchema.transform((v) =>
    v && v.length > 0 ? (v as FeedbackCategory) : null,
  ),
});

export type UserNewThreadState =
  | { status: "idle" }
  | { status: "ok"; thread_id: string }
  | { status: "error"; message: string };

/**
 * Server action variant that REDIRECTS to the new thread on success. Used
 * directly as a `<form action={…}>` target; the action throws NEXT_REDIRECT
 * on success and is caught by Next.
 */
export async function userNewThreadAction(formData: FormData): Promise<void> {
  const gate = await requireAccess("messaging.user.write");

  const parsed = newThreadSchema.safeParse({
    subject: formData.get("subject") ?? "",
    body: formData.get("body") ?? "",
    category: formData.get("category") ?? "",
  });
  if (!parsed.success) {
    // The page form is simple; redirect back without a thread id.
    return;
  }

  const role = (gate.decision.role ?? "organizer") as AppRole;
  const rolePrefix = role === "supplier" ? "supplier" : "organizer";
  const requestId = crypto.randomUUID();

  const { data: threadRows, error: threadErr } = await gate.admin
    .from("app_feedback")
    .insert({
      user_id: gate.user.id,
      role,
      initiator: "user",
      category: parsed.data.category,
      subject: parsed.data.subject,
      message: parsed.data.body.slice(0, 10000),
      status: "new",
      request_id: requestId,
    })
    .select("id, user_id, role, initiator, category, subject, message, status, campaign_id, read_at_user, read_at_admin, last_message_at, closed_at, created_at")
    .limit(1);
  if (threadErr) {
    console.error("[_actions/messaging] userNewThreadAction insert thread err", threadErr);
    return;
  }
  const thread = (threadRows ?? [])[0] as ThreadRow | undefined;
  if (!thread) return;

  const { error: msgErr } = await gate.admin
    .from("feedback_messages")
    .insert({
      thread_id: thread.id,
      sender_id: gate.user.id,
      sender_role: role,
      body: parsed.data.body,
    });
  if (msgErr) {
    console.error("[_actions/messaging] userNewThreadAction insert message err", msgErr);
    return;
  }

  // Notify all admins — best-effort.
  void notifyAllAdmins({
    admin: gate.admin,
    kind: "message.received",
    thread_id: thread.id,
    sender_role: role,
    body: parsed.data.body,
  });

  revalidatePath(`/${rolePrefix}/messages`);
  redirect(`/${rolePrefix}/messages/${thread.id}`);
}

export async function userMarkThreadReadAction(formData: FormData): Promise<void> {
  const gate = await requireAccess("messaging.user.read");
  const idParse = idSchema.safeParse(formData.get("thread_id"));
  if (!idParse.success) return;
  await markThreadReadAsUser({ admin: gate.admin, thread_id: idParse.data });
  // No revalidate — the caller page already re-renders on the next request.
}

// (initial states are kept private to this server-actions module; client
// components reference them via useActionState's typing rather than imports.)
