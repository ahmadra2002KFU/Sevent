import { describe, expect, it } from "vitest";
import {
  STATE_CONFIG,
  isRouteAllowed,
  type AccessState,
} from "../featureMatrix";

describe("STATE_CONFIG", () => {
  const ALL_STATES: AccessState[] = [
    "unauthenticated",
    "forbidden",
    "organizer.active",
    "agency.active",
    "admin.active",
    "supplier.no_row",
    "supplier.in_onboarding",
    "supplier.pending_review",
    "supplier.approved",
    "supplier.rejected",
    "supplier.suspended",
  ];

  it("covers every state", () => {
    for (const state of ALL_STATES) {
      expect(STATE_CONFIG[state]).toBeDefined();
    }
  });

  describe("supplier features by state", () => {
    it("no_row: only onboarding.path", () => {
      const cfg = STATE_CONFIG["supplier.no_row"];
      expect(cfg.features["supplier.onboarding.path"]).toBe(true);
      expect(cfg.features["supplier.dashboard"]).toBeFalsy();
      expect(cfg.features["supplier.catalog"]).toBeFalsy();
      expect(cfg.features["supplier.rfqs.respond"]).toBeFalsy();
      expect(cfg.bestDestination).toBe("/supplier/onboarding/path");
    });

    it("in_onboarding: dashboard + wizard, nothing else", () => {
      const cfg = STATE_CONFIG["supplier.in_onboarding"];
      expect(cfg.features["supplier.dashboard"]).toBe(true);
      expect(cfg.features["supplier.onboarding.wizard"]).toBe(true);
      expect(cfg.features["supplier.catalog"]).toBeFalsy();
      expect(cfg.features["supplier.calendar"]).toBeFalsy();
      expect(cfg.features["supplier.bookings"]).toBeFalsy();
      expect(cfg.features["supplier.rfqs.view"]).toBeFalsy();
      expect(cfg.features["supplier.rfqs.respond"]).toBeFalsy();
      expect(cfg.features["supplier.profile.customize"]).toBeFalsy();
    });

    it("pending_review: dashboard + wizard, nothing else", () => {
      const cfg = STATE_CONFIG["supplier.pending_review"];
      expect(cfg.features["supplier.dashboard"]).toBe(true);
      expect(cfg.features["supplier.onboarding.wizard"]).toBe(true);
      expect(cfg.features["supplier.catalog"]).toBeFalsy();
      expect(cfg.features["supplier.rfqs.respond"]).toBeFalsy();
    });

    it("approved: full surface", () => {
      const cfg = STATE_CONFIG["supplier.approved"];
      expect(cfg.features["supplier.dashboard"]).toBe(true);
      expect(cfg.features["supplier.catalog"]).toBe(true);
      expect(cfg.features["supplier.calendar"]).toBe(true);
      expect(cfg.features["supplier.bookings"]).toBe(true);
      expect(cfg.features["supplier.rfqs.view"]).toBe(true);
      expect(cfg.features["supplier.rfqs.respond"]).toBe(true);
      expect(cfg.features["supplier.profile.customize"]).toBe(true);
      expect(cfg.features["supplier.onboarding.wizard"]).toBe(true);
      // `onboarding.path` is explicitly locked so an approved user can't
      // overwrite legal_type.
      expect(cfg.features["supplier.onboarding.path"]).toBeFalsy();
    });

    it("rejected: dashboard + wizard only (read-only + resubmit CTA)", () => {
      const cfg = STATE_CONFIG["supplier.rejected"];
      expect(cfg.features["supplier.dashboard"]).toBe(true);
      expect(cfg.features["supplier.onboarding.wizard"]).toBe(true);
      expect(cfg.features["supplier.catalog"]).toBeFalsy();
      expect(cfg.features["supplier.calendar"]).toBeFalsy();
      expect(cfg.features["supplier.bookings"]).toBeFalsy();
      expect(cfg.features["supplier.rfqs.view"]).toBeFalsy();
      expect(cfg.features["supplier.rfqs.respond"]).toBeFalsy();
      expect(cfg.features["supplier.profile.customize"]).toBeFalsy();
    });

    it("suspended: dashboard only", () => {
      const cfg = STATE_CONFIG["supplier.suspended"];
      expect(cfg.features["supplier.dashboard"]).toBe(true);
      expect(cfg.features["supplier.onboarding.wizard"]).toBeFalsy();
      expect(cfg.features["supplier.catalog"]).toBeFalsy();
    });
  });

  describe("organizer + agency", () => {
    it("organizer has all organizer features", () => {
      const cfg = STATE_CONFIG["organizer.active"];
      expect(cfg.features["organizer.dashboard"]).toBe(true);
      expect(cfg.features["organizer.events"]).toBe(true);
      expect(cfg.features["organizer.rfqs"]).toBe(true);
      expect(cfg.features["organizer.bookings"]).toBe(true);
      expect(cfg.features["supplier.dashboard"]).toBeFalsy();
    });

    it("agency mirrors organizer", () => {
      const org = STATE_CONFIG["organizer.active"];
      const agy = STATE_CONFIG["agency.active"];
      expect(agy.features).toEqual(org.features);
      expect(agy.allowedRoutePrefixes).toEqual(org.allowedRoutePrefixes);
      expect(agy.bestDestination).toBe(org.bestDestination);
    });
  });

  describe("admin", () => {
    it("has admin.console + supplier + organizer features (godmode)", () => {
      const cfg = STATE_CONFIG["admin.active"];
      expect(cfg.features["admin.console"]).toBe(true);
      expect(cfg.features["supplier.dashboard"]).toBe(true);
      expect(cfg.features["organizer.dashboard"]).toBe(true);
      expect(cfg.allowedRoutePrefixes).toContain("/admin");
      expect(cfg.allowedRoutePrefixes).toContain("/supplier");
      expect(cfg.allowedRoutePrefixes).toContain("/organizer");
    });
  });

  describe("bestDestination", () => {
    it("every state maps to an in-app path", () => {
      for (const state of ALL_STATES) {
        const { bestDestination } = STATE_CONFIG[state];
        expect(bestDestination.startsWith("/")).toBe(true);
      }
    });
  });
});

describe("isRouteAllowed", () => {
  it("exact match", () => {
    expect(isRouteAllowed("/supplier/dashboard", ["/supplier/dashboard"])).toBe(
      true,
    );
  });

  it("sub-path match", () => {
    expect(
      isRouteAllowed("/supplier/dashboard/settings", ["/supplier/dashboard"]),
    ).toBe(true);
    expect(
      isRouteAllowed("/supplier/onboarding/path", ["/supplier/onboarding"]),
    ).toBe(true);
  });

  it("rejects prefix-boundary tricks", () => {
    expect(
      isRouteAllowed("/supplier/dashboardXXX", ["/supplier/dashboard"]),
    ).toBe(false);
    expect(isRouteAllowed("/supplierX", ["/supplier"])).toBe(false);
  });

  it("empty allow list rejects everything", () => {
    expect(isRouteAllowed("/supplier/dashboard", [])).toBe(false);
    expect(isRouteAllowed("/", [])).toBe(false);
  });

  it("approved prefix /supplier accepts any /supplier/*", () => {
    expect(isRouteAllowed("/supplier/catalog", ["/supplier"])).toBe(true);
    expect(isRouteAllowed("/supplier/rfqs/abc-123", ["/supplier"])).toBe(true);
  });
});
