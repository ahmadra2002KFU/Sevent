"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ResolveActionState } from "./actions";

type Action = (
  prev: ResolveActionState | undefined,
  formData: FormData,
) => Promise<ResolveActionState>;

export type ResolveDisputeFormProps = {
  resolveAction: Action;
  closeAction: Action;
  labels: {
    noteLabel: string;
    notePlaceholder: string;
    resolveButton: string;
    closeButton: string;
    actionSuccess: string;
  };
};

/**
 * Two-button form: one form submits to `resolveAction`, the other to
 * `closeAction`. We expose them as separate forms (rather than `formAction`
 * on each button) so React's `useActionState` tracks them independently and
 * shows the right success/error message.
 */
export function ResolveDisputeForm({
  resolveAction,
  closeAction,
  labels,
}: ResolveDisputeFormProps) {
  const [resolveState, resolveFormAction] = useActionState<
    ResolveActionState,
    FormData
  >(resolveAction as never, { status: "idle" });
  const [closeState, closeFormAction] = useActionState<
    ResolveActionState,
    FormData
  >(closeAction as never, { status: "idle" });

  const latestErr =
    resolveState.status === "error"
      ? resolveState.message
      : closeState.status === "error"
        ? closeState.message
        : null;
  const latestOk =
    resolveState.status === "success" || closeState.status === "success";

  return (
    <div className="flex flex-col gap-4">
      <form action={resolveFormAction} className="flex flex-col gap-3">
        <label htmlFor="resolution_note" className="text-sm font-medium">
          {labels.noteLabel}
        </label>
        <textarea
          id="resolution_note"
          name="resolution_note"
          rows={4}
          maxLength={2000}
          placeholder={labels.notePlaceholder}
          className="rounded-md border border-input bg-background p-3 text-sm"
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="submit" variant="default">
            {labels.resolveButton}
          </Button>
        </div>
      </form>

      <form action={closeFormAction} className="flex justify-end">
        {/* Closing reuses the textarea above visually — but submits a separate form. */}
        <Button type="submit" variant="outline">
          {labels.closeButton}
        </Button>
      </form>

      {latestErr ? (
        <Alert variant="destructive">
          <AlertDescription>{latestErr}</AlertDescription>
        </Alert>
      ) : null}
      {latestOk ? (
        <Alert>
          <AlertDescription>{labels.actionSuccess}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
