"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  userReplyAction,
  type UserReplyState,
} from "@/app/_actions/messaging";

const initial: UserReplyState = { status: "idle" };

export type UserReplyComposerProps = {
  thread_id: string;
  disabled?: boolean;
  placeholder: string;
  sendLabel: string;
  sendingLabel: string;
  errorLabel: string;
  errorClosedLabel: string;
};

export function UserReplyComposer(props: UserReplyComposerProps) {
  const [state, action] = useActionState(userReplyAction, initial);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (state.status === "ok" && formRef.current) {
      formRef.current.reset();
      const ta = formRef.current.querySelector<HTMLTextAreaElement>('textarea[name="body"]');
      ta?.focus();
    }
  }, [state.status]);

  if (props.disabled) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
        {props.errorClosedLabel}
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="thread_id" value={props.thread_id} />
      <Textarea
        name="body"
        rows={3}
        required
        minLength={1}
        maxLength={10000}
        placeholder={props.placeholder}
        className="resize-y"
      />
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-sm text-semantic-danger-500"
          role="status"
          aria-live="polite"
        >
          {state.status === "error"
            ? state.code === "closed"
              ? props.errorClosedLabel
              : (state.message ?? props.errorLabel)
            : null}
        </span>
        <Submit sendLabel={props.sendLabel} sendingLabel={props.sendingLabel} />
      </div>
    </form>
  );
}

function Submit({
  sendLabel,
  sendingLabel,
}: {
  sendLabel: string;
  sendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? sendingLabel : sendLabel}
    </Button>
  );
}
