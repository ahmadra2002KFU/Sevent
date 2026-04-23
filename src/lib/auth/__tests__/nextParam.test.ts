import { describe, expect, it } from "vitest";
import { sanitizeNextParam } from "../nextParam";

const APP_URL = "https://app.example";

describe("sanitizeNextParam", () => {
  const supplierPrefixes = ["/supplier/dashboard", "/supplier/onboarding"];
  const allPrefixes = ["/supplier", "/organizer", "/admin"];

  describe("rejects unsafe input", () => {
    it("null / undefined / empty / non-string", () => {
      expect(sanitizeNextParam(null, allPrefixes, APP_URL)).toBeNull();
      expect(sanitizeNextParam(undefined, allPrefixes, APP_URL)).toBeNull();
      expect(sanitizeNextParam("", allPrefixes, APP_URL)).toBeNull();
      expect(sanitizeNextParam("   ", allPrefixes, APP_URL)).toBeNull();
      // @ts-expect-error — exercise the non-string branch
      expect(sanitizeNextParam(42, allPrefixes, APP_URL)).toBeNull();
    });

    it("protocol-relative //evil.com", () => {
      expect(sanitizeNextParam("//evil.com", allPrefixes, APP_URL)).toBeNull();
      expect(
        sanitizeNextParam("//evil.com/supplier", allPrefixes, APP_URL),
      ).toBeNull();
    });

    it("backslash-prefixed \\\\evil.com", () => {
      expect(
        sanitizeNextParam("\\\\evil.com", allPrefixes, APP_URL),
      ).toBeNull();
      expect(sanitizeNextParam("\\evil", allPrefixes, APP_URL)).toBeNull();
    });

    it("absolute URLs with schemes", () => {
      expect(
        sanitizeNextParam("https://evil.com/supplier", allPrefixes, APP_URL),
      ).toBeNull();
      expect(
        sanitizeNextParam("http://evil.com/supplier", allPrefixes, APP_URL),
      ).toBeNull();
    });

    it("javascript: / data: / file:", () => {
      expect(
        sanitizeNextParam("javascript:alert(1)", allPrefixes, APP_URL),
      ).toBeNull();
      expect(
        sanitizeNextParam("data:text/html,<script>alert(1)</script>", allPrefixes, APP_URL),
      ).toBeNull();
      expect(
        sanitizeNextParam("file:///etc/passwd", allPrefixes, APP_URL),
      ).toBeNull();
    });

    it("control characters (CRLF injection)", () => {
      expect(
        sanitizeNextParam("/supplier\r\nX-Attack: 1", allPrefixes, APP_URL),
      ).toBeNull();
      expect(
        sanitizeNextParam("/supplier\x00catalog", allPrefixes, APP_URL),
      ).toBeNull();
    });

    it("relative paths (no leading slash)", () => {
      expect(
        sanitizeNextParam("supplier/catalog", allPrefixes, APP_URL),
      ).toBeNull();
      expect(sanitizeNextParam("./catalog", allPrefixes, APP_URL)).toBeNull();
    });

    it("paths outside allowedPrefixes", () => {
      // Same-origin but not in the supplier's allow list
      expect(
        sanitizeNextParam("/admin/dashboard", supplierPrefixes, APP_URL),
      ).toBeNull();
      expect(
        sanitizeNextParam("/organizer/events", supplierPrefixes, APP_URL),
      ).toBeNull();
    });

    it("empty allowedPrefixes rejects everything except /", () => {
      expect(sanitizeNextParam("/supplier/catalog", [], APP_URL)).toBeNull();
      expect(sanitizeNextParam("/", [], APP_URL)).toBe("/");
    });
  });

  describe("accepts safe input", () => {
    it("root path", () => {
      expect(sanitizeNextParam("/", supplierPrefixes, APP_URL)).toBe("/");
    });

    it("exact prefix match", () => {
      expect(
        sanitizeNextParam("/supplier/dashboard", supplierPrefixes, APP_URL),
      ).toBe("/supplier/dashboard");
    });

    it("prefix sub-path match", () => {
      expect(
        sanitizeNextParam("/supplier/dashboard/settings", supplierPrefixes, APP_URL),
      ).toBe("/supplier/dashboard/settings");
      expect(
        sanitizeNextParam(
          "/supplier/onboarding/path",
          supplierPrefixes,
          APP_URL,
        ),
      ).toBe("/supplier/onboarding/path");
    });

    it("preserves query string and hash", () => {
      expect(
        sanitizeNextParam(
          "/supplier/dashboard?tab=rfqs&foo=bar",
          supplierPrefixes,
          APP_URL,
        ),
      ).toBe("/supplier/dashboard?tab=rfqs&foo=bar");
      expect(
        sanitizeNextParam(
          "/supplier/dashboard#section-1",
          supplierPrefixes,
          APP_URL,
        ),
      ).toBe("/supplier/dashboard#section-1");
    });

    it("rejects prefix-boundary tricks", () => {
      // /supplier/dashboard-evil is NOT a sub-path of /supplier/dashboard
      expect(
        sanitizeNextParam("/supplier/dashboard-evil", supplierPrefixes, APP_URL),
      ).toBeNull();
      expect(
        sanitizeNextParam("/supplierdashboard", supplierPrefixes, APP_URL),
      ).toBeNull();
    });
  });
});
