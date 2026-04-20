// Shared state shape for the supplier quote builder server action.
// Kept out of `actions.ts` because Next 16 forbids non-async exports from
// "use server" files (mirrors src/app/(admin)/admin/verifications/action-state.ts).

export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export const initialActionState: ActionState = { status: "idle" };
