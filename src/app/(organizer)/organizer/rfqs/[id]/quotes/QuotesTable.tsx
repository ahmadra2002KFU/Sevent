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
 *
 * VISUAL RESTYLE (Lane 2): shadcn Table + Button + StatusPill. Action
 * plumbing (useActionState / acceptQuoteAction) is unchanged.
 */

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Check, ExternalLink, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import { formatHalalas } from "@/lib/domain/money";
import { acceptQuoteAction } from "./actions";
import { initialActionState, type ActionState } from "./action-state";

export type QuoteRowData = {
  quote_id: string;
  supplier_id: string;
  supplier_business_name: string;
  supplier_base_city: string | null;
  total_halalas: number;
  expires_at: string | null;
  submitted_at: string | null;
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
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          Accepting…
        </>
      ) : (
        <>
          <Check aria-hidden />
          Accept
        </>
      )}
    </Button>
  );
}

function QuoteRow({ rfqId, row }: { rfqId: string; row: QuoteRowData }) {
  const [state, action] = useActionState<ActionState, FormData>(
    acceptQuoteAction,
    initialActionState,
  );

  return (
    <>
      <TableRow className="align-top">
        <TableCell className="px-4 py-4">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-brand-navy-900">
              {row.supplier_business_name}
            </span>
            {row.supplier_base_city ? (
              <span className="text-xs text-muted-foreground">
                {row.supplier_base_city}
              </span>
            ) : null}
            {row.has_conflict ? (
              <span
                title="This supplier already has a block overlapping your event window. Accepting will fail."
                className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-semantic-danger-100 px-2.5 py-0.5 text-xs font-medium text-semantic-danger-500"
              >
                <AlertTriangle className="size-3" aria-hidden />
                Date conflict
              </span>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="px-4 py-4 whitespace-nowrap font-semibold text-brand-navy-900 tabular-nums">
          {formatHalalas(row.total_halalas)}
        </TableCell>
        <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
          {fmt(row.expires_at)}
        </TableCell>
        <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
          {fmt(row.submitted_at)}
        </TableCell>
        <TableCell className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/organizer/rfqs/${rfqId}/quotes/${row.quote_id}`}
              >
                <ExternalLink aria-hidden />
                View snapshot
              </Link>
            </Button>
            <form action={action}>
              <input type="hidden" name="quote_id" value={row.quote_id} />
              <input type="hidden" name="rfq_id" value={rfqId} />
              <AcceptSubmit />
            </form>
          </div>
        </TableCell>
      </TableRow>
      {state.status === "error" ? (
        <TableRow>
          <TableCell colSpan={5} className="px-4 py-2">
            <Alert variant="destructive">
              <AlertTriangle aria-hidden />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function QuotesTable({ rfqId, rows }: Props) {
  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No quotes have arrived yet.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-4">Supplier</TableHead>
            <TableHead className="px-4">Total</TableHead>
            <TableHead className="px-4">Expires</TableHead>
            <TableHead className="px-4">Submitted</TableHead>
            <TableHead className="px-4">
              <StatusPill
                className="invisible"
                status="draft"
                label="Actions"
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <QuoteRow key={row.quote_id} rfqId={rfqId} row={row} />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
