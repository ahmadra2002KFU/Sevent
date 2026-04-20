"use server";

/**
 * Organizer notification inbox — server actions.
 *
 * Contract:
 *  - Every entry point gates on `requireRole("organizer")` and performs an
 *    explicit `.eq("user_id", gate.user.id)` ownership filter on the write.
 *    Service-role bypasses RLS, so this explicit filter is the only thing
 *    preventing cross-user mutation.
 *  - Writes stamp `read_at = now()` (DB-side via `new Date().toISOString()` —
 *    the column is `timestamptz`).
 *  - `revalidatePath("/organizer")` refreshes the layout so the bell badge
 *    re-reads the unread count on the next render.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

/**
 * Plain FormData-shaped server actions (no useActionState / useFormState
 * wrapper). The inbox page calls these from native `<form action={...}>`
 * handlers; failures are logged server-side rather than surfaced back to the
 * caller, because the inbox re-renders on the next request and a
 * still-unread row is itself the error state.
 */
export async function markOneReadAction(formData: FormData): Promise<void> {
  const gate = await requireRole("organizer");
  if (gate.status !== "ok") return;

  const parsed = idSchema.safeParse(formData.get("notification_id"));
  if (!parsed.success) return;

  const now = new Date().toISOString();
  const { error } = await gate.admin
    .from("notifications")
    .update({ read_at: now })
    .eq("id", parsed.data)
    .eq("user_id", gate.user.id) // ownership filter — service-role bypasses RLS
    .is("read_at", null);

  if (error) {
    console.error("[organizer/notifications] markOne failed", error);
    return;
  }

  revalidatePath("/organizer/notifications");
  revalidatePath("/organizer");
}

export async function markAllReadAction(): Promise<void> {
  const gate = await requireRole("organizer");
  if (gate.status !== "ok") return;

  const now = new Date().toISOString();
  const { error } = await gate.admin
    .from("notifications")
    .update({ read_at: now })
    .eq("user_id", gate.user.id)
    .is("read_at", null);

  if (error) {
    console.error("[organizer/notifications] markAll failed", error);
    return;
  }

  revalidatePath("/organizer/notifications");
  revalidatePath("/organizer");
}
