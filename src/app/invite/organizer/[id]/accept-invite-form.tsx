"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  acceptInviteAction,
  type AcceptInviteState,
} from "./actions";

const initial: AcceptInviteState = { status: "idle" };

export function AcceptInviteForm({
  inviteId,
  token,
}: {
  inviteId: string;
  token: string;
}) {
  const t = useTranslations("organizer.invite");
  const [state, action] = useActionState<AcceptInviteState, FormData>(
    acceptInviteAction,
    initial,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="invite_id" value={inviteId} />
      <input type="hidden" name="token" value={token} />

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertDescription>
            {t(`errors.${state.code}` as never)}
          </AlertDescription>
        </Alert>
      ) : null}

      <SubmitButton label={t("acceptCta")} pendingLabel={t("acceptPending")} />
    </form>
  );
}

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg" className="w-fit">
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        <>
          <CheckCircle2 aria-hidden />
          {label}
        </>
      )}
    </Button>
  );
}
