"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";

const COOKIE_PREFIX = "sevent_celebrated_";
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

/**
 * Persists a "celebration dismissed" marker per supplier id so the approval
 * banner doesn't re-appear on every dashboard visit after the first time.
 * Bound to a specific id via .bind() at the call site; the dashboard page
 * reads the cookie on the next render to decide whether to show the banner.
 */
export async function dismissCelebrationAction(supplierId: string): Promise<void> {
  const jar = await cookies();
  jar.set(`${COOKIE_PREFIX}${supplierId}`, "1", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_S,
  });
  revalidatePath("/supplier/dashboard");
}

/**
 * Stamps `suppliers.first_seen_approved_at` the first time an approved
 * supplier lands on the dashboard after approval. Idempotent — the update
 * is gated with `.is('first_seen_approved_at', null)` so a second call is
 * a no-op and the celebration screen won't re-render on subsequent visits.
 *
 * Returns `{ ok: false }` when the caller is not an authenticated supplier;
 * the client component treats that as a silent no-op (the worst case is
 * the banner showing twice, which we already tolerate on cookie clears).
 */
export async function markApprovedSeenAction(): Promise<{ ok: boolean }> {
  const gate = await requireRole("supplier");
  if (gate.status !== "ok") return { ok: false };
  const { user, admin } = gate;
  await admin
    .from("suppliers")
    .update({ first_seen_approved_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .is("first_seen_approved_at", null);
  // Revalidate so the next navigation renders the steady-state dashboard
  // rather than the celebration branch.
  revalidatePath("/supplier/dashboard");
  return { ok: true };
}
