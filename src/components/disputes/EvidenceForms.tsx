"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type Action = (
  prev: ActionState | undefined,
  formData: FormData,
) => Promise<ActionState>;

export type AddNoteFormProps = {
  disputeId: string;
  action: Action;
  labels: {
    heading: string;
    noteLabel: string;
    notePlaceholder: string;
    visibilityLabel: string;
    submit: string;
  };
};

/**
 * Note-evidence form. Server action receives multipart formData with
 * `dispute_id`, `kind=note`, `text_note`, optional `visible_to_other_party`.
 */
export function AddNoteForm({ disputeId, action, labels }: AddNoteFormProps) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    action as never,
    { status: "idle" },
  );
  const formRef = useRef<HTMLFormElement | null>(null);

  // Reset the textarea after a successful submission so the user can write
  // another note without manually clearing the field.
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-md border border-border p-4"
    >
      <h3 className="text-sm font-semibold text-foreground">
        {labels.heading}
      </h3>
      <input type="hidden" name="dispute_id" value={disputeId} />
      <input type="hidden" name="kind" value="note" />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">{labels.noteLabel}</span>
        <textarea
          name="text_note"
          rows={4}
          maxLength={2000}
          required
          placeholder={labels.notePlaceholder}
          className="rounded-md border border-input bg-background p-3 text-sm"
        />
      </label>
      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          name="visible_to_other_party"
          value="on"
          defaultChecked
          className="size-4 rounded border-input"
        />
        {labels.visibilityLabel}
      </label>
      <div className="flex items-center justify-between gap-3">
        {state.status === "error" ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm">
          {labels.submit}
        </Button>
      </div>
    </form>
  );
}

export type UploadFileFormProps = {
  disputeId: string;
  action: Action;
  labels: {
    heading: string;
    fileLabel: string;
    visibilityLabel: string;
    submit: string;
  };
};

/**
 * File-evidence form. Server action expects multipart with `dispute_id`,
 * `kind=file`, `file` (Blob), optional `visible_to_other_party`.
 */
export function UploadFileForm({
  disputeId,
  action,
  labels,
}: UploadFileFormProps) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    action as never,
    { status: "idle" },
  );
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-md border border-border p-4"
      encType="multipart/form-data"
    >
      <h3 className="text-sm font-semibold text-foreground">
        {labels.heading}
      </h3>
      <input type="hidden" name="dispute_id" value={disputeId} />
      <input type="hidden" name="kind" value="file" />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">{labels.fileLabel}</span>
        <input
          type="file"
          name="file"
          required
          accept="image/*,application/pdf,video/mp4,video/quicktime"
          className="text-sm"
        />
      </label>
      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          name="visible_to_other_party"
          value="on"
          defaultChecked
          className="size-4 rounded border-input"
        />
        {labels.visibilityLabel}
      </label>
      <div className="flex items-center justify-between gap-3">
        {state.status === "error" ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm" variant="outline">
          {labels.submit}
        </Button>
      </div>
    </form>
  );
}
