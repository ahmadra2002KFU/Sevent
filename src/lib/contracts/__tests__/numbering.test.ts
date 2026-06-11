import { describe, it, expect } from "vitest";
import { contractNumber, projectNumber } from "../numbering";

const BOOKING = "1a2b3c4d-5e6f-7081-9abc-def012345678";
const EVENT = "9f8e7d6c-0000-0000-0000-000000000000";

describe("contractNumber", () => {
  it("formats as SEV-PO-{year}-{8 hex upper}", () => {
    expect(contractNumber(BOOKING, "2026-05-21T10:00:00Z")).toBe(
      "SEV-PO-2026-1A2B3C4D",
    );
  });

  it("is deterministic — same inputs yield the same number", () => {
    const a = contractNumber(BOOKING, "2026-05-21T10:00:00Z");
    const b = contractNumber(BOOKING, "2026-05-21T10:00:00Z");
    expect(a).toBe(b);
  });

  it("derives the year from the supplied date", () => {
    expect(contractNumber(BOOKING, "2027-01-01T00:00:00Z")).toContain(
      "SEV-PO-2027-",
    );
  });

  it("falls back to 0000 when the date is null/unparseable", () => {
    expect(contractNumber(BOOKING, null)).toBe("SEV-PO-0000-1A2B3C4D");
    expect(contractNumber(BOOKING, "not-a-date")).toBe(
      "SEV-PO-0000-1A2B3C4D",
    );
  });
});

describe("projectNumber", () => {
  it("formats as SEV-PRJ-{8 hex upper}", () => {
    expect(projectNumber(EVENT)).toBe("SEV-PRJ-9F8E7D6C");
  });

  it("is deterministic", () => {
    expect(projectNumber(EVENT)).toBe(projectNumber(EVENT));
  });
});
