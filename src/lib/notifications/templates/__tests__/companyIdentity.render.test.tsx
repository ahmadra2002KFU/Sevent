/**
 * Proves the company identity actually reaches the rendered email HTML.
 *
 * Review finding F2 had two halves: every call site passed `organizerCompanyName: null`,
 * AND four of the five templates declared the prop without ever rendering it.
 * Wiring the call sites alone would have been a no-op, so these tests assert on
 * the rendered output rather than on the props.
 */

import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import QuoteReceived from "../organizer/QuoteReceived";
import BookingCreated from "../organizer/BookingCreated";
import BookingConfirmed from "../organizer/BookingConfirmed";
import BookingCancelledBySupplier from "../organizer/BookingCancelledBySupplier";
import QuoteAccepted from "../supplier/QuoteAccepted";
import { formatOrganizerIdentity } from "../_shared/organizerIdentity";

const COMPANY = "Acme Events";

const renderHtml = (el: React.ReactElement) => render(el, { plainText: false });

describe("organizer-facing templates render the workspace context line", () => {
  const cases = [
    {
      name: "QuoteReceived",
      withCompany: (
        <QuoteReceived
          locale="en"
          organizerName="Sara"
          organizerCompanyName={COMPANY}
          supplierBusinessName="Bright Sound"
          rfqTitle={{ en: "Gala dinner", ar: "عشاء" }}
          quoteAmountSar={1200}
          quoteUrl="https://example.test/q"
        />
      ),
      withoutCompany: (
        <QuoteReceived
          locale="en"
          organizerName="Sara"
          organizerCompanyName={null}
          supplierBusinessName="Bright Sound"
          rfqTitle={{ en: "Gala dinner", ar: "عشاء" }}
          quoteAmountSar={1200}
          quoteUrl="https://example.test/q"
        />
      ),
    },
    {
      name: "BookingCreated",
      withCompany: (
        <BookingCreated
          locale="en"
          organizerName="Sara"
          organizerCompanyName={COMPANY}
          supplierBusinessName="Bright Sound"
          eventName="Gala dinner"
          supplierConfirmDeadlineIso="2026-08-01T10:00:00.000Z"
          bookingUrl="https://example.test/b"
        />
      ),
      withoutCompany: (
        <BookingCreated
          locale="en"
          organizerName="Sara"
          organizerCompanyName={null}
          supplierBusinessName="Bright Sound"
          eventName="Gala dinner"
          supplierConfirmDeadlineIso="2026-08-01T10:00:00.000Z"
          bookingUrl="https://example.test/b"
        />
      ),
    },
    {
      name: "BookingConfirmed",
      withCompany: (
        <BookingConfirmed
          locale="en"
          organizerName="Sara"
          organizerCompanyName={COMPANY}
          supplierBusinessName="Bright Sound"
          eventName="Gala dinner"
          eventStartsAtIso="2026-08-01T10:00:00.000Z"
          bookingUrl="https://example.test/b"
        />
      ),
      withoutCompany: (
        <BookingConfirmed
          locale="en"
          organizerName="Sara"
          organizerCompanyName={null}
          supplierBusinessName="Bright Sound"
          eventName="Gala dinner"
          eventStartsAtIso="2026-08-01T10:00:00.000Z"
          bookingUrl="https://example.test/b"
        />
      ),
    },
    {
      name: "BookingCancelledBySupplier",
      withCompany: (
        <BookingCancelledBySupplier
          locale="en"
          organizerName="Sara"
          organizerCompanyName={COMPANY}
          supplierBusinessName="Bright Sound"
          eventName="Gala dinner"
          rfqUrl="https://example.test/r"
        />
      ),
      withoutCompany: (
        <BookingCancelledBySupplier
          locale="en"
          organizerName="Sara"
          organizerCompanyName={null}
          supplierBusinessName="Bright Sound"
          eventName="Gala dinner"
          rfqUrl="https://example.test/r"
        />
      ),
    },
  ];

  for (const c of cases) {
    it(`${c.name} shows the company when one is supplied`, async () => {
      const html = await renderHtml(c.withCompany);
      expect(html).toContain(COMPANY);
      expect(html).toContain("Workspace");
    });

    it(`${c.name} stays unchanged for individual organizers`, async () => {
      const html = await renderHtml(c.withoutCompany);
      expect(html).not.toContain("Workspace");
      expect(html).not.toContain(COMPANY);
    });
  }

  it("renders the Arabic workspace label", async () => {
    const html = await renderHtml(
      <QuoteReceived
        locale="ar"
        organizerName="سارة"
        organizerCompanyName={COMPANY}
        supplierBusinessName="برايت ساوند"
        rfqTitle={{ en: "Gala dinner", ar: "عشاء" }}
        quoteAmountSar={1200}
        quoteUrl="https://example.test/q"
      />,
    );
    expect(html).toContain("مساحة العمل");
    expect(html).toContain(COMPANY);
  });
});

describe("supplier-facing QuoteAccepted leads with the company identity", () => {
  it("renders 'Company — via Actor' when a company is supplied", async () => {
    const html = await renderHtml(
      <QuoteAccepted
        locale="en"
        supplierBusinessName="Bright Sound"
        eventName="Gala dinner"
        organizerName="Sara"
        organizerCompanyName={COMPANY}
        bookingUrl="https://example.test/b"
        expiresAtIso="2026-08-01T10:00:00.000Z"
      />,
    );
    expect(html).toContain(COMPANY);
    expect(html).toContain("via Sara");
  });

  it("falls back to the actor alone for individual organizers", async () => {
    const html = await renderHtml(
      <QuoteAccepted
        locale="en"
        supplierBusinessName="Bright Sound"
        eventName="Gala dinner"
        organizerName="Sara"
        organizerCompanyName={null}
        bookingUrl="https://example.test/b"
        expiresAtIso="2026-08-01T10:00:00.000Z"
      />,
    );
    expect(html).toContain("Sara");
    expect(html).not.toContain(COMPANY);
    expect(html).not.toContain("via Sara");
  });
});

describe("formatOrganizerIdentity", () => {
  it("puts the company first with a localized 'via'", () => {
    expect(formatOrganizerIdentity("Sara", COMPANY, "en")).toBe(
      `${COMPANY} — via Sara`,
    );
    expect(formatOrganizerIdentity("سارة", COMPANY, "ar")).toBe(
      `${COMPANY} — بواسطة سارة`,
    );
  });

  it("returns the actor alone when there is no company", () => {
    expect(formatOrganizerIdentity("Sara", null, "en")).toBe("Sara");
    expect(formatOrganizerIdentity("Sara", "   ", "en")).toBe("Sara");
  });

  it("falls back to a generic actor label when the name is missing", () => {
    expect(formatOrganizerIdentity(null, null, "en")).toBe("the organizer");
    expect(formatOrganizerIdentity(null, null, "ar")).toBe("المنظم");
  });
});
