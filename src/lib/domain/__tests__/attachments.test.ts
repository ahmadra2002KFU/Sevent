import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_DOC_BYTES,
  ATTACHMENT_MAX_IMAGE_BYTES,
  kindForMime,
  maxBytesForKind,
} from "@/lib/domain/attachments";

describe("kindForMime", () => {
  it("classifies image MIME types as image", () => {
    expect(kindForMime("image/png")).toBe("image");
    expect(kindForMime("image/jpeg")).toBe("image");
    expect(kindForMime("image/webp")).toBe("image");
  });

  it("classifies PDF as document", () => {
    expect(kindForMime("application/pdf")).toBe("document");
  });

  it("rejects disallowed MIME types", () => {
    expect(kindForMime("image/gif")).toBeNull();
    expect(kindForMime("application/zip")).toBeNull();
    expect(kindForMime("text/html")).toBeNull();
    expect(kindForMime("")).toBeNull();
  });
});

describe("maxBytesForKind", () => {
  it("uses the image ceiling for images and the doc ceiling for documents", () => {
    expect(maxBytesForKind("image")).toBe(ATTACHMENT_MAX_IMAGE_BYTES);
    expect(maxBytesForKind("document")).toBe(ATTACHMENT_MAX_DOC_BYTES);
  });
});

describe("ATTACHMENT_ACCEPT", () => {
  it("includes the allowed MIME types for the file input", () => {
    expect(ATTACHMENT_ACCEPT).toContain("image/png");
    expect(ATTACHMENT_ACCEPT).toContain("image/jpeg");
    expect(ATTACHMENT_ACCEPT).toContain("image/webp");
    expect(ATTACHMENT_ACCEPT).toContain("application/pdf");
  });
});
