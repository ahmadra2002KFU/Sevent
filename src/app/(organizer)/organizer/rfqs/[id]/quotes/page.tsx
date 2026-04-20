/**
 * Sprint 4 Lane 3 — organizer quote-comparison page.
 *
 * Loads every `status = 'sent'` quote on an RFQ with its current revision's
 * snapshot (for `total_halalas` + `expires_at`), then runs a one-SELECT
 * conflict preflight per supplier over the event's `[starts_at, ends_at)`
 * window. Conflicts mirror the overlap trigger's logic: active blocks where
 * `released_at IS NULL` and (reason <> 'soft_hold' OR expires_at > now()).
 *
 * The badge is purely a UX hint — the DB trigger remains the source of truth.
 * If the organizer clicks Accept on a conflicting row, the RPC raises P0007
 * and the server action surfaces the mapped error in the row-level banner.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { authenticateAndGetAdminClient } from "@/lib/supabase/server";
import type { QuoteSnapshot } from "@/lib/domain/quote";
import { QuotesTable, type QuoteRowData } from "./QuotesTable";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

type RfqRow = {
  id: string;
  status: string;
  events: {
    id: string;
    starts_at: string;
    ends_at: string;
    organizer_id: string;
    city: string;
  } | null;
};

type RevisionRef = { snapshot_jsonb: unknown } | { snapshot_jsonb: unknown }[] | null;

type QuoteWithJoins = {
  id: string;
  supplier_id: string;
  status: string;
  sent_at: string | null;
  current_revision_id: string | null;
  suppliers: {
    id: string;
    business_name: string;
    base_city: string | null;
  } | null;
  quote_revisions: RevisionRef;
};

function flatten<T>(ref: T | T[] | null | undefined): T | null {
  if (!ref) return null;
  return Array.isArray(ref) ? ref[0] ?? null : ref;
}

function extractSnapshot(ref: RevisionRef): QuoteSnapshot | null {
  const row = flatten(ref);
  if (!row) return null;
  const snap = row.snapshot_jsonb;
  if (!snap || typeof snap !== "object") return null;
  return snap as QuoteSnapshot;
}

export default async function OrganizerQuotesComparisonPage({ params }: PageProps) {
  const { id } = await params;

  const auth = await authenticateAndGetAdminClient();
  if (!auth) redirect(`/sign-in?next=/organizer/rfqs/${id}/quotes`);
  const { user, admin } = auth;

  // 1. Load RFQ + the event window we'll use for conflict preflight. The join
  //    to events also enforces ownership in code (service-role bypasses RLS,
  //    so we can't rely on the policy here).
  const { data: rfqDataRaw } = await admin
    .from("rfqs")
    .select(
      `id, status,
       events ( id, starts_at, ends_at, organizer_id, city )`,
    )
    .eq("id", id)
    .maybeSingle();

  const rfq = rfqDataRaw as unknown as RfqRow | null;
  if (!rfq || !rfq.events) notFound();

  // Ownership: only the event's organizer (or an admin) may compare quotes.
  const ownsEvent = rfq.events.organizer_id === user.id;
  if (!ownsEvent) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role: string } | null)?.role;
    if (role !== "admin") notFound();
  }

  const event = rfq.events;

  // 2. Load every sent quote on this RFQ with its current revision snapshot.
  //    We specifically filter `status = 'sent'` — organizers should not see
  //    draft / rejected / accepted rows in the compare view.
  const { data: quotesRaw } = await admin
    .from("quotes")
    .select(
      `id, supplier_id, status, sent_at, current_revision_id,
       suppliers ( id, business_name, base_city ),
       quote_revisions!quotes_current_revision_fk ( snapshot_jsonb )`,
    )
    .eq("rfq_id", id)
    .eq("status", "sent")
    .order("sent_at", { ascending: true });

  const quotes = (quotesRaw ?? []) as unknown as QuoteWithJoins[];

  // 3. Conflict preflight — one SELECT per supplier against availability_blocks
  //    over the event window, scoped with the trigger's exact predicate so the
  //    badge matches what `accept_quote_tx` will actually enforce.
  const supplierIds = Array.from(new Set(quotes.map((q) => q.supplier_id)));
  const conflictMap = new Map<string, boolean>();

  if (supplierIds.length > 0) {
    // Single round-trip: pull any overlapping active block for any of the
    // suppliers in the compare set, then group in memory. Much cheaper than
    // N queries for typical RFQ sizes (≤ 10 invited suppliers).
    const nowIso = new Date().toISOString();
    const { data: blocks } = await admin
      .from("availability_blocks")
      .select("id, supplier_id, starts_at, ends_at, reason, expires_at, released_at")
      .in("supplier_id", supplierIds)
      .is("released_at", null)
      // Overlap: block.starts_at < event.ends_at AND block.ends_at > event.starts_at
      .lt("starts_at", event.ends_at)
      .gt("ends_at", event.starts_at);

    const rows =
      (blocks ?? []) as Array<{
        supplier_id: string;
        reason: string;
        expires_at: string | null;
      }>;

    for (const b of rows) {
      // Trigger predicate: reason <> 'soft_hold' OR expires_at > now()
      const active =
        b.reason !== "soft_hold" || (b.expires_at !== null && b.expires_at > nowIso);
      if (active) conflictMap.set(b.supplier_id, true);
    }
  }

  // 4. Project into the shape the client table expects. Quotes missing a
  //    snapshot (shouldn't happen for status=sent, but defensively) show 0
  //    total rather than crash — the accept flow itself will raise P0005.
  const rows: QuoteRowData[] = quotes.map((q) => {
    const snap = extractSnapshot(q.quote_revisions);
    return {
      quote_id: q.id,
      supplier_id: q.supplier_id,
      supplier_business_name: q.suppliers?.business_name ?? "—",
      supplier_base_city: q.suppliers?.base_city ?? null,
      total_halalas: snap?.total_halalas ?? 0,
      expires_at: snap?.expires_at ?? null,
      submitted_at: q.sent_at,
      has_conflict: conflictMap.get(q.supplier_id) === true,
    };
  });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Compare quotes
        </p>
        <h1 className="text-2xl font-semibold">Compare quotes</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Pick a quote to accept. Accepting creates a booking and holds the supplier&apos;s
          calendar for 48 hours while they confirm.
        </p>
      </header>

      <Link
        href={`/organizer/rfqs/${id}`}
        className="w-fit text-sm text-[var(--color-sevent-green,#0a7)] hover:underline"
      >
        ← Back to RFQ
      </Link>

      <QuotesTable rfqId={id} rows={rows} />
    </section>
  );
}
