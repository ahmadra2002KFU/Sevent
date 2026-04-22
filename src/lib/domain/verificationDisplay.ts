/**
 * Cosmetic mapping from supplier.verification_status → a 5-check display list.
 *
 * The DB exposes a single enum (pending / approved / rejected). We don't yet
 * track per-check state server-side. This helper synthesises a plausible 5-row
 * display so the pending-review screen gives the right affordance (something
 * done, something in-flight, something still queued) without requiring new
 * backend columns. Callers should consider the output presentation-only.
 */

export type CheckKey = "wathq" | "identity" | "iban" | "portfolio" | "badge";

export type CheckState = "done" | "running" | "waiting" | "failed";

export type ChecklistItem = {
  key: CheckKey;
  state: CheckState;
};

const ALL_KEYS: ReadonlyArray<CheckKey> = [
  "wathq",
  "identity",
  "iban",
  "portfolio",
  "badge",
];

/**
 * Map supplier.verification_status to 5 cosmetic per-check states.
 *
 *  - `approved`  → every row marked `done` (post-approval recap).
 *  - `rejected`  → every row marked `failed` so the UI can render the error
 *                  affordance; caller decides how to communicate it.
 *  - `pending`   → aspirational progression: 2 done, 1 running, 2 waiting.
 *                  Mirrors the direction-a mockup at Screen 6 so the screen
 *                  always shows motion.
 */
export function deriveChecklistStates(
  verificationStatus: "pending" | "approved" | "rejected",
): ChecklistItem[] {
  if (verificationStatus === "approved") {
    return ALL_KEYS.map((key) => ({ key, state: "done" as CheckState }));
  }
  if (verificationStatus === "rejected") {
    return ALL_KEYS.map((key) => ({ key, state: "failed" as CheckState }));
  }
  // pending — aspirational progression
  return [
    { key: "wathq", state: "done" },
    { key: "identity", state: "done" },
    { key: "iban", state: "running" },
    { key: "portfolio", state: "waiting" },
    { key: "badge", state: "waiting" },
  ];
}
