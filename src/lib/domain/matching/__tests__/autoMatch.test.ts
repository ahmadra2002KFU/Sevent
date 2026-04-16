import { describe, it, expect } from "vitest";
import {
  computeAutoMatch,
  type AutoMatchCandidate,
  type AutoMatchContext,
} from "../autoMatch";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const CTX: AutoMatchContext = {
  event: {
    id: "event-1",
    city: "Riyadh",
    starts_at: "2026-05-01T18:00:00Z",
    ends_at: "2026-05-01T23:00:00Z",
    guest_count: 200,
  },
  category_id: "cat-catering",
  subcategory_id: "sub-buffet",
};

function baseCandidate(
  overrides: Partial<AutoMatchCandidate> = {},
): AutoMatchCandidate {
  return {
    supplier_id: "supplier-default",
    business_name: "Default Supplier",
    slug: "default-supplier",
    base_city: "Riyadh",
    service_area_cities: [],
    concurrent_event_limit: 1,
    active_overlaps: 0,
    packages: [
      {
        id: "pkg-default",
        min_qty: 50,
        max_qty: 300,
        base_price_halalas: 1_000_00,
      },
    ],
    response_rate_30d: 0.9,
    invites_last_14d: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Determinism
// ---------------------------------------------------------------------------

describe("computeAutoMatch — determinism", () => {
  it("produces identical output for identical input across calls", () => {
    const candidates: AutoMatchCandidate[] = [
      baseCandidate({ supplier_id: "sup-a" }),
      baseCandidate({ supplier_id: "sup-b", response_rate_30d: 0.7 }),
      baseCandidate({ supplier_id: "sup-c", base_city: "Jeddah", service_area_cities: ["Riyadh"] }),
    ];
    const first = computeAutoMatch(CTX, candidates);
    const second = computeAutoMatch(CTX, candidates);
    const third = computeAutoMatch(CTX, [...candidates].reverse());
    expect(first).toEqual(second);
    expect(first).toEqual(third);
  });
});

// ---------------------------------------------------------------------------
// 2. Tiebreak by supplier_id ASC
// ---------------------------------------------------------------------------

describe("computeAutoMatch — tiebreak", () => {
  it("tiebreaks by supplier_id ASC when totals are equal", () => {
    const candidates = [
      baseCandidate({ supplier_id: "sup-z" }),
      baseCandidate({ supplier_id: "sup-a" }),
      baseCandidate({ supplier_id: "sup-m" }),
    ];
    const result = computeAutoMatch(CTX, candidates);
    const totals = new Set(result.map((r) => r.breakdown.total));
    expect(totals.size).toBe(1); // all tied
    expect(result.map((r) => r.supplier_id)).toEqual(["sup-a", "sup-m", "sup-z"]);
  });
});

// ---------------------------------------------------------------------------
// 3. Same-city > service-area-only
// ---------------------------------------------------------------------------

describe("computeAutoMatch — travel dimension", () => {
  it("ranks same-city supplier above service-area-only when all else equal", () => {
    const sameCity = baseCandidate({
      supplier_id: "sup-same-city",
      base_city: "Riyadh",
      service_area_cities: [],
    });
    const serviceAreaOnly = baseCandidate({
      supplier_id: "sup-service",
      base_city: "Dammam",
      service_area_cities: ["Riyadh"],
    });
    const result = computeAutoMatch(CTX, [serviceAreaOnly, sameCity]);
    expect(result[0].supplier_id).toBe("sup-same-city");
    expect(result[1].supplier_id).toBe("sup-service");
    expect(result[0].breakdown.travel).toBeGreaterThan(result[1].breakdown.travel);
  });
});

// ---------------------------------------------------------------------------
// 4. Capability floor — no matching package → lower rank
// ---------------------------------------------------------------------------

describe("computeAutoMatch — capability dimension", () => {
  it("ranks qty-matching packages above qty-mismatched ones", () => {
    const matches = baseCandidate({
      supplier_id: "sup-fits",
      packages: [{ id: "p1", min_qty: 100, max_qty: 500, base_price_halalas: 1 }],
    });
    const noMatch = baseCandidate({
      supplier_id: "sup-nofit",
      packages: [{ id: "p2", min_qty: 10, max_qty: 50, base_price_halalas: 1 }],
    });
    const result = computeAutoMatch(CTX, [noMatch, matches]);
    expect(result[0].supplier_id).toBe("sup-fits");
    expect(result[0].breakdown.capability).toBe(1);
    expect(result[1].breakdown.capability).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// 5. Rotation penalty at 3 invites
// ---------------------------------------------------------------------------

describe("computeAutoMatch — rotation dimension", () => {
  it("applies full rotation penalty at 3 invites in last 14 days", () => {
    const heavyInvite = baseCandidate({ supplier_id: "sup-heavy", invites_last_14d: 3 });
    const noInvite = baseCandidate({ supplier_id: "sup-fresh", invites_last_14d: 0 });
    const result = computeAutoMatch(CTX, [heavyInvite, noInvite]);
    expect(result[0].supplier_id).toBe("sup-fresh");
    expect(result[0].breakdown.rotation).toBe(1);
    expect(result[1].breakdown.rotation).toBe(0);
  });

  it("scales rotation linearly between 0 and 3 invites", () => {
    const light = baseCandidate({ supplier_id: "sup-light", invites_last_14d: 1 });
    const medium = baseCandidate({ supplier_id: "sup-medium", invites_last_14d: 2 });
    const result = computeAutoMatch(CTX, [light, medium]);
    const lightResult = result.find((r) => r.supplier_id === "sup-light")!;
    const medResult = result.find((r) => r.supplier_id === "sup-medium")!;
    expect(lightResult.breakdown.rotation).toBeCloseTo(2 / 3, 4);
    expect(medResult.breakdown.rotation).toBeCloseTo(1 / 3, 4);
  });
});

// ---------------------------------------------------------------------------
// 6. Null responsiveness — neutral 0.5
// ---------------------------------------------------------------------------

describe("computeAutoMatch — responsiveness dimension", () => {
  it("treats null response_rate_30d as neutral 0.5", () => {
    const nullRate = baseCandidate({ supplier_id: "sup-null", response_rate_30d: null });
    const result = computeAutoMatch(CTX, [nullRate]);
    expect(result[0].breakdown.responsiveness).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// 7. Top-5 cap
// ---------------------------------------------------------------------------

describe("computeAutoMatch — top-N cap", () => {
  it("returns at most 5 results from 11 candidates", () => {
    const candidates = Array.from({ length: 11 }, (_, i) =>
      baseCandidate({
        supplier_id: `sup-${String(i).padStart(2, "0")}`,
        response_rate_30d: 0.5 + i * 0.01,
      }),
    );
    const result = computeAutoMatch(CTX, candidates);
    expect(result).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// 8. Empty input → empty output
// ---------------------------------------------------------------------------

describe("computeAutoMatch — empty input", () => {
  it("returns empty array when given no candidates", () => {
    expect(computeAutoMatch(CTX, [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 9. guest_count null → capability purely on package existence
// ---------------------------------------------------------------------------

describe("computeAutoMatch — guest_count null", () => {
  it("treats any package as fully capable when event.guest_count is null", () => {
    const noGuestCtx: AutoMatchContext = {
      ...CTX,
      event: { ...CTX.event, guest_count: null },
    };
    const hasPackages = baseCandidate({
      supplier_id: "sup-has",
      packages: [{ id: "p", min_qty: 10_000, max_qty: 20_000, base_price_halalas: 1 }],
    });
    const result = computeAutoMatch(noGuestCtx, [hasPackages]);
    expect(result[0].breakdown.capability).toBe(1);
  });

  it("treats zero packages as zero capability even when guest_count is null", () => {
    const noGuestCtx: AutoMatchContext = {
      ...CTX,
      event: { ...CTX.event, guest_count: null },
    };
    const noPackages = baseCandidate({ supplier_id: "sup-empty", packages: [] });
    const result = computeAutoMatch(noGuestCtx, [noPackages]);
    expect(result[0].breakdown.capability).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 10. Every total in [0, 1]
// ---------------------------------------------------------------------------

describe("computeAutoMatch — score bounds", () => {
  it("keeps every total score within [0, 1]", () => {
    const candidates: AutoMatchCandidate[] = [
      baseCandidate({ supplier_id: "sup-perfect", response_rate_30d: 1, invites_last_14d: 0 }),
      baseCandidate({
        supplier_id: "sup-worst",
        response_rate_30d: 0,
        invites_last_14d: 10, // very negative rotation input, expect clamp to 0
        base_city: "Jeddah",
        service_area_cities: [],
        packages: [],
      }),
      baseCandidate({
        supplier_id: "sup-mid",
        response_rate_30d: 0.5,
        invites_last_14d: 1,
        base_city: "Dammam",
        service_area_cities: ["Riyadh"],
      }),
    ];
    const result = computeAutoMatch(CTX, candidates);
    for (const r of result) {
      expect(r.breakdown.total).toBeGreaterThanOrEqual(0);
      expect(r.breakdown.total).toBeLessThanOrEqual(1);
      expect(r.breakdown.capability).toBeGreaterThanOrEqual(0);
      expect(r.breakdown.capability).toBeLessThanOrEqual(1);
      expect(r.breakdown.travel).toBeGreaterThanOrEqual(0);
      expect(r.breakdown.travel).toBeLessThanOrEqual(1);
      expect(r.breakdown.responsiveness).toBeGreaterThanOrEqual(0);
      expect(r.breakdown.responsiveness).toBeLessThanOrEqual(1);
      expect(r.breakdown.rotation).toBeGreaterThanOrEqual(0);
      expect(r.breakdown.rotation).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 11. Reasons attached
// ---------------------------------------------------------------------------

describe("computeAutoMatch — reasons", () => {
  it("attaches at least one reason to every ranked result", () => {
    const result = computeAutoMatch(CTX, [baseCandidate()]);
    expect(result[0].reasons.length).toBeGreaterThan(0);
    expect(result[0].reasons.every((r) => typeof r === "string" && r.length > 0)).toBe(true);
  });

  it("includes a same-city reason when base_city matches event city", () => {
    const result = computeAutoMatch(CTX, [baseCandidate({ supplier_id: "sup-rh" })]);
    expect(result[0].reasons.some((r) => r.includes("Riyadh"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12. Full ranking spot-check
// ---------------------------------------------------------------------------

describe("computeAutoMatch — realistic ranking", () => {
  it("puts the fully-qualified supplier ahead of partials", () => {
    const perfect = baseCandidate({
      supplier_id: "sup-perfect",
      base_city: "Riyadh",
      response_rate_30d: 1,
      invites_last_14d: 0,
      packages: [{ id: "p", min_qty: 100, max_qty: 500, base_price_halalas: 1 }],
    });
    const weakerTravel = baseCandidate({
      supplier_id: "sup-service",
      base_city: "Jeddah",
      service_area_cities: ["Riyadh"],
      response_rate_30d: 1,
      invites_last_14d: 0,
    });
    const weakerResponse = baseCandidate({
      supplier_id: "sup-slow",
      response_rate_30d: 0.1,
      invites_last_14d: 0,
    });
    const result = computeAutoMatch(CTX, [weakerResponse, weakerTravel, perfect]);
    expect(result[0].supplier_id).toBe("sup-perfect");
    expect(result[0].breakdown.total).toBeGreaterThan(result[1].breakdown.total);
  });
});
