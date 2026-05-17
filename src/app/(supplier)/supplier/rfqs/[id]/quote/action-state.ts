// Shared state shape for the supplier quote builder server action.
// Kept out of `actions.ts` because Next 16 forbids non-async exports from
// "use server" files (mirrors src/app/(admin)/admin/verifications/action-state.ts).

// The "error" branch carries a stable `code` that the form component maps to a
// localized string via `t("supplier.quote.errors.<code>")`. `message` is kept
// as a non-localized fallback for the rare uncoded path; UI must prefer `code`.
export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; code: string; message?: string };

export const initialActionState: ActionState = { status: "idle" };
