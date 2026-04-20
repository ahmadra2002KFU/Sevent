"use server";

/**
 * Admin notification inbox — server actions. Mirror of the organizer
 * version; see `src/app/(organizer)/organizer/notifications/actions.ts` for
 * design notes. The admin inbox shows rows owned by the admin's own profile
 * (future admin-scoped alerts); the dashboard still renders the global
 * firehose.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

export async function markOneReadAction(formData: FormData): Promise<void> {
  const gate = await requireRole("admin");
  if (gate.status !== "ok") return;

  const parsed = idSchema.safeParse(formData.get("notification_id"));
  if (!parsed.success) return;

  const now = new Date().toISOString();
  const { error } = await gate.admin
    .from("notifications")
    .update({ read_at: now })
    .eq("id", parsed.data)
    .eq("user_id", gate.user.id)
    .is("read_at", null);

  if (error) {
    console.error("[admin/notifications] markOne failed", error);
    return;
  }

  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}

export async function markAllReadAction(): Promise<void> {
  const gate = await requireRole("admin");
  if (gate.status !== "ok") return;

  const now = new Date().toISOString();
  const { error } = await gate.admin
    .from("notifications")
    .update({ read_at: now })
    .eq("user_id", gate.user.id)
    .is("read_at", null);

  if (error) {
    console.error("[admin/notifications] markAll failed", error);
    return;
  }

  revalidatePath("/admin/notifications");
  revalidatePath("/admin");
}
