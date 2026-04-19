"use client";

import { useActionState, useState } from "react";
import {
  approveSupplierAction,
  rejectSupplierAction,
} from "../actions";
import { initialActionState } from "../action-state";
import { ActionBanner } from "./ActionBanner";
import { SubmitButton } from "./SubmitButton";

export function SupplierActions({
  supplierId,
  defaultNotes,
}: {
  supplierId: string;
  defaultNotes?: string | null;
}) {
  const [approveState, approve] = useActionState(
    approveSupplierAction,
    initialActionState,
  );
  const [rejectState, reject] = useActionState(
    rejectSupplierAction,
    initialActionState,
  );
  const [showReject, setShowReject] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-white p-4">
      <h2 className="text-base font-semibold">Decision</h2>

      <ActionBanner state={approveState} />
      <ActionBanner state={rejectState} />

      <div className="flex flex-wrap items-center gap-2">
        <form action={approve}>
          <input type="hidden" name="supplier_id" value={supplierId} />
          <SubmitButton variant="primary" pendingLabel="Approving…">
            Approve supplier
          </SubmitButton>
        </form>
        <button
          type="button"
          onClick={() => setShowReject((v) => !v)}
          className="inline-flex items-center justify-center rounded-md border border-[#F2C2C2] bg-white px-3 py-1.5 text-sm font-medium text-[#9F1A1A] hover:bg-[#FCE9E9]"
        >
          {showReject ? "Cancel rejection" : "Reject…"}
        </button>
      </div>

      {showReject ? (
        <form action={reject} className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
          <input type="hidden" name="supplier_id" value={supplierId} />
          <label
            htmlFor="reject-notes"
            className="text-xs font-medium text-[var(--color-muted-foreground)]"
          >
            Notes to supplier (required)
          </label>
          <textarea
            id="reject-notes"
            name="notes"
            required
            minLength={1}
            maxLength={2000}
            rows={4}
            defaultValue={defaultNotes ?? ""}
            placeholder="Explain what needs to be fixed before resubmitting."
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:border-[var(--color-sevent-green)] focus:outline-none focus:ring-1 focus:ring-[var(--color-sevent-green)]"
          />
          <div className="flex justify-end">
            <SubmitButton variant="danger" pendingLabel="Sending…">
              Reject and notify
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
