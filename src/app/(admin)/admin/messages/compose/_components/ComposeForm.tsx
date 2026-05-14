"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  composeAction,
  type ComposeState,
} from "../actions";

const initial: ComposeState = { status: "idle" };

const ROLES = ["supplier", "organizer", "admin", "agency"] as const;

type Labels = {
  targetType: string;
  targetTypeUser: string;
  targetTypeRole: string;
  targetTypeAll: string;
  recipientLabel: string;
  noUserSelected: string;
  pickUserCta: string;
  role: string;
  roleLabels: Record<(typeof ROLES)[number], string>;
  subject: string;
  subjectPlaceholder: string;
  body: string;
  bodyPlaceholder: string;
  send: string;
  sending: string;
  successSingle: string;
  successBulk: string;
  errorEmpty: string;
  errorNoTarget: string;
  errorTooMany: string;
  errorNotFound: string;
  errorGeneric: string;
};

export type PreselectedUser = {
  id: string;
  name: string;
  email: string | null;
};

export type ComposeFormProps = {
  labels: Labels;
  /**
   * Set when the page was opened with `?user_id=` from the users list. Drives
   * the "specific user" mode — there is no free-text email input anymore.
   */
  preselectedUser: PreselectedUser | null;
};

export function ComposeForm({ labels, preselectedUser }: ComposeFormProps) {
  const [state, action] = useActionState(composeAction, initial);
  const [target, setTarget] = useState<"user" | "role" | "all">(
    preselectedUser ? "user" : "role",
  );
  // Minted once per form mount: a double-click / retry reuses the same id, so
  // `composeToUser` collapses the duplicate via the unique index on
  // `app_feedback.request_id` instead of creating a second thread.
  const [requestId] = useState(() => crypto.randomUUID());

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="request_id" value={requestId} />
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{labels.targetType}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="target_type"
                value="user"
                checked={target === "user"}
                onChange={() => setTarget("user")}
              />
              {labels.targetTypeUser}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="target_type"
                value="role"
                checked={target === "role"}
                onChange={() => setTarget("role")}
              />
              {labels.targetTypeRole}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="target_type"
                value="all"
                checked={target === "all"}
                onChange={() => setTarget("all")}
              />
              {labels.targetTypeAll}
            </label>
          </fieldset>

          {target === "user" ? (
            preselectedUser ? (
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{labels.recipientLabel}</span>
                <div className="flex flex-col rounded-md border border-border bg-muted/40 px-3 py-2">
                  <span className="font-medium text-foreground">
                    {preselectedUser.name}
                  </span>
                  {preselectedUser.email ? (
                    <span className="text-xs text-muted-foreground">
                      {preselectedUser.email}
                    </span>
                  ) : null}
                </div>
                <input
                  type="hidden"
                  name="user_id"
                  value={preselectedUser.id}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-3 text-sm">
                <span className="text-muted-foreground">
                  {labels.noUserSelected}
                </span>
                <Button asChild variant="outline" size="sm" className="w-fit">
                  <Link href="/admin/users">{labels.pickUserCta}</Link>
                </Button>
              </div>
            )
          ) : null}

          {target === "role" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{labels.role}</span>
              <select
                name="role"
                required
                className="h-10 rounded-md border border-border bg-background px-2 text-sm"
                defaultValue="supplier"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {labels.roleLabels[r]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{labels.subject}</span>
            <input
              type="text"
              name="subject"
              required
              maxLength={200}
              placeholder={labels.subjectPlaceholder}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{labels.body}</span>
            <Textarea
              name="body"
              rows={6}
              required
              minLength={1}
              maxLength={10000}
              placeholder={labels.bodyPlaceholder}
              className="resize-y"
            />
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <span
          className="text-sm"
          role="status"
          aria-live="polite"
        >
          {state.status === "ok-bulk" ? (
            <span className="text-semantic-success-500">
              {labels.successBulk.replace("{count}", String(state.recipientCount))}
            </span>
          ) : state.status === "error" ? (
            <span className="text-semantic-danger-500">
              {humanizeError(state, labels)}
            </span>
          ) : null}
        </span>
        <Submit
          sendLabel={labels.send}
          sendingLabel={labels.sending}
          disabled={target === "user" && !preselectedUser}
        />
      </div>
    </form>
  );
}

function Submit({
  sendLabel,
  sendingLabel,
  disabled,
}: {
  sendLabel: string;
  sendingLabel: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending || disabled}>
      {pending ? sendingLabel : sendLabel}
    </Button>
  );
}

function humanizeError(
  state: Extract<ComposeState, { status: "error" }>,
  labels: Labels,
): string {
  switch (state.code) {
    case "not_found":
      return labels.errorNotFound;
    case "too_many":
      return labels.errorTooMany;
    case "validation":
      return labels.errorEmpty;
    case "no_recipients":
      return labels.errorNoTarget;
    default:
      return state.message || labels.errorGeneric;
  }
}
