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
import { composeBulk, composeToUser } from "@/lib/messaging/compose";
import { notifyMessage } from "@/lib/messaging/notify";
import type { AppRole } from "@/lib/supabase/server";

const targetSchema = z.enum(["user", "role", "all"]);
const roleSchema = z.enum(["organizer", "supplier", "admin", "agency"]);
const emailSchema = z.string().email();

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
    const emailParse = emailSchema.safeParse(formData.get("user_email"));
    if (!emailParse.success) {
      return { status: "error", message: "invalid email", code: "validation" };
    }
    // Look up user id by email. Service-role admin auth API.
    const { data: list } = await gate.admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    void list;
    // listUsers doesn't accept a filter — issue a profile-side lookup instead.
    // We don't store emails in profiles; fall back to listing through pages
    // is too slow at scale, so we use `auth.admin.getUserByEmail`-style via a
    // PostgREST view. For v1: just iterate auth.users by email.
    const { data: matchUsers } = await gate.admin
      .from("profiles")
      .select("id")
      .eq("id", await resolveUserIdByEmail(gate.admin, emailParse.data));
    const targetId = (matchUsers ?? [])[0]?.id as string | undefined;
    if (!targetId) {
      return { status: "error", message: "no user with that email", code: "not_found" };
    }

    const requestId = crypto.randomUUID();
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

    // Resolve the recipient role for the deep-link.
    const { data: roleRows } = await gate.admin
      .from("profiles")
      .select("role")
      .eq("id", targetId)
      .limit(1);
    const recipRole =
      ((roleRows ?? [])[0] as { role: string } | undefined)?.role ?? "organizer";

    void notifyMessage({
      admin: gate.admin,
      kind: "message.received",
      recipient_user_id: targetId,
      recipient_role: recipRole as AppRole,
      thread_id: result.thread_id,
      sender_role: "admin",
      body,
    });

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

/**
 * Resolve a user id from an email by paging auth.users 1 page at a time.
 * For v1 this is fine — admin compose is a low-volume action and the page
 * size stays small. v2 should add a `profiles_with_email` view.
 */
async function resolveUserIdByEmail(
  admin: import("@supabase/supabase-js").SupabaseClient,
  email: string,
): Promise<string | undefined> {
  const PER_PAGE = 200;
  for (let page = 1; page <= 50 /* hard ceiling */; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error) {
      console.error("[admin/messages/compose] listUsers err", error);
      return undefined;
    }
    const users = data?.users ?? [];
    const match = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (users.length < PER_PAGE) return undefined;
  }
  return undefined;
}
