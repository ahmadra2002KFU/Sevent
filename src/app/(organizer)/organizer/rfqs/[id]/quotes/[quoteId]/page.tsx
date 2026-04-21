/**
 * Sprint 4 Lane 3 — organizer quote detail (full snapshot view).
 *
 * Renders every field inside `quote_revisions.snapshot_jsonb` for the current
 * revision of one quote. This is a read-only page; the accept CTA lives on
 * the comparison page so the organizer can compare side-by-side first.
 *
 * Ownership check mirrors the comparison page: service-role read (the new
 * @supabase/ssr key format does not forward the user JWT reliably), then
 * enforce `events.organizer_id === user.id` in code.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
    events: { id: string; organizer_id: string; starts_at: string; ends_at: string } | null;
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

export default async function OrganizerQuoteDetailPage({ params }: PageProps) {
  const { id, quoteId } = await params;

  const auth = await authenticateAndGetAdminClient();
  if (!auth) redirect(`/sign-in?next=/organizer/rfqs/${id}/quotes/${quoteId}`);
  const { user, admin } = auth;

  // 1. Load quote + supplier + rfq.event for ownership + header context.
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

  // 2. Load the current revision's snapshot.
  if (!quote.current_revision_id) {
    return (
      <section className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold">Quote snapshot</h1>
        </header>
        <p className="rounded-md border border-[#F2C2C2] bg-[#FCE9E9] px-3 py-2 text-sm text-[#9F1A1A]">
          This quote is missing a revision — ask the supplier to re-send.
        </p>
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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Quote snapshot
          </p>
          <h1 className="text-2xl font-semibold">
            {quote.suppliers?.business_name ?? "Supplier"}
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {quote.suppliers?.base_city ? `${quote.suppliers.base_city} · ` : ""}
            Revision v{revision.version} · Submitted {fmt(quote.sent_at)}
          </p>
        </div>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1 text-xs font-medium capitalize">
          {quote.status}
        </span>
      </header>

      <Link
        href={`/organizer/rfqs/${id}/quotes`}
        className="w-fit text-sm text-[var(--color-sevent-green,#0a7)] hover:underline"
      >
        ← Back to compare
      </Link>

      {snap.expires_at ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm">
          Valid until {fmt(snap.expires_at)}
        </p>
      ) : null}

      {/* Line items */}
      <section className="rounded-lg border border-[var(--color-border)] bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">Line items</h2>
        {snap.line_items.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">—</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-muted)] text-start text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Unit price</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {snap.line_items.map((item, idx) => (
                  <tr
                    key={`${item.kind}-${idx}`}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          {item.kind.replace(/_/g, " ")}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {item.qty} <span className="text-xs text-[var(--color-muted-foreground)]">{unitLabel(item.unit)}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatHalalas(item.unit_price_halalas)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">
                      {formatHalalas(item.total_halalas)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Totals */}
      <section className="rounded-lg border border-[var(--color-border)] bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">Totals</h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Row label="Subtotal" value={formatHalalas(snap.subtotal_halalas)} />
          <Row label="Travel" value={formatHalalas(snap.travel_fee_halalas)} />
          <Row label="Setup" value={formatHalalas(snap.setup_fee_halalas)} />
          <Row label="Teardown" value={formatHalalas(snap.teardown_fee_halalas)} />
          <Row
            label={`VAT (${snap.vat_rate_pct}%)`}
            value={formatHalalas(snap.vat_amount_halalas)}
          />
          <Row
            label="Total"
            value={formatHalalas(snap.total_halalas)}
            emphasize
          />
          <Row label="Deposit" value={`${snap.deposit_pct}%`} />
          <Row label="Payment schedule" value={snap.payment_schedule || "—"} />
        </dl>
      </section>

      {/* Terms */}
      <section className="rounded-lg border border-[var(--color-border)] bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">Cancellation terms</h2>
        <p className="whitespace-pre-line text-sm">
          {snap.cancellation_terms || "—"}
        </p>
      </section>

      {/* Inclusions + exclusions */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-[var(--color-border)] bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">Inclusions</h2>
          {snap.inclusions.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">—</p>
          ) : (
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {snap.inclusions.map((inc, idx) => (
                <li key={`inc-${idx}`}>{inc}</li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-lg border border-[var(--color-border)] bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">Exclusions</h2>
          {snap.exclusions.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">—</p>
          ) : (
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {snap.exclusions.map((exc, idx) => (
                <li key={`exc-${idx}`}>{exc}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {snap.notes ? (
        <section className="rounded-lg border border-[var(--color-border)] bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">Notes</h2>
          <p className="whitespace-pre-line text-sm">{snap.notes}</p>
        </section>
      ) : null}
    </section>
  );
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--color-border)] py-1 last:border-b-0 sm:border-b">
      <dt className="text-sm text-[var(--color-muted-foreground)]">{label}</dt>
      <dd
        className={
          emphasize
            ? "text-base font-semibold"
            : "text-sm"
        }
      >
        {value}
      </dd>
    </div>
  );
}
