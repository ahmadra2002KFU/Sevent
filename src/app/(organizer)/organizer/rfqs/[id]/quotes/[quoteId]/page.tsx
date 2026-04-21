/**
 * Sprint 4 Lane 3 — organizer quote detail (full snapshot view).
 *
 * Renders every field inside `quote_revisions.snapshot_jsonb` for the current
 * revision of one quote. Read-only; the accept CTA lives on the comparison
 * page so the organizer can compare side-by-side first.
 *
 * VISUAL RESTYLE (Lane 2): shadcn Card + Table + StatusPill; data shape + RPC
 * plumbing untouched.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ClockAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import {
  StatusPill,
  type StatusPillStatus,
} from "@/components/ui-ext/StatusPill";
import { authenticateAndGetAdminClient } from "@/lib/supabase/server";
import { formatHalalas } from "@/lib/domain/money";
import type { QuoteSnapshot, QuoteLineItem } from "@/lib/domain/quote";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string; quoteId: string }> };

type QuoteRow = {
  id: string;
  rfq_id: string;
  status: string;
  sent_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  current_revision_id: string | null;
  suppliers: {
    id: string;
    business_name: string;
    base_city: string | null;
  } | null;
  rfqs: {
    id: string;
    events: {
      id: string;
      organizer_id: string;
      starts_at: string;
      ends_at: string;
    } | null;
  } | null;
};

function fmt(iso: string | null | undefined): string {
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

function unitLabel(unit: QuoteLineItem["unit"]): string {
  switch (unit) {
    case "event":
      return "per event";
    case "hour":
      return "per hour";
    case "day":
      return "per day";
    case "person":
      return "per person";
    case "unit":
    default:
      return "per unit";
  }
}

function toPillStatus(raw: string): StatusPillStatus {
  const allowed: StatusPillStatus[] = [
    "draft",
    "pending",
    "sent",
    "quoted",
    "invited",
    "awaiting_supplier",
    "accepted",
    "confirmed",
    "booked",
    "approved",
    "paid",
    "completed",
    "declined",
    "rejected",
    "cancelled",
    "expired",
    "withdrawn",
  ];
  return (allowed as string[]).includes(raw)
    ? (raw as StatusPillStatus)
    : "draft";
}

export default async function OrganizerQuoteDetailPage({
  params,
}: PageProps) {
  const { id, quoteId } = await params;

  const auth = await authenticateAndGetAdminClient();
  if (!auth)
    redirect(`/sign-in?next=/organizer/rfqs/${id}/quotes/${quoteId}`);
  const { user, admin } = auth;

  const { data: quoteRaw } = await admin
    .from("quotes")
    .select(
      `id, rfq_id, status, sent_at, accepted_at, expires_at, current_revision_id,
       suppliers ( id, business_name, base_city ),
       rfqs ( id, events ( id, organizer_id, starts_at, ends_at ) )`,
    )
    .eq("id", quoteId)
    .eq("rfq_id", id)
    .maybeSingle();

  const quote = quoteRaw as unknown as QuoteRow | null;
  if (!quote || !quote.rfqs?.events) notFound();

  const ownsEvent = quote.rfqs.events.organizer_id === user.id;
  if (!ownsEvent) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role: string } | null)?.role;
    if (role !== "admin") notFound();
  }

  if (!quote.current_revision_id) {
    return (
      <section className="flex flex-col gap-6">
        <PageHeader title="Quote snapshot" />
        <Alert variant="destructive">
          <ClockAlert aria-hidden />
          <AlertDescription>
            This quote is missing a revision — ask the supplier to re-send.
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const { data: revisionRaw } = await admin
    .from("quote_revisions")
    .select("id, version, snapshot_jsonb, created_at")
    .eq("id", quote.current_revision_id)
    .maybeSingle();

  const revision = revisionRaw as {
    id: string;
    version: number;
    snapshot_jsonb: unknown;
    created_at: string;
  } | null;
  if (!revision) notFound();

  const snap = revision.snapshot_jsonb as QuoteSnapshot;

  return (
    <section className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href={`/organizer/rfqs/${id}/quotes`}>
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          Back to compare
        </Link>
      </Button>

      <PageHeader
        title={quote.suppliers?.business_name ?? "Quote snapshot"}
        description={`${
          quote.suppliers?.base_city ? `${quote.suppliers.base_city} · ` : ""
        }Revision v${revision.version} · Submitted ${fmt(quote.sent_at)}`}
        actions={
          <StatusPill
            status={toPillStatus(quote.status)}
            label={quote.status.replace(/_/g, " ")}
          />
        }
      />

      {snap.expires_at ? (
        <Alert>
          <ClockAlert aria-hidden />
          <AlertDescription>
            Valid until <strong>{fmt(snap.expires_at)}</strong>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg">Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {snap.line_items.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              —
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Item</TableHead>
                  <TableHead className="px-4">Qty</TableHead>
                  <TableHead className="px-4">Unit price</TableHead>
                  <TableHead className="px-4 text-end">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snap.line_items.map((item, idx) => (
                  <TableRow key={`${item.kind}-${idx}`}>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.kind.replace(/_/g, " ")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap">
                      {item.qty}{" "}
                      <span className="text-xs text-muted-foreground">
                        {unitLabel(item.unit)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap tabular-nums">
                      {formatHalalas(item.unit_price_halalas)}
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-end font-medium tabular-nums">
                      {formatHalalas(item.total_halalas)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg">Totals</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <dl className="flex flex-col gap-2">
            <Row
              label="Subtotal"
              value={formatHalalas(snap.subtotal_halalas)}
            />
            <Row
              label="Travel"
              value={formatHalalas(snap.travel_fee_halalas)}
            />
            <Row
              label="Setup"
              value={formatHalalas(snap.setup_fee_halalas)}
            />
            <Row
              label="Teardown"
              value={formatHalalas(snap.teardown_fee_halalas)}
            />
            <Row
              label={`VAT (${snap.vat_rate_pct}%)`}
              value={formatHalalas(snap.vat_amount_halalas)}
            />
            <div className="mt-1 flex items-baseline justify-between gap-4 border-t pt-3">
              <dt className="text-base font-semibold text-brand-navy-900">
                Total
              </dt>
              <dd className="text-lg font-semibold text-brand-navy-900 tabular-nums">
                {formatHalalas(snap.total_halalas)}
              </dd>
            </div>
            <Row label="Deposit" value={`${snap.deposit_pct}%`} />
            <Row
              label="Payment schedule"
              value={snap.payment_schedule || "—"}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg">Cancellation terms</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="whitespace-pre-line text-sm">
            {snap.cancellation_terms || "—"}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg">Inclusions</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {snap.inclusions.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="list-disc space-y-1 ps-5 text-sm">
                {snap.inclusions.map((inc, idx) => (
                  <li key={`inc-${idx}`}>{inc}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg">Exclusions</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {snap.exclusions.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="list-disc space-y-1 ps-5 text-sm">
                {snap.exclusions.map((exc, idx) => (
                  <li key={`exc-${idx}`}>{exc}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {snap.notes ? (
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="whitespace-pre-line text-sm">{snap.notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm tabular-nums">{value}</dd>
    </div>
  );
}
