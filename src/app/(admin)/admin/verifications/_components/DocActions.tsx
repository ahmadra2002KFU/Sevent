"use client";

import { useActionState, useState } from "react";
import {
  approveDocAction,
  rejectDocAction,
  initialActionState,
} from "../actions";
import { ActionBanner } from "./ActionBanner";
import { SubmitButton } from "./SubmitButton";

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
  const [approveState, approve] = useActionState(
    approveDocAction,
    initialActionState,
  );
  const [rejectState, reject] = useActionState(
    rejectDocAction,
    initialActionState,
  );
  const [showReject, setShowReject] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <ActionBanner state={approveState} />
      <ActionBanner state={rejectState} />

      <div className="flex flex-wrap items-center gap-2">
        {currentStatus !== "approved" ? (
          <form action={approve}>
            <input type="hidden" name="doc_id" value={docId} />
            <input type="hidden" name="supplier_id" value={supplierId} />
            <SubmitButton variant="secondary" pendingLabel="Approving…">
              Mark approved
            </SubmitButton>
          </form>
        ) : null}
        {currentStatus !== "rejected" ? (
          <button
            type="button"
            onClick={() => setShowReject((v) => !v)}
            className="inline-flex items-center justify-center rounded-md border border-[#F2C2C2] bg-white px-3 py-1.5 text-sm font-medium text-[#9F1A1A] hover:bg-[#FCE9E9]"
          >
            {showReject ? "Cancel" : "Mark rejected…"}
          </button>
        ) : null}
      </div>

      {showReject ? (
        <form
          action={reject}
          className="mt-1 flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-3"
        >
          <input type="hidden" name="doc_id" value={docId} />
          <input type="hidden" name="supplier_id" value={supplierId} />
          <label
            htmlFor={`doc-notes-${docId}`}
            className="text-xs font-medium text-[var(--color-muted-foreground)]"
          >
            Reason for rejection
          </label>
          <textarea
            id={`doc-notes-${docId}`}
            name="notes"
            required
            minLength={1}
            maxLength={2000}
            rows={3}
            defaultValue={currentNotes ?? ""}
            placeholder="What is wrong or missing with this document?"
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:border-[var(--color-sevent-green)] focus:outline-none focus:ring-1 focus:ring-[var(--color-sevent-green)]"
          />
          <div className="flex justify-end">
            <SubmitButton variant="danger" pendingLabel="Saving…">
              Save rejection
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
