// Shared state shape for the organizer quote-acceptance server action.
// Kept out of `actions.ts` because Next 16 forbids non-async exports from
// "use server" files. Success is usually surfaced via redirect(); the "error"
// branch is what useActionState will render when the RPC refuses.

// The "error" branch carries a stable `code` mapped to a localized string at
// the render boundary (see QuoteComparisonGrid). `message` stays as an
// optional non-localized fallback; UI must prefer `code`.
export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      code: string;
      params?: Record<string, string | number>;
      message?: string;
    };

export const initialActionState: ActionState = { status: "idle" };

// Shape for the proposal-request actions (request / cancel). Same idle/success/
// error tri-state, but kept separate so a future divergence (e.g. carrying a
// new request_id back) doesn't bleed into the accept-quote contract.
export type RfpRequestActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      code: string;
      params?: Record<string, string | number>;
      message?: string;
    };

export const initialRfpRequestActionState: RfpRequestActionState = {
  status: "idle",
};
