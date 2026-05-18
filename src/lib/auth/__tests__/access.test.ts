import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveAccessForUserUncached } from "../access";
import { resolveActiveCompanyForRequest } from "../activeCompany";

type AdminClient = ReturnType<typeof createSupabaseServiceRoleClient>;

// ---------------------------------------------------------------------------
// Minimal mock admin client. The resolver only uses a narrow slice of the
// supabase API: `.from(table).select(cols, opts?).eq(col, val).maybeSingle?()`.
// We model each table as a lookup keyed by the filter column so we can return
// canned rows + counts without spinning up a real DB.
// ---------------------------------------------------------------------------

type ProfileRow =
  | {
      role: string;
      organizer_legal_type?: "individual" | "company" | null;
      last_active_company_id?: string | null;
    }
  | null;
type SupplierRow = {
  id: string;
  legal_type: string | null;
  verification_status: "pending" | "approved" | "rejected";
} | null;

type MembershipRow = {
  company_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
};

type Fixtures = {
  profiles: Record<string, ProfileRow>; // keyed by user id
  suppliers?: Record<string, SupplierRow>; // keyed by profile_id
  supplierDocs?: Record<string, number>; // keyed by supplier_id → count
  supplierCategories?: Record<string, number>; // keyed by supplier_id → count
  memberships?: Record<string, MembershipRow[]>; // keyed by profile_id
};

type EqArgs = { column: string; value: string };

function createMockAdmin(fx: Fixtures) {
  const mock = {
    from(table: string) {
      return {
        select(_cols: string, opts?: { count?: string; head?: boolean }) {
          const eqs: EqArgs[] = [];
          const isCount = opts?.count === "exact" && opts?.head === true;
          let isFiltered = false;

          const chain = {
            eq(column: string, value: string) {
              eqs.push({ column, value });
              return chain;
            },
            is(_column: string, _value: unknown) {
              // Tracked but not used by current fixtures — the only `.is()`
              // call today is `is("removed_at", null)` on the memberships
              // query, which is implicitly the only path returning rows here.
              isFiltered = true;
              return chain;
            },
            async maybeSingle() {
              const key = eqs[0]?.value ?? "";
              if (table === "profiles") {
                return { data: fx.profiles[key] ?? null, error: null };
              }
              if (table === "suppliers") {
                return { data: (fx.suppliers ?? {})[key] ?? null, error: null };
              }
              return { data: null, error: null };
            },
            then(
              onFulfilled?: (
                v:
                  | { count: number | null; error: null }
                  | { data: MembershipRow[]; error: null },
              ) => unknown,
            ) {
              // Used by:
              //   * count-style queries (`{count:"exact", head:true}`) on
              //     supplier_docs / supplier_categories.
              //   * list-style queries on `organizer_memberships` which are
              //     awaited directly without calling .maybeSingle().
              const key = eqs[0]?.value ?? "";
              if (table === "organizer_memberships") {
                const rows = (fx.memberships ?? {})[key] ?? [];
                return Promise.resolve({ data: rows, error: null }).then(
                  onFulfilled,
                );
              }
              const count = isCount
                ? table === "supplier_docs"
                  ? (fx.supplierDocs ?? {})[key] ?? 0
                  : table === "supplier_categories"
                    ? (fx.supplierCategories ?? {})[key] ?? 0
                    : 0
                : null;
              return Promise.resolve({ count, error: null }).then(onFulfilled);
            },
          };
          // Reference isFiltered to avoid "declared but not used" once we add
          // assertions on it in a later PR. The current behavior is that an
          // .is() call simply marks the chain as having a non-eq filter; the
          // mock does not validate the column/value pair yet.
          void isFiltered;
          return chain;
        },
      };
    },
  };
  return mock as unknown as AdminClient;
}

describe("resolveAccessForUserUncached", () => {
  it("unauthenticated when userId is null", async () => {
    const admin = createMockAdmin({ profiles: {} });
    const decision = await resolveAccessForUserUncached(null, { admin });
    expect(decision.state).toBe("unauthenticated");
    expect(decision.bestDestination).toBe("/sign-in");
    expect(decision.role).toBeNull();
    expect(decision.userId).toBeNull();
    expect(decision.supplierId).toBeNull();
  });

  it("forbidden when profile row is missing", async () => {
    const admin = createMockAdmin({ profiles: { "user-1": null } });
    const decision = await resolveAccessForUserUncached("user-1", { admin });
    expect(decision.state).toBe("forbidden");
    expect(decision.bestDestination).toBe("/");
    expect(decision.role).toBeNull();
    expect(decision.userId).toBe("user-1");
  });

  it("forbidden when role is unrecognised", async () => {
    const admin = createMockAdmin({ profiles: { "user-1": { role: "" } } });
    const decision = await resolveAccessForUserUncached("user-1", { admin });
    expect(decision.state).toBe("forbidden");
  });

  it("organizer.active for organizer role", async () => {
    const admin = createMockAdmin({
      profiles: { "user-1": { role: "organizer" } },
    });
    const decision = await resolveAccessForUserUncached("user-1", { admin });
    expect(decision.state).toBe("organizer.active");
    expect(decision.role).toBe("organizer");
    expect(decision.bestDestination).toBe("/organizer/dashboard");
    expect(decision.features["organizer.events"]).toBe(true);
    expect(decision.features["supplier.dashboard"]).toBeFalsy();
  });

  it("agency.active mirrors organizer surface", async () => {
    const admin = createMockAdmin({
      profiles: { "user-1": { role: "agency" } },
    });
    const decision = await resolveAccessForUserUncached("user-1", { admin });
    expect(decision.state).toBe("agency.active");
    expect(decision.bestDestination).toBe("/organizer/dashboard");
    expect(decision.features["organizer.events"]).toBe(true);
    expect(decision.features["organizer.bookings"]).toBe(true);
  });

  it("admin.active has the full surface", async () => {
    const admin = createMockAdmin({
      profiles: { "user-1": { role: "admin" } },
    });
    const decision = await resolveAccessForUserUncached("user-1", { admin });
    expect(decision.state).toBe("admin.active");
    expect(decision.features["admin.console"]).toBe(true);
    expect(decision.features["supplier.dashboard"]).toBe(true);
    expect(decision.features["organizer.dashboard"]).toBe(true);
  });

  it("supplier with no row → supplier.no_row", async () => {
    const admin = createMockAdmin({
      profiles: { "user-1": { role: "supplier" } },
      suppliers: { "user-1": null },
    });
    const decision = await resolveAccessForUserUncached("user-1", { admin });
    expect(decision.state).toBe("supplier.no_row");
    expect(decision.bestDestination).toBe("/supplier/onboarding/path");
    expect(decision.supplierId).toBeNull();
    expect(decision.features["supplier.onboarding.path"]).toBe(true);
    expect(decision.features["supplier.catalog"]).toBeFalsy();
  });

  it("supplier pending + no docs/categories → in_onboarding", async () => {
    const admin = createMockAdmin({
      profiles: { "user-1": { role: "supplier" } },
      suppliers: {
        "user-1": {
          id: "sup-1",
          legal_type: "company",
          verification_status: "pending",
        },
      },
      supplierDocs: { "sup-1": 0 },
      supplierCategories: { "sup-1": 0 },
    });
    const decision = await resolveAccessForUserUncached("user-1", { admin });
    expect(decision.state).toBe("supplier.in_onboarding");
    expect(decision.supplierId).toBe("sup-1");
    expect(decision.features["supplier.dashboard"]).toBe(true);
    expect(decision.features["supplier.catalog"]).toBeFalsy();
  });

  it("supplier pending + docs but no categories → in_onboarding", async () => {
    const admin = createMockAdmin({
      profiles: { "user-1": { role: "supplier" } },
      suppliers: {
        "user-1": {
          id: "sup-1",
          legal_type: "company",
          verification_status: "pending",
        },
      },
      supplierDocs: { "sup-1": 2 },
      supplierCategories: { "sup-1": 0 },
    });
    const decision = await resolveAccessForUserUncached("user-1", { admin });
    expect(decision.state).toBe("supplier.in_onboarding");
  });

  it("supplier pending + docs + categories → pending_review", async () => {
    const admin = createMockAdmin({
      profiles: { "user-1": { role: "supplier" } },
      suppliers: {
        "user-1": {
          id: "sup-1",
          legal_type: "company",
          verification_status: "pending",
        },
      },
      supplierDocs: { "sup-1": 1 },
      supplierCategories: { "sup-1": 3 },
    });
    const decision = await resolveAccessForUserUncached("user-1", { admin });
    expect(decision.state).toBe("supplier.pending_review");
    expect(decision.features["supplier.dashboard"]).toBe(true);
    expect(decision.features["supplier.catalog"]).toBeFalsy();
    expect(decision.features["supplier.rfqs.respond"]).toBeFalsy();
  });

  it("supplier approved → full feature set", async () => {
    const admin = createMockAdmin({
      profiles: { "user-1": { role: "supplier" } },
      suppliers: {
        "user-1": {
          id: "sup-1",
          legal_type: "company",
          verification_status: "approved",
        },
      },
    });
    const decision = await resolveAccessForUserUncached("user-1", { admin });
    expect(decision.state).toBe("supplier.approved");
    expect(decision.features["supplier.dashboard"]).toBe(true);
    expect(decision.features["supplier.catalog"]).toBe(true);
    expect(decision.features["supplier.calendar"]).toBe(true);
    expect(decision.features["supplier.bookings"]).toBe(true);
    expect(decision.features["supplier.rfqs.view"]).toBe(true);
    expect(decision.features["supplier.rfqs.respond"]).toBe(true);
    expect(decision.features["supplier.profile.customize"]).toBe(true);
    // Path picker remains locked for approved users.
    expect(decision.features["supplier.onboarding.path"]).toBeFalsy();
  });

  // -----------------------------------------------------------------------
  // Company-organizer resolver branches (IS_COMPANY_FEATURES_ENABLED=true).
  //
  // These tests exercise the post-PR1 paths in buildOrganizerDecision that
  // the original suite never touched. Each test scopes the env flag with
  // before/after rather than a nested describe so we don't grow the file's
  // top-level structure.
  // -----------------------------------------------------------------------

  describe("organizer.* with company features enabled", () => {
    const orig = process.env.IS_COMPANY_FEATURES_ENABLED;
    beforeEach(() => {
      process.env.IS_COMPANY_FEATURES_ENABLED = "true";
    });
    afterEach(() => {
      if (orig === undefined) {
        delete process.env.IS_COMPANY_FEATURES_ENABLED;
      } else {
        process.env.IS_COMPANY_FEATURES_ENABLED = orig;
      }
    });

    it("organizer.no_company when legal_type=company AND no memberships", async () => {
      const admin = createMockAdmin({
        profiles: {
          "user-1": {
            role: "organizer",
            organizer_legal_type: "company",
            last_active_company_id: null,
          },
        },
        memberships: { "user-1": [] },
      });
      const decision = await resolveAccessForUserUncached("user-1", { admin });
      expect(decision.state).toBe("organizer.no_company");
      expect(decision.activeCompanyId).toBeNull();
      expect(decision.availableCompanyIds).toEqual([]);
    });

    it("auto-resolves a single membership", async () => {
      const admin = createMockAdmin({
        profiles: {
          "user-1": {
            role: "organizer",
            organizer_legal_type: "company",
            last_active_company_id: null,
          },
        },
        memberships: {
          "user-1": [
            {
              company_id: "c-only",
              role: "owner",
              joined_at: "2026-01-01T00:00:00Z",
            },
          ],
        },
      });
      const decision = await resolveAccessForUserUncached("user-1", { admin });
      expect(decision.state).toBe("organizer.active");
      expect(decision.activeCompanyId).toBe("c-only");
      expect(decision.companyRole).toBe("owner");
      expect(decision.availableCompanyIds).toEqual(["c-only"]);
    });

    it("picks most-recently-joined when multi-company and no signal", async () => {
      const admin = createMockAdmin({
        profiles: {
          "user-1": {
            role: "organizer",
            organizer_legal_type: "company",
            last_active_company_id: null,
          },
        },
        memberships: {
          "user-1": [
            {
              company_id: "c-old",
              role: "member",
              joined_at: "2026-01-01T00:00:00Z",
            },
            {
              company_id: "c-new",
              role: "admin",
              joined_at: "2026-05-01T00:00:00Z",
            },
          ],
        },
      });
      const decision = await resolveAccessForUserUncached("user-1", { admin });
      expect(decision.activeCompanyId).toBe("c-new");
      expect(decision.companyRole).toBe("admin");
      expect(decision.availableCompanyIds.sort()).toEqual(["c-new", "c-old"]);
    });

    it("preVerifiedCompanyId wins over auto-resolve when caller is a member", async () => {
      const admin = createMockAdmin({
        profiles: {
          "user-1": {
            role: "organizer",
            organizer_legal_type: "company",
            last_active_company_id: null,
          },
        },
        memberships: {
          "user-1": [
            {
              company_id: "c-default",
              role: "owner",
              joined_at: "2026-05-01T00:00:00Z",
            },
            {
              company_id: "c-target",
              role: "member",
              joined_at: "2026-01-01T00:00:00Z",
            },
          ],
        },
      });
      const decision = await resolveAccessForUserUncached("user-1", {
        admin,
        preVerifiedCompanyId: "c-target",
      });
      expect(decision.activeCompanyId).toBe("c-target");
      expect(decision.companyRole).toBe("member");
    });

    it("drops stale preVerifiedCompanyId when caller is not a current member", async () => {
      const admin = createMockAdmin({
        profiles: {
          "user-1": {
            role: "organizer",
            organizer_legal_type: "company",
            last_active_company_id: null,
          },
        },
        memberships: {
          "user-1": [
            {
              company_id: "c-only",
              role: "owner",
              joined_at: "2026-01-01T00:00:00Z",
            },
          ],
        },
      });
      const decision = await resolveAccessForUserUncached("user-1", {
        admin,
        preVerifiedCompanyId: "c-removed",
      });
      expect(decision.activeCompanyId).toBe("c-only");
      expect(decision.companyRole).toBe("owner");
    });

    it("individual legal_type with no memberships → organizer.active, no company", async () => {
      const admin = createMockAdmin({
        profiles: {
          "user-1": {
            role: "organizer",
            organizer_legal_type: "individual",
            last_active_company_id: null,
          },
        },
        memberships: { "user-1": [] },
      });
      const decision = await resolveAccessForUserUncached("user-1", { admin });
      expect(decision.state).toBe("organizer.active");
      expect(decision.activeCompanyId).toBeNull();
      expect(decision.availableCompanyIds).toEqual([]);
    });
  });

  // Pure resolver — direct tests for cookie / last_active fallback behavior
  // and removed-member staleness. Avoids the next/headers cookies() mock.
  describe("resolveActiveCompanyForRequest", () => {
    const memberships = [
      {
        company_id: "c-1",
        role: "owner" as const,
        joined_at: "2026-01-01T00:00:00Z",
      },
      {
        company_id: "c-2",
        role: "member" as const,
        joined_at: "2026-02-01T00:00:00Z",
      },
    ];

    it("drops cookie referencing a non-member company", () => {
      const out = resolveActiveCompanyForRequest(memberships, {
        cookieValue: "c-removed",
      });
      // Falls through to most-recently-joined (c-2).
      expect(out.activeCompanyId).toBe("c-2");
    });

    it("falls back to last_active when cookie is missing", () => {
      const out = resolveActiveCompanyForRequest(memberships, {
        cookieValue: null,
        lastActiveCompanyId: "c-1",
      });
      expect(out.activeCompanyId).toBe("c-1");
      expect(out.companyRole).toBe("owner");
    });

    it("returns null/null when no memberships at all", () => {
      const out = resolveActiveCompanyForRequest([], {
        preVerifiedCompanyId: "c-1",
        cookieValue: "c-1",
        lastActiveCompanyId: "c-1",
      });
      expect(out.activeCompanyId).toBeNull();
      expect(out.companyRole).toBeNull();
    });
  });

  it("supplier rejected → dashboard + wizard only", async () => {
    const admin = createMockAdmin({
      profiles: { "user-1": { role: "supplier" } },
      suppliers: {
        "user-1": {
          id: "sup-1",
          legal_type: "company",
          verification_status: "rejected",
        },
      },
    });
    const decision = await resolveAccessForUserUncached("user-1", { admin });
    expect(decision.state).toBe("supplier.rejected");
    expect(decision.features["supplier.dashboard"]).toBe(true);
    expect(decision.features["supplier.onboarding.wizard"]).toBe(true);
    expect(decision.features["supplier.catalog"]).toBeFalsy();
    expect(decision.features["supplier.calendar"]).toBeFalsy();
    expect(decision.features["supplier.bookings"]).toBeFalsy();
    expect(decision.features["supplier.rfqs.view"]).toBeFalsy();
    expect(decision.features["supplier.rfqs.respond"]).toBeFalsy();
    expect(decision.features["supplier.profile.customize"]).toBeFalsy();
  });
});
