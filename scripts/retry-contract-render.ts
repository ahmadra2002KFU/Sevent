/**
 * Manual retry for the contract render — for cases where the confirm-
 * booking action's post-RPC query failed transiently (e.g. Kong restart
 * during a test) and left contract_pdf_path NULL. Idempotent: re-renders
 * deterministically and overwrites if needed.
 *
 * Run: pnpm exec tsx scripts/retry-contract-render.ts <booking_id>
 */

import { createClient } from "@supabase/supabase-js";
import { renderContract } from "../src/lib/contracts/renderContract";
import { uploadContractAndPersist } from "../src/lib/contracts/uploadAndPersist";
import { parseQuoteSnapshot } from "../src/lib/domain/quote";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error("SUPABASE_SERVICE_ROLE_KEY env var is required");
  process.exit(1);
}
const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const bookingId = process.argv[2];
if (!bookingId) {
  console.error("usage: tsx scripts/retry-contract-render.ts <booking_id>");
  process.exit(1);
}

async function main() {
  const { data: row, error } = await admin
    .from("bookings")
    .select(
      `id, organizer_id, rfq_id, supplier_id, accepted_quote_revision_id, confirmed_at,
       profiles:organizer_id ( id, full_name, phone ),
       suppliers ( id, business_name, slug ),
       rfqs ( id, events ( id, event_type, city, starts_at, ends_at, venue_address, guest_count ) ),
       quote_revisions:accepted_quote_revision_id ( id, snapshot_jsonb, content_hash )`,
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error(`booking ${bookingId} not found`);

  const ctx = row as unknown as {
    id: string;
    accepted_quote_revision_id: string;
    confirmed_at: string | null;
    profiles: { full_name: string | null; phone: string | null } | null;
    suppliers: {
      business_name: string;
      slug: string;
    } | null;
    rfqs: {
      events: {
        event_type: string;
        city: string;
        starts_at: string;
        ends_at: string;
        venue_address: string | null;
        guest_count: number | null;
      } | null;
    } | null;
    quote_revisions: {
      snapshot_jsonb: unknown;
      content_hash: string;
    } | null;
  };

  const snapshot = parseQuoteSnapshot(ctx.quote_revisions?.snapshot_jsonb);
  const event = ctx.rfqs?.events;
  const supplier = ctx.suppliers;
  if (!snapshot || !event || !supplier || !ctx.quote_revisions?.content_hash) {
    throw new Error("missing render inputs");
  }

  const bytes = await renderContract({
    booking: { id: ctx.id, confirmed_at: ctx.confirmed_at },
    organizer: {
      full_name: ctx.profiles?.full_name ?? null,
      email: null,
      phone: ctx.profiles?.phone ?? null,
    },
    supplier: {
      business_name: supplier.business_name,
      slug: supplier.slug,
      representative_name: null,
    },
    event: {
      event_type: event.event_type,
      city: event.city,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      venue_address: event.venue_address,
      guest_count: event.guest_count,
    },
    snapshot,
    content_hash: ctx.quote_revisions.content_hash,
  });
  await uploadContractAndPersist({
    admin,
    bookingId: ctx.id,
    acceptedQuoteRevisionId: ctx.accepted_quote_revision_id,
    bytes,
  });
  console.log(
    `OK — rendered ${bytes.byteLength} bytes for booking ${ctx.id}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
