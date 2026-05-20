import { describe, expect, it } from "vitest";
import { rfqAttachmentPath } from "@/lib/supabase/storage";

const EVENT_ID = "11111111-1111-1111-1111-111111111111";
const RFQ_ID = "22222222-2222-2222-2222-222222222222";

describe("rfqAttachmentPath", () => {
  it("prefixes the path with {event_id}/{rfq_id}/", () => {
    const path = rfqAttachmentPath(EVENT_ID, RFQ_ID, "brief.pdf");
    expect(path.startsWith(`${EVENT_ID}/${RFQ_ID}/`)).toBe(true);
  });

  it("preserves a safe filename and appends a unique segment", () => {
    const path = rfqAttachmentPath(EVENT_ID, RFQ_ID, "moodboard.png");
    expect(path.endsWith("-moodboard.png")).toBe(true);
    // {event}/{rfq}/{timestamp}-{uuid}-{name}
    expect(path.split("/")).toHaveLength(3);
  });

  it("sanitizes unsafe characters in the filename", () => {
    const path = rfqAttachmentPath(EVENT_ID, RFQ_ID, "my brief (final).pdf");
    const tail = path.split("/")[2];
    // spaces and parens collapse to '-'; the extension dot is preserved.
    expect(tail).not.toMatch(/[ ()]/);
    expect(tail.endsWith(".pdf")).toBe(true);
    expect(tail).toContain("final");
    expect(path.split("/")).toHaveLength(3);
  });

  it("produces a unique path on each call (uuid segment)", () => {
    const a = rfqAttachmentPath(EVENT_ID, RFQ_ID, "x.pdf");
    const b = rfqAttachmentPath(EVENT_ID, RFQ_ID, "x.pdf");
    expect(a).not.toBe(b);
  });

  it("rejects an invalid event id", () => {
    expect(() => rfqAttachmentPath("not-a-uuid", RFQ_ID, "x.pdf")).toThrow();
  });

  it("rejects an invalid rfq id", () => {
    expect(() => rfqAttachmentPath(EVENT_ID, "nope", "x.pdf")).toThrow();
  });
});
