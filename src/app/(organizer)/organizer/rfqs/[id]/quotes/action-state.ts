// Shared state shape for the organizer quote-acceptance server action.
// Kept out of `actions.ts` because Next 16 forbids non-async exports from
// "use server" files. Success is usually surfaced via redirect(); the "error"
// branch is what useActionState will render when the RPC refuses.

export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export const initialActionState: ActionState = { status: "idle" };
