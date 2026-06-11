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
import { contractNumber, projectNumber } from "../src/lib/contracts/numbering";
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
      `id, organizer_id, rfq_id, supplier_id, accepted_quote_revision_id, confirmed_at, created_at, company_id,
       profiles:organizer_id ( id, full_name, phone ),
       suppliers ( id, business_name, slug, cr_number, vat_number, representative_name, address_line1, address_city, address_region, address_postal_code ),
       organizer_companies:company_id ( id, name, name_ar, cr_number, vat_number, address_line1, address_city, address_region, address_postal_code ),
       rfqs ( id, events ( id, event_type, city, starts_at, ends_at, venue_address, guest_count ) ),
       quote_revisions:accepted_quote_revision_id ( id, snapshot_jsonb, content_hash )`,
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error(`booking ${bookingId} not found`);

  type AddressColumns = {
    address_line1: string | null;
    address_city: string | null;
    address_region: string | null;
    address_postal_code: string | null;
  };
  const ctx = row as unknown as {
    id: string;
    accepted_quote_revision_id: string;
    confirmed_at: string | null;
    created_at: string | null;
    company_id: string | null;
    profiles: { full_name: string | null; phone: string | null } | null;
    suppliers:
      | ({
          business_name: string;
          slug: string;
          cr_number: string | null;
          vat_number: string | null;
          representative_name: string | null;
        } & AddressColumns)
      | null;
    organizer_companies:
      | ({
          name: string;
          name_ar: string | null;
          cr_number: string | null;
          vat_number: string | null;
        } & AddressColumns)
      | null;
    rfqs: {
      events: {
        id: string;
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

  const company = ctx.organizer_companies;
  const firstParty =
    ctx.company_id && company
      ? {
          kind: "company" as const,
          name: company.name,
          name_ar: company.name_ar,
          cr_number: company.cr_number,
          vat_number: company.vat_number,
          address: {
            line1: company.address_line1,
            city: company.address_city,
            region: company.address_region,
            postal_code: company.address_postal_code,
          },
          contactName: ctx.profiles?.full_name ?? null,
          email: null,
          phone: ctx.profiles?.phone ?? null,
        }
      : {
          kind: "individual" as const,
          name: ctx.profiles?.full_name ?? null,
          name_ar: null,
          cr_number: null,
          vat_number: null,
          address: null,
          contactName: ctx.profiles?.full_name ?? null,
          email: null,
          phone: ctx.profiles?.phone ?? null,
        };

  const contractInput = {
    booking: { id: ctx.id, confirmed_at: ctx.confirmed_at },
    contractNumber: contractNumber(ctx.id, ctx.confirmed_at ?? ctx.created_at),
    projectNumber: projectNumber(event.id),
    firstParty,
    secondParty: {
      business_name: supplier.business_name,
      slug: supplier.slug,
      representative_name: supplier.representative_name,
      cr_number: supplier.cr_number,
      vat_number: supplier.vat_number,
      address: {
        line1: supplier.address_line1,
        city: supplier.address_city,
        region: supplier.address_region,
        postal_code: supplier.address_postal_code,
      },
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
  };
  for (const locale of ["en", "ar"] as const) {
    const bytes = await renderContract(contractInput, locale);
    await uploadContractAndPersist({
      admin,
      bookingId: ctx.id,
      acceptedQuoteRevisionId: ctx.accepted_quote_revision_id,
      bytes,
      locale,
    });
    console.log(
      `OK — rendered ${locale} contract (${bytes.byteLength} bytes) for booking ${ctx.id}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
