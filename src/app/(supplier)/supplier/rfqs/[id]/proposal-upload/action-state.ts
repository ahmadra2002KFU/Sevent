// Action-state shape for the supplier proposal-upload server action. Kept
// out of `actions.ts` because Next.js 16 forbids non-async exports from
// "use server" files. Success is conveyed via redirect(); the "error" branch
// is what useActionState renders.

// The "error" branch carries a stable `code` that the form maps to a localized
// string via `t("supplier.proposalUpload.errors.<code>")`.
export type ProposalUploadActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; code: string; message?: string };

export const initialProposalUploadActionState: ProposalUploadActionState = {
  status: "idle",
};
