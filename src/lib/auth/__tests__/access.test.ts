import { describe, expect, it } from "vitest";
import type { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveAccessForUserUncached } from "../access";

type AdminClient = ReturnType<typeof createSupabaseServiceRoleClient>;

// ---------------------------------------------------------------------------
// Minimal mock admin client. The resolver only uses a narrow slice of the
// supabase API: `.from(table).select(cols, opts?).eq(col, val).maybeSingle?()`.
// We model each table as a lookup keyed by the filter column so we can return
// canned rows + counts without spinning up a real DB.
// ---------------------------------------------------------------------------

type ProfileRow = { role: string } | null;
type SupplierRow = {
  id: string;
  legal_type: string | null;
  verification_status: "pending" | "approved" | "rejected";
} | null;

type Fixtures = {
  profiles: Record<string, ProfileRow>; // keyed by user id
  suppliers?: Record<string, SupplierRow>; // keyed by profile_id
  supplierDocs?: Record<string, number>; // keyed by supplier_id → count
  supplierCategories?: Record<string, number>; // keyed by supplier_id → count
};

type EqArgs = { column: string; value: string };

function createMockAdmin(fx: Fixtures) {
  const mock = {
    from(table: string) {
      return {
        select(_cols: string, opts?: { count?: string; head?: boolean }) {
          const eqs: EqArgs[] = [];
          const isCount = opts?.count === "exact" && opts?.head === true;

          const chain = {
            eq(column: string, value: string) {
              eqs.push({ column, value });
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
              onFulfilled?: (v: { count: number | null; error: null }) => unknown,
            ) {
              // Used by count-style queries which await the select().eq() chain
              // without calling maybeSingle(). Only relevant for head:true.
              const key = eqs[0]?.value ?? "";
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
