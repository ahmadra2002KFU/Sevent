/**
 * Loader for the organizer quote-comparison surface.
 *
 * Returns the full per-supplier dataset the side-by-side grid renders, plus
 * the print and CSV-export routes. All three consumers share this single
 * function so they can never disagree on what's displayed.
 *
 * The loader uses the service-role admin client for two reasons:
 *   1. RLS on `quotes` / `rfqs` would force a per-table policy chain; the
 *      page already gates the caller via `requireAccess` + organizer check.
 *   2. Signed-URL minting needs storage privileges the organizer does not
 *      directly hold on the `supplier-docs` bucket.
 */

import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth/access";
import {
  STORAGE_BUCKETS,
  createSignedDownloadUrl,
} from "@/lib/supabase/storage";
import {
  parseQuoteSnapshot,
  pickActiveRfpRequest,
  rfpStatus,
  type QuoteProposalRequest,
  type QuoteSnapshot,
  type RfpStatus,
} from "@/lib/domain/quote";

export type InviteSource = "auto_match" | "organizer_picked" | "self_applied";

export type RfpCellData = {
  status: RfpStatus;
  request_id: string | null;
  message: string | null;
  requested_at: string | null;
  fulfilled_url: string | null; // signed URL when status === "fulfilled"
  responded_at: string | null;
};

export type QuoteColumn = {
  quote_id: string;
  supplier_id: string;
  supplier: {
    business_name: string;
    base_city: string | null;
    slug: string | null;
    logo_url: string | null; // signed URL or null
    verification_status: "pending" | "approved" | "rejected" | null;
  };
  invite_source: InviteSource | null;
  has_conflict: boolean;
  submitted_at: string | null;
  snapshot: QuoteSnapshot;
  tech_proposal_url: string | null; // signed URL or null
  rfp: RfpCellData;
};

export type QuotesComparisonData = {
  rfq_id: string;
  rfq_status: string;
  event: {
    id: string;
    starts_at: string;
    ends_at: string;
    organizer_id: string;
    city: string;
  };
  columns: QuoteColumn[];
  /**
   * Quote IDs dropped from `columns` (missing revision or invalid snapshot).
   * Surfaced for diagnostics — the comparison UI may eventually show these,
   * but for now it just lets ops correlate logs with skipped suppliers.
   */
  skipped: string[];
};

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

type SupplierJoin = {
  id: string;
  business_name: string;
  base_city: string | null;
  slug: string | null;
  logo_path: string | null;
  verification_status: "pending" | "approved" | "rejected" | null;
};

type RevisionJoin =
  | {
      snapshot_jsonb: unknown;
      technical_proposal_path: string | null;
    }
  | {
      snapshot_jsonb: unknown;
      technical_proposal_path: string | null;
    }[]
  | null;

type QuoteWithJoins = {
  id: string;
  supplier_id: string;
  status: string;
  sent_at: string | null;
  current_revision_id: string | null;
  suppliers: SupplierJoin | null;
  quote_revisions: RevisionJoin;
};

function flatten<T>(ref: T | T[] | null | undefined): T | null {
  if (!ref) return null;
  return Array.isArray(ref) ? ref[0] ?? null : ref;
}

function extractRevision(ref: RevisionJoin): {
  snapshot: QuoteSnapshot;
  technical_proposal_path: string | null;
} | null {
  const row = flatten(ref);
  if (!row) return null;
  const snapshot = parseQuoteSnapshot(row.snapshot_jsonb);
  if (!snapshot) return null;
  return {
    snapshot,
    technical_proposal_path: row.technical_proposal_path ?? null,
  };
}

/**
 * Load the full comparison dataset for one RFQ. Throws via `notFound()` if
 * the RFQ doesn't exist or the caller is neither the organizer nor an admin.
 */
export async function loadQuotesComparison(
  rfqId: string,
): Promise<QuotesComparisonData> {
  const { user, admin } = await requireAccess("organizer.rfqs");

  const { data: rfqRaw } = await admin
    .from("rfqs")
    .select(
      `id, status,
       events ( id, starts_at, ends_at, organizer_id, city )`,
    )
    .eq("id", rfqId)
    .maybeSingle();

  const rfq = rfqRaw as unknown as RfqRow | null;
  if (!rfq || !rfq.events) notFound();

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

  const { data: quotesRaw } = await admin
    .from("quotes")
    .select(
      `id, supplier_id, status, sent_at, current_revision_id,
       suppliers ( id, business_name, base_city, slug, logo_path, verification_status ),
       quote_revisions!quotes_current_revision_fk ( snapshot_jsonb, technical_proposal_path )`,
    )
    .eq("rfq_id", rfqId)
    .eq("status", "sent")
    .order("sent_at", { ascending: true });

  const quotes = (quotesRaw ?? []) as unknown as QuoteWithJoins[];

  const supplierIds = Array.from(new Set(quotes.map((q) => q.supplier_id)));
  const quoteIds = quotes.map((q) => q.id);

  // ---- conflict preflight (mirrors page.tsx behavior) ----------------------
  const conflictMap = new Map<string, boolean>();
  if (supplierIds.length > 0) {
    const nowIso = new Date().toISOString();
    const { data: blocks } = await admin
      .from("availability_blocks")
      .select(
        "id, supplier_id, starts_at, ends_at, reason, expires_at, released_at",
      )
      .in("supplier_id", supplierIds)
      .is("released_at", null)
      .lt("starts_at", event.ends_at)
      .gt("ends_at", event.starts_at);

    const rows = (blocks ?? []) as Array<{
      supplier_id: string;
      reason: string;
      expires_at: string | null;
    }>;
    for (const b of rows) {
      const active =
        b.reason !== "soft_hold" ||
        (b.expires_at !== null && b.expires_at > nowIso);
      if (active) conflictMap.set(b.supplier_id, true);
    }
  }

  // ---- invite source map ---------------------------------------------------
  const sourceBySupplier = new Map<string, InviteSource>();
  if (supplierIds.length > 0) {
    // The schema lets a supplier carry multiple invites for one RFQ across
    // history; ordering by sent_at desc + a has-check pins us to the most
    // recent invite deterministically rather than relying on PG return order.
    const { data: inviteSourceRows } = await admin
      .from("rfq_invites")
      .select("supplier_id, source, sent_at")
      .eq("rfq_id", rfqId)
      .in("supplier_id", supplierIds)
      .order("sent_at", { ascending: false });
    for (const row of (inviteSourceRows ?? []) as Array<{
      supplier_id: string;
      source: InviteSource;
      sent_at: string | null;
    }>) {
      if (!sourceBySupplier.has(row.supplier_id)) {
        sourceBySupplier.set(row.supplier_id, row.source);
      }
    }
  }

  // ---- proposal requests per quote (latest one wins for cell display) ------
  const requestsByQuote = new Map<string, QuoteProposalRequest[]>();
  if (quoteIds.length > 0) {
    const { data: reqRows } = await admin
      .from("quote_proposal_requests")
      .select(
        "id, quote_id, requested_by, requested_at, message, response_file_path, responded_at, status, cancelled_at",
      )
      .in("quote_id", quoteIds)
      .order("requested_at", { ascending: false });
    for (const row of (reqRows ?? []) as QuoteProposalRequest[]) {
      const arr = requestsByQuote.get(row.quote_id) ?? [];
      arr.push(row);
      requestsByQuote.set(row.quote_id, arr);
    }
  }

  // ---- assemble columns ----------------------------------------------------
  // Each quote needs up to 3 signed-URL round trips (tech proposal, logo,
  // fulfilled RFP response). Doing those sequentially across N suppliers
  // serialised page render at ~3·N round-trips. We fan out across quotes and
  // across the three URLs per quote — at the comparison grid's ~10-supplier
  // ceiling that caps concurrent storage calls at ~30, well under the
  // service-role rate limit.
  const skipped: string[] = [];
  const assembled = await Promise.all(
    quotes.map(async (q): Promise<QuoteColumn | null> => {
      const rev = extractRevision(q.quote_revisions);
      if (!rev) {
        // Either no current revision, or `snapshot_jsonb` failed Zod
        // validation. Either way the grid can't render a column for this
        // supplier — log the quote_id so ops can correlate with skipped.
        console.warn("[loader] dropped quote with invalid snapshot", {
          quote_id: q.id,
        });
        skipped.push(q.id);
        return null;
      }

      const techPromise = rev.technical_proposal_path
        ? createSignedDownloadUrl(
            admin,
            STORAGE_BUCKETS.docs,
            rev.technical_proposal_path,
          ).catch(() => null)
        : Promise.resolve<string | null>(null);

      const logoPath = q.suppliers?.logo_path ?? null;
      const logoPromise = logoPath
        ? createSignedDownloadUrl(
            admin,
            STORAGE_BUCKETS.logos,
            logoPath,
          ).catch(() => null)
        : Promise.resolve<string | null>(null);

      const reqs = requestsByQuote.get(q.id) ?? [];
      const active = pickActiveRfpRequest(reqs);
      const fulfilledPromise =
        active && active.status === "fulfilled" && active.response_file_path
          ? createSignedDownloadUrl(
              admin,
              STORAGE_BUCKETS.docs,
              active.response_file_path,
            ).catch(() => null)
          : Promise.resolve<string | null>(null);

      const [techUrl, logoUrl, fulfilledUrl] = await Promise.all([
        techPromise,
        logoPromise,
        fulfilledPromise,
      ]);

      return {
        quote_id: q.id,
        supplier_id: q.supplier_id,
        supplier: {
          business_name: q.suppliers?.business_name ?? "—",
          base_city: q.suppliers?.base_city ?? null,
          slug: q.suppliers?.slug ?? null,
          logo_url: logoUrl,
          verification_status: q.suppliers?.verification_status ?? null,
        },
        invite_source: sourceBySupplier.get(q.supplier_id) ?? null,
        has_conflict: conflictMap.get(q.supplier_id) === true,
        submitted_at: q.sent_at,
        snapshot: rev.snapshot,
        tech_proposal_url: techUrl,
        rfp: {
          status: rfpStatus(active),
          request_id: active?.id ?? null,
          message: active?.message ?? null,
          requested_at: active?.requested_at ?? null,
          fulfilled_url: fulfilledUrl,
          responded_at: active?.responded_at ?? null,
        },
      };
    }),
  );

  const columns = assembled.filter((c): c is QuoteColumn => c !== null);

  return {
    rfq_id: rfq.id,
    rfq_status: rfq.status,
    event,
    columns,
    skipped,
  };
}
