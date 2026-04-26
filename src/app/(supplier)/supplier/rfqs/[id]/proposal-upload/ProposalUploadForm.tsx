"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { respondToProposalRequestAction } from "./actions";
import {
  initialProposalUploadActionState,
  type ProposalUploadActionState,
} from "./action-state";

export function ProposalUploadForm({ inviteId }: { inviteId: string }) {
  const t = useTranslations("supplier.rfp");
  const [state, action] = useActionState<ProposalUploadActionState, FormData>(
    respondToProposalRequestAction,
    initialProposalUploadActionState,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="invite_id" value={inviteId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="proposal-file">{t("fileLabel")}</Label>
        <Input
          id="proposal-file"
          type="file"
          name="file"
          accept="application/pdf"
          required
        />
        <p className="text-xs text-muted-foreground">{t("fileHint")}</p>
      </div>
      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <SubmitButton label={t("uploadCta")} pendingLabel={t("uploading")} />
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
    <Button type="submit" disabled={pending} className="w-fit">
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        <>
          <Upload aria-hidden />
          {label}
        </>
      )}
    </Button>
  );
}
