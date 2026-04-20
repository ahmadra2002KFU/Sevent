"use client";

/**
 * Sprint 4 Lane 3 — organizer quote comparison table.
 *
 * Each row hosts its own `<form action>` bound to `acceptQuoteAction` via
 * `useActionState`. Doing it per-row keeps the error banner local to the row
 * the organizer clicked, and means a failed accept on Supplier A doesn't
 * clear state from Supplier B's row. The conflict badge is UI-only — the
 * accept button stays enabled because the trigger (`P0007`) is the real
 * guard; if the organizer clicks through, they'll see the mapped error here.
 */

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import { formatHalalas } from "@/lib/domain/money";
import { acceptQuoteAction } from "./actions";
import { initialActionState, type ActionState } from "./action-state";

export type QuoteRowData = {
  quote_id: string;
  supplier_id: string;
  supplier_business_name: string;
  supplier_base_city: string | null;
  total_halalas: number;
  expires_at: string | null; // snapshot.expires_at
  submitted_at: string | null; // quotes.sent_at
  has_conflict: boolean;
};

type Props = {
  rfqId: string;
  rows: QuoteRowData[];
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function AcceptSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        "bg-[var(--color-sevent-green)] text-white hover:bg-[var(--color-sevent-green-soft)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      {pending ? "Accepting…" : "Accept"}
    </button>
  );
}

function QuoteRow({ rfqId, row }: { rfqId: string; row: QuoteRowData }) {
  const [state, action] = useActionState<ActionState, FormData>(
    acceptQuoteAction,
    initialActionState,
  );

  return (
    <>
      <tr className="border-t border-[var(--color-border)] align-top">
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{row.supplier_business_name}</span>
            {row.supplier_base_city ? (
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {row.supplier_base_city}
              </span>
            ) : null}
            {row.has_conflict ? (
              <span
                title="This supplier already has a block overlapping your event window. Accepting will fail."
                className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-[#F2C2C2] bg-[#FCE9E9] px-2 py-0.5 text-xs font-medium text-[#9F1A1A]"
              >
                <span aria-hidden>⚠</span>
                <span>Date conflict</span>
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap font-medium">
          {formatHalalas(row.total_halalas)}
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--color-muted-foreground)]">
          {fmt(row.expires_at)}
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--color-muted-foreground)]">
          {fmt(row.submitted_at)}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/organizer/rfqs/${rfqId}/quotes/${row.quote_id}`}
              className="inline-flex items-center justify-center rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
            >
              View snapshot
            </Link>
            <form action={action}>
              <input type="hidden" name="quote_id" value={row.quote_id} />
              <input type="hidden" name="rfq_id" value={rfqId} />
              <AcceptSubmit />
            </form>
          </div>
        </td>
      </tr>
      {state.status === "error" ? (
        <tr className="border-t border-[var(--color-border)]">
          <td colSpan={5} className="px-4 py-2">
            <div
              role="status"
              className="rounded-md border border-[#F2C2C2] bg-[#FCE9E9] px-3 py-2 text-sm text-[#9F1A1A]"
            >
              {state.message}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function QuotesTable({ rfqId, rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
        No quotes have arrived yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-muted)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          <tr>
            <th className="px-4 py-3 font-medium">Supplier</th>
            <th className="px-4 py-3 font-medium">Total</th>
            <th className="px-4 py-3 font-medium">Expires</th>
            <th className="px-4 py-3 font-medium">Submitted</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <QuoteRow key={row.quote_id} rfqId={rfqId} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
