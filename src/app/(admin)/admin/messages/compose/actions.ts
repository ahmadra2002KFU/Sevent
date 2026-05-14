"use server";

/**
 * Admin compose action — single entry point that branches on target_type.
 *
 * On success:
 *   - "user"        → redirects to the new thread page.
 *   - "role" / "all" → returns a state pointing back to the list with a
 *     successBulk message.
 *
 * Notifications fan out via `notifyMessage` per recipient AFTER the bulk
 * insert succeeds, so partial-success scenarios still tell the recipients
 * who actually got a thread.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAccess } from "@/lib/auth/access";
import { env } from "@/lib/env";
import { composeBulk, composeToUser } from "@/lib/messaging/compose";
import { notifyMessage } from "@/lib/messaging/notify";
import type { AppRole } from "@/lib/supabase/server";

const targetSchema = z.enum(["user", "role", "all"]);
const roleSchema = z.enum(["organizer", "supplier", "admin", "agency"]);
const uuidSchema = z.string().uuid();

function appUrl(): string {
  return env?.APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
}

export type ComposeState =
  | { status: "idle" }
  | { status: "ok-bulk"; recipientCount: number; campaignId: string }
  | {
      status: "error";
      message: string;
      code?:
        | "validation"
        | "not_found"
        | "too_many"
        | "no_recipients"
        | "error";
    };

export async function composeAction(
  _prev: ComposeState,
  formData: FormData,
): Promise<ComposeState> {
  const gate = await requireAccess("messaging.admin.write");

  const tt = targetSchema.safeParse(formData.get("target_type"));
  if (!tt.success) {
    return { status: "error", message: "invalid target", code: "validation" };
  }
  const subject = (formData.get("subject") ?? "").toString().trim().slice(0, 200);
  const body = (formData.get("body") ?? "").toString();
  if (subject.length === 0 || body.trim().length === 0) {
    return { status: "error", message: "subject and body are required", code: "validation" };
  }

  if (tt.data === "user") {
    // The recipient is picked from /admin/users and arrives as a user_id —
    // no free-text email resolution anymore. `composeToUser` validates the
    // profile exists and returns `not_found` if it doesn't.
    const idParse = uuidSchema.safeParse(formData.get("user_id"));
    if (!idParse.success) {
      return { status: "error", message: "invalid user", code: "validation" };
    }
    const targetId = idParse.data;

    // Idempotency: the form mints a stable request_id once per mount, so a
    // double-click / retry collapses into the same thread via the unique index
    // on app_feedback.request_id. Fall back to a fresh id if it's missing.
    const requestIdParse = uuidSchema.safeParse(formData.get("request_id"));
    const requestId = requestIdParse.success
      ? requestIdParse.data
      : crypto.randomUUID();

    const result = await composeToUser({
      admin: gate.admin,
      sender_admin_id: gate.user.id,
      target_user_id: targetId,
      subject,
      body,
      request_id: requestId,
    });
    if (!result.ok) {
      return { status: "error", message: result.error ?? "send failed", code: result.code };
    }

    // Only fan out a notification + email when this call actually created the
    // thread. On an idempotent replay (double-click → same request_id,
    // `created: false`) we skip it — otherwise the bridge would enqueue a
    // duplicate message.received email keyed on a fresh notification id.
    if (result.created) {
      // Resolve the recipient role for the per-recipient notification.
      const { data: roleRows } = await gate.admin
        .from("profiles")
        .select("role")
        .eq("id", targetId)
        .limit(1);
      const recipRole =
        ((roleRows ?? [])[0] as { role: string } | undefined)?.role ?? "organizer";

      // Single-user dedicated compose → notify in-app AND email the recipient.
      // `email_notify` is the signal the notifications → email_outbox bridge
      // keys on; bulk broadcasts below intentionally omit it (in-app only).
      // Awaited, not fire-and-forget: the redirect below would otherwise let
      // the runtime drop the promise before the enqueue lands.
      await notifyMessage({
        admin: gate.admin,
        kind: "message.received",
        recipient_user_id: targetId,
        recipient_role: recipRole as AppRole,
        thread_id: result.thread_id,
        sender_role: "admin",
        body,
        email_notify: true,
        thread_url: `${appUrl()}/${recipRole}/messages/${result.thread_id}`,
      });
    }

    revalidatePath(`/admin/messages/${result.thread_id}`);
    revalidatePath("/admin/messages");
    redirect(`/admin/messages/${result.thread_id}`);
  }

  // Bulk path: role or all
  const role: AppRole | null =
    tt.data === "all"
      ? null
      : (() => {
          const r = roleSchema.safeParse(formData.get("role"));
          return r.success ? (r.data as AppRole) : null;
        })();
  if (tt.data === "role" && role === null) {
    return { status: "error", message: "invalid role", code: "validation" };
  }

  const campaignId = crypto.randomUUID();
  const result = await composeBulk({
    admin: gate.admin,
    sender_admin_id: gate.user.id,
    role,
    subject,
    body,
    campaign_id: campaignId,
  });
  if (!result.ok) {
    return { status: "error", message: result.error ?? "send failed", code: result.code };
  }

  // Per-recipient notifications. We pull (user_id, role) for this campaign.
  const { data: threadRows } = await gate.admin
    .from("app_feedback")
    .select("id, user_id, role")
    .eq("campaign_id", campaignId);
  const threads = (threadRows ?? []) as { id: string; user_id: string; role: AppRole }[];
  await Promise.all(
    threads.map((t) =>
      notifyMessage({
        admin: gate.admin,
        kind: "message.received",
        recipient_user_id: t.user_id,
        recipient_role: t.role,
        thread_id: t.id,
        sender_role: "admin",
        body,
      }),
    ),
  );

  revalidatePath("/admin/messages");
  return {
    status: "ok-bulk",
    recipientCount: result.recipient_count,
    campaignId,
  };
}
