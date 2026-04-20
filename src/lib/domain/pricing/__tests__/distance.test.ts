/**
 * Unit tests for `getDistanceKm` — the only I/O surface in the pricing
 * domain. Everything else is pure; this helper is exercised with a mocked
 * Supabase admin client so the test suite stays hermetic (no network, no
 * Postgres required).
 *
 * Contract under test:
 *  - null venue coords short-circuit to null (no RPC call)
 *  - happy path returns the numeric km from `supplier_distance_km` RPC
 *  - null RPC result (supplier has no base_location) → null
 *  - RPC error is surfaced as a thrown Error, NOT swallowed to null — a
 *    silent null here would make an outage indistinguishable from "no
 *    base_location", which hides real bugs.
 */

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDistanceKm } from "../distance";

type RpcResponse =
  | { data: number | null; error: null }
  | { data: null; error: { message: string } };

/**
 * Build a minimal stand-in for a SupabaseClient that only implements the
 * `.rpc()` method. We deliberately avoid pulling in the real client so the
 * test never tries to reach a network.
 */
function mockAdmin(rpcResult: RpcResponse, spy?: ReturnType<typeof vi.fn>) {
  const rpc = spy ?? vi.fn();
  rpc.mockResolvedValue(rpcResult);
  return {
    rpc,
    client: {
      rpc,
    } as unknown as SupabaseClient,
  };
}

describe("getDistanceKm", () => {
  it("returns null without calling the RPC when venue_lat is null", async () => {
    const { client, rpc } = mockAdmin({ data: 0, error: null });
    const km = await getDistanceKm({
      admin: client,
      supplier_id: "sup-1",
      venue_lat: null,
      venue_lng: 46.7,
    });
    expect(km).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns null without calling the RPC when venue_lng is null", async () => {
    const { client, rpc } = mockAdmin({ data: 0, error: null });
    const km = await getDistanceKm({
      admin: client,
      supplier_id: "sup-1",
      venue_lat: 24.7,
      venue_lng: null,
    });
    expect(km).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the RPC scalar for a supplier with a cached base_location", async () => {
    const { client, rpc } = mockAdmin({ data: 42.5, error: null });
    const km = await getDistanceKm({
      admin: client,
      supplier_id: "sup-1",
      venue_lat: 24.7,
      venue_lng: 46.7,
    });
    expect(km).toBe(42.5);
    expect(rpc).toHaveBeenCalledWith("supplier_distance_km", {
      p_supplier_id: "sup-1",
      p_lat: 24.7,
      p_lng: 46.7,
    });
  });

  it("returns null when the RPC returns null (supplier has no base_location)", async () => {
    const { client } = mockAdmin({ data: null, error: null });
    const km = await getDistanceKm({
      admin: client,
      supplier_id: "sup-2",
      venue_lat: 24.7,
      venue_lng: 46.7,
    });
    expect(km).toBeNull();
  });

  it("throws when the RPC surfaces a SQL error (never silently returns null)", async () => {
    const { client } = mockAdmin({
      data: null,
      error: { message: "permission denied" },
    });
    await expect(
      getDistanceKm({
        admin: client,
        supplier_id: "sup-3",
        venue_lat: 24.7,
        venue_lng: 46.7,
      }),
    ).rejects.toThrow(/supplier_distance_km failed for supplier sup-3/);
  });

  it("coerces a numeric-string RPC result to a finite number", async () => {
    // Some Supabase configurations stringify numeric / double precision; make
    // sure we handle that gracefully without returning a string through.
    const { client } = mockAdmin({
      data: "12.75" as unknown as number,
      error: null,
    });
    const km = await getDistanceKm({
      admin: client,
      supplier_id: "sup-4",
      venue_lat: 24.7,
      venue_lng: 46.7,
    });
    expect(km).toBe(12.75);
  });

  it("returns null when the RPC result coerces to NaN", async () => {
    const { client } = mockAdmin({
      data: "not-a-number" as unknown as number,
      error: null,
    });
    const km = await getDistanceKm({
      admin: client,
      supplier_id: "sup-5",
      venue_lat: 24.7,
      venue_lng: 46.7,
    });
    expect(km).toBeNull();
  });
});
