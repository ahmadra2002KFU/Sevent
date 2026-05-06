"use server";

/**
 * Admin thread actions: reply, mark-read, status transitions (close, reopen,
 * triage, resolve). Each gates on `messaging.admin.write` and operates on a
 * uuid-validated thread id.
 *
 * Reply uses the messaging library's `replyAsAdmin`, which:
 *   - validates the body length,
 *   - inserts into `feedback_messages`,
 *   - the after-insert trigger bumps `app_feedback.last_message_at`,
 *   - then the reply marks the admin's read state up-to-now.
 *
 * Status transitions update `app_feedback.status` and / or `closed_at` and
 * revalidate the thread + list pages.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAccess } from "@/lib/auth/access";
import { notifyMessage } from "@/lib/messaging/notify";
import { markThreadReadAsAdmin } from "@/lib/messaging/read";
import { replyAsAdmin } from "@/lib/messaging/replies";
import type { AppRole } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

export type AdminReplyState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; code: "validation" | "not_found" | "forbidden" | "closed" | "error"; message?: string };

export async function replyAction(
  _prev: AdminReplyState,
  formData: FormData,
): Promise<AdminReplyState> {
  const gate = await requireAccess("messaging.admin.write");

  const idParse = idSchema.safeParse(formData.get("thread_id"));
  if (!idParse.success) {
    return { status: "error", code: "validation", message: "invalid thread id" };
  }
  const body = (formData.get("body") ?? "").toString();

  const result = await replyAsAdmin({
    admin: gate.admin,
    sender_admin_id: gate.user.id,
    thread_id: idParse.data,
    body,
    triageOnReply: true,
  });
  if (!result.ok) {
    return { status: "error", code: result.code, message: result.error };
  }

  // Notify the thread owner — best-effort.
  const { data: threadRows } = await gate.admin
    .from("app_feedback")
    .select("user_id, role")
    .eq("id", idParse.data)
    .limit(1);
  const t = (threadRows ?? [])[0] as
    | { user_id: string | null; role: AppRole }
    | undefined;
  if (t?.user_id) {
    void notifyMessage({
      admin: gate.admin,
      kind: "message.reply_received",
      recipient_user_id: t.user_id,
      recipient_role: t.role,
      thread_id: idParse.data,
      sender_role: "admin",
      body,
    });
  }

  revalidatePath(`/admin/messages/${idParse.data}`);
  revalidatePath("/admin/messages");
  return { status: "ok" };
}

export async function markReadAction(formData: FormData): Promise<void> {
  const gate = await requireAccess("messaging.admin.write");
  const idParse = idSchema.safeParse(formData.get("thread_id"));
  if (!idParse.success) return;
  await markThreadReadAsAdmin({ admin: gate.admin, thread_id: idParse.data });
  revalidatePath(`/admin/messages/${idParse.data}`);
  revalidatePath("/admin/messages");
}

async function setStatus(
  thread_id: string,
  next: "new" | "triaged" | "resolved",
): Promise<void> {
  const gate = await requireAccess("messaging.admin.write");
  const { error } = await gate.admin
    .from("app_feedback")
    .update({
      status: next,
      // resolved is a logical close; flip closed_at as well for resolved.
      closed_at: next === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", thread_id);
  if (error) {
    console.error("[admin/messages] setStatus failed", error);
    return;
  }
  revalidatePath(`/admin/messages/${thread_id}`);
  revalidatePath("/admin/messages");
}

export async function triageAction(formData: FormData): Promise<void> {
  const idParse = idSchema.safeParse(formData.get("thread_id"));
  if (!idParse.success) return;
  await setStatus(idParse.data, "triaged");
}

export async function resolveAction(formData: FormData): Promise<void> {
  const idParse = idSchema.safeParse(formData.get("thread_id"));
  if (!idParse.success) return;
  await setStatus(idParse.data, "resolved");
}

export async function reopenAction(formData: FormData): Promise<void> {
  const gate = await requireAccess("messaging.admin.write");
  const idParse = idSchema.safeParse(formData.get("thread_id"));
  if (!idParse.success) return;
  const { error } = await gate.admin
    .from("app_feedback")
    .update({ status: "triaged", closed_at: null })
    .eq("id", idParse.data);
  if (error) {
    console.error("[admin/messages] reopen failed", error);
    return;
  }
  revalidatePath(`/admin/messages/${idParse.data}`);
  revalidatePath("/admin/messages");
}

export async function closeAction(formData: FormData): Promise<void> {
  const gate = await requireAccess("messaging.admin.write");
  const idParse = idSchema.safeParse(formData.get("thread_id"));
  if (!idParse.success) return;
  const now = new Date().toISOString();
  const { error } = await gate.admin
    .from("app_feedback")
    .update({ status: "resolved", closed_at: now })
    .eq("id", idParse.data);
  if (error) {
    console.error("[admin/messages] close failed", error);
    return;
  }
  revalidatePath(`/admin/messages/${idParse.data}`);
  revalidatePath("/admin/messages");
}
