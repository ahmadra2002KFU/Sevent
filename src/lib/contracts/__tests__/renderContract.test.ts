import { describe, it, expect } from "vitest";
import { renderContract } from "../renderContract";
import type { ContractDocumentInput } from "../ContractDocument";
import type { QuoteSnapshot } from "@/lib/domain/quote";
import { QUOTE_ENGINE_VERSION } from "@/lib/domain/quote";

function snapshot(): QuoteSnapshot {
  return {
    engine_version: QUOTE_ENGINE_VERSION,
    currency: "SAR",
    source: "free_form",
    line_items: [
      {
        kind: "free_form",
        label: "Classic Photobooth — 4 hours, operator + printing",
        qty: 4,
        unit: "hour",
        unit_price_halalas: 100_000,
        total_halalas: 400_000,
      },
    ],
    subtotal_halalas: 400_000,
    travel_fee_halalas: 0,
    setup_fee_halalas: 0,
    teardown_fee_halalas: 0,
    vat_rate_pct: 15,
    vat_amount_halalas: 60_000,
    prices_include_vat: false,
    total_halalas: 460_000,
    deposit_pct: 100,
    payment_schedule: "دفعة مقدمة 100% عند إصدار أمر الشراء.",
    cancellation_terms: "Standard cancellation terms apply.",
    inclusions: ["Operator", "Printing", "Frames"],
    exclusions: [],
    notes: null,
    expires_at: null,
    inputs_digest: "test-digest",
  };
}

function companyInput(): ContractDocumentInput {
  return {
    booking: { id: "1a2b3c4d-5e6f-7081-9abc-def012345678", confirmed_at: "2026-05-21T10:00:00Z" },
    contractNumber: "SEV-PO-2026-1A2B3C4D",
    projectNumber: "SEV-PRJ-9F8E7D6C",
    firstParty: {
      kind: "company",
      name: "Al-Gamal Trading Company",
      name_ar: "شركة الجمل التجارية",
      cr_number: "1010123456",
      vat_number: "300000000000003",
      address: { line1: "King Fahd Rd", city: "Riyadh", region: "Riyadh", postal_code: "12345" },
      contactName: "Anas",
      email: "client@example.com",
      phone: "+966500000000",
    },
    secondParty: {
      business_name: "Awad Al-Wahah Co.",
      slug: "awad-al-wahah",
      representative_name: "Naif",
      cr_number: "2020999888",
      vat_number: "310038316500003",
      address: { line1: "Olaya St", city: "Riyadh", region: "Riyadh", postal_code: "11564" },
    },
    event: {
      event_type: "private_occasions",
      city: "dammam",
      starts_at: "2026-05-21T18:00:00Z",
      ends_at: "2026-05-21T22:00:00Z",
      venue_address: "Dammam City",
      guest_count: 200,
    },
    snapshot: snapshot(),
    content_hash: "a".repeat(64),
  };
}

async function expectPdf(input: ContractDocumentInput) {
  // English and Arabic are rendered as SEPARATE files — assert both.
  for (const locale of ["en", "ar"] as const) {
    const bytes = await renderContract(input, locale);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    // PDF magic number.
    expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe("%PDF-");
  }
}

describe("renderContract", () => {
  it("renders separate EN + AR files for a company-owned booking (Arabic party name + free text)", async () => {
    await expectPdf(companyInput());
  });

  it("renders an individual organizer booking", async () => {
    const input = companyInput();
    input.firstParty = {
      kind: "individual",
      name: "Individual Organizer",
      name_ar: null,
      cr_number: null,
      vat_number: null,
      address: null,
      contactName: "Individual Organizer",
      email: "ind@example.com",
      phone: null,
    };
    await expectPdf(input);
  });

  it("degrades gracefully when supplier VAT/address/representative are missing", async () => {
    const input = companyInput();
    input.secondParty = {
      business_name: "Bare Supplier",
      slug: "bare-supplier",
      representative_name: null,
      cr_number: null,
      vat_number: null,
      address: null,
    };
    await expectPdf(input);
  });
});
