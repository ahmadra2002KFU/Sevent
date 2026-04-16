/**
 * Sevent supplier responsiveness — 30-day response-rate calculator.
 *
 * Feeds the `responsiveness` dimension of the auto-match ranker. Looks at
 * `rfq_invites` rows in the last 30 days and returns the fraction of invites
 * that were responded to within 24 hours of being sent.
 *
 * IMPORTANT: Returns `null` when the supplier has fewer than 5 invites in the
 * window so that the ranker can substitute a neutral baseline of 0.5 instead
 * of over-indexing on noisy small-sample data (per Codex review).
 *
 * Uses the service-role client because this is a cross-supplier aggregation —
 * RLS policies on `rfq_invites` scope anon reads to the organizer or the
 * owning supplier, neither of which is the right scope when the auto-match
 * engine scores candidates on behalf of an organizer. Mirrors the Sprint 2
 * admin actions pattern (see `src/app/(admin)/admin/verifications/actions.ts`).
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const MIN_SAMPLE = 5;
const WINDOW_DAYS = 30;
const RESPONSE_WINDOW_HOURS = 24;
const MS_PER_HOUR = 3600 * 1000;
const RESPONSE_WINDOW_MS = RESPONSE_WINDOW_HOURS * MS_PER_HOUR;

export async function computeResponseRate30d(
  supplierId: string,
): Promise<number | null> {
  const supabase = await createSupabaseServiceRoleClient();
  const cutoff = new Date(
    Date.now() - WINDOW_DAYS * 24 * MS_PER_HOUR,
  ).toISOString();

  const { data, error } = await supabase
    .from("rfq_invites")
    .select("sent_at, responded_at")
    .eq("supplier_id", supplierId)
    .gt("sent_at", cutoff);

  if (error) {
    // Fail soft — ranker treats null as neutral 0.5 baseline.
    return null;
  }

  const rows = (data ?? []) as Array<{
    sent_at: string;
    responded_at: string | null;
  }>;

  const total = rows.length;
  if (total < MIN_SAMPLE) return null;

  let respondedInWindow = 0;
  for (const row of rows) {
    if (!row.responded_at) continue;
    const sent = Date.parse(row.sent_at);
    const responded = Date.parse(row.responded_at);
    if (Number.isNaN(sent) || Number.isNaN(responded)) continue;
    if (responded - sent < RESPONSE_WINDOW_MS) {
      respondedInWindow += 1;
    }
  }

  return respondedInWindow / total;
}
