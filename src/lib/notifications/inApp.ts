/**
 * In-app notification writer.
 *
 * Inserts a row into `public.notifications`. Use the service-role client so
 * RLS does not block writes performed on behalf of another user (e.g. admin
 * notifying a supplier of an approval).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationKind =
  | "supplier.approved"
  | "supplier.rejected"
  | "supplier.doc.approved"
  | "supplier.doc.rejected"
  | "supplier.email.delivery_failed"
  // Sprint 4 — quote + booking lifecycle (in-app rows; Resend wired in Sprint 5)
  | "quote.sent"
  | "quote.revised"
  | "quote.accepted"
  | "quote.rejected"
  | "quote.proposal_requested"
  | "quote.proposal_fulfilled"
  | "booking.created"
  | "booking.awaiting_supplier";

export type CreateNotificationParams = {
  /** Supabase client with INSERT rights on `public.notifications` (service role). */
  supabase: SupabaseClient;
  user_id: string;
  kind: NotificationKind | string;
  payload?: Record<string, unknown>;
};

export type CreateNotificationResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createNotification(
  params: CreateNotificationParams,
): Promise<CreateNotificationResult> {
  const { supabase, user_id, kind, payload } = params;
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id,
      kind,
      payload_jsonb: payload ?? {},
    })
    .select("id")
    .single();
  if (error || !data) {
    const message = error?.message ?? "no data";
    console.error("[notifications/inApp] insert failed", { user_id, kind, message });
    return { ok: false, error: message };
  }
  return { ok: true, id: data.id as string };
}
