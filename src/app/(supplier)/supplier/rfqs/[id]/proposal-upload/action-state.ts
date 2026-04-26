// Action-state shape for the supplier proposal-upload server action. Kept
// out of `actions.ts` because Next.js 16 forbids non-async exports from
// "use server" files. Success is conveyed via redirect(); the "error" branch
// is what useActionState renders.

export type ProposalUploadActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export const initialProposalUploadActionState: ProposalUploadActionState = {
  status: "idle",
};
