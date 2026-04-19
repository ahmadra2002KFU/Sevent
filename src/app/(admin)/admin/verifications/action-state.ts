// Shared state shape for the admin verification server actions.
// Kept out of `actions.ts` because Next 16 forbids non-async exports from
// "use server" files.

export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export const initialActionState: ActionState = { status: "idle" };
