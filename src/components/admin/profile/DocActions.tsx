"use client";

import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import {
  approveDocAction,
  rejectDocAction,
} from "@/app/(admin)/admin/verifications/actions";
import { initialActionState } from "@/app/(admin)/admin/verifications/action-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActionBanner } from "./ActionBanner";
import { SubmitButton } from "./SubmitButton";

/**
 * Per-document approve / reject buttons. Used by both the initial-review
 * verifications page and the Sheet's re-review surface. Server actions write
 * an audit-log row internally, so this component stays presentation-only.
 *
 * On a stale state (the supplier re-uploaded between page render and submit)
 * the server action returns a clear message via `ActionBanner` and the admin
 * can reload — no double-write.
 */
export function DocActions({
  docId,
  supplierId,
  currentStatus,
  currentNotes,
}: {
  docId: string;
  supplierId: string;
  currentStatus: "pending" | "approved" | "rejected";
  currentNotes: string | null;
}) {
  const t = useTranslations("admin.verifications");
  const [approveState, approve] = useActionState(
    approveDocAction,
    initialActionState,
  );
  const [rejectState, reject] = useActionState(
    rejectDocAction,
    initialActionState,
  );
  const [showReject, setShowReject] = useState(false);
  const notesId = useId();

  return (
    <div className="flex flex-col gap-2">
      <ActionBanner state={approveState} />
      <ActionBanner state={rejectState} />

      <div className="flex flex-wrap items-center gap-2">
        {currentStatus !== "approved" ? (
          <form action={approve}>
            <input type="hidden" name="doc_id" value={docId} />
            <input type="hidden" name="supplier_id" value={supplierId} />
            <SubmitButton
              variant="outline"
              size="sm"
              pendingLabel={t("approveDoc") + "…"}
            >
              <Check aria-hidden />
              {t("approveDoc")}
            </SubmitButton>
          </form>
        ) : null}
        {currentStatus !== "rejected" ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setShowReject((v) => !v)}
          >
            <X aria-hidden />
            {showReject ? t("confirm.cancel") : t("rejectDoc")}
          </Button>
        ) : null}
      </div>

      {showReject ? (
        <form
          action={reject}
          className="mt-1 flex flex-col gap-2 rounded-md border border-border bg-muted/60 p-3"
        >
          <input type="hidden" name="doc_id" value={docId} />
          <input type="hidden" name="supplier_id" value={supplierId} />
          <Label htmlFor={notesId} className="text-xs">
            {t("notesLabel")}
          </Label>
          <Textarea
            id={notesId}
            name="notes"
            required
            minLength={1}
            maxLength={2000}
            rows={3}
            defaultValue={currentNotes ?? ""}
            placeholder={t("docNotesPlaceholder")}
          />
          <div className="flex justify-end">
            <SubmitButton
              variant="destructive"
              size="sm"
              pendingLabel={t("rejectDoc") + "…"}
            >
              {t("rejectDoc")}
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
