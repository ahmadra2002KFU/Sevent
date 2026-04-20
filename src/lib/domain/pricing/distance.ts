/**
 * Distance lookup for the pricing engine's `distance_fee` rule.
 *
 * v1 design (Codex-reviewed): compute on demand via PostGIS `ST_Distance`
 * through a narrow SECURITY DEFINER RPC (`public.supplier_distance_km`).
 * No cache table — pilot traffic (~30 quotes) does not justify the
 * operational cost; Haversine compute is microseconds. If profiling later
 * shows it matters, introduce caching behind this same function signature
 * so callers don't change.
 *
 * Returns `null` if either the venue coordinates are unknown (no Places
 * Autocomplete in Sprint 3) or the supplier has no `base_location`. The
 * engine interprets `null` by skipping the `distance_fee` rule with
 * reason `"no_venue_location"` and still producing a valid snapshot.
 *
 * This module is the ONLY I/O surface of the pricing domain. Everything
 * else in `src/lib/domain/pricing` is pure. Callers should resolve the
 * distance number via this helper BEFORE calling `composePrice`, so the
 * engine itself stays deterministic + unit-testable.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type GetDistanceKmParams = {
  /**
   * Service-role Supabase client. We need service-role because the RPC is
   * granted only to service_role (see migration
   * 20260420030000_supplier_distance_fn.sql) — RLS on `suppliers.base_location`
   * would otherwise hide the coordinates from an unrelated organizer.
   */
  admin: SupabaseClient;
  supplier_id: string;
  venue_lat: number | null;
  venue_lng: number | null;
};

export async function getDistanceKm(
  params: GetDistanceKmParams,
): Promise<number | null> {
  const { admin, supplier_id, venue_lat, venue_lng } = params;

  // Short-circuit: if the venue has no coordinates, there is nothing to
  // measure. Returning null here also avoids a pointless network round-trip.
  if (venue_lat === null || venue_lng === null) {
    return null;
  }

  const { data, error } = await admin.rpc("supplier_distance_km", {
    p_supplier_id: supplier_id,
    p_lat: venue_lat,
    p_lng: venue_lng,
  });

  if (error) {
    // Surface the SQL error to the caller — a 500-class failure here should
    // bubble up to the server action so it can decide whether to skip the
    // distance_fee rule gracefully or show an error. We do NOT swallow it:
    // silently returning null would make an RPC outage look identical to
    // "supplier has no base_location".
    throw new Error(
      `supplier_distance_km failed for supplier ${supplier_id}: ${error.message}`,
    );
  }

  // The RPC returns a single numeric or null (SQL function returns scalar).
  // Supabase JS wraps scalar RPC results as the scalar directly when the
  // function signature is `returns double precision`.
  if (data === null || data === undefined) {
    return null; // supplier has no base_location
  }
  const km = typeof data === "number" ? data : Number(data);
  if (!Number.isFinite(km)) return null;
  return km;
}
