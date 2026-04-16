/**
 * Sevent supplier responsiveness — 30-day response-rate calculator.
 *
 * Feeds the `responsiveness` dimension of the auto-match ranker. Looks at
 * `rfq_invites` rows in the last 30 days and returns the fraction of invites
 * that were responded to (status in ('quoted','declined')) before the
 * `response_due_at` deadline.
 *
 * IMPORTANT: Returns `null` when the supplier has fewer than 5 invites in the
 * window so that the ranker can substitute a neutral baseline of 0.5 instead
 * of over-indexing on noisy small-sample data (per Codex review).
 */

export async function computeResponseRate30d(
  _supplierId: string,
): Promise<number | null> {
  throw new Error("computeResponseRate30d not implemented — Lane 2");
}
