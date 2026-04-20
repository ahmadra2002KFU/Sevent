/**
 * Distance lookup for the pricing engine's `distance_fee` rule.
 *
 * v1 design (Codex-reviewed): compute on demand via PostGIS `ST_Distance`.
 * No cache table — pilot traffic (~30 quotes) does not justify the
 * operational cost; Haversine compute is microseconds. If profiling later
 * shows it matters, introduce caching behind this same function signature
 * so callers don't change.
 *
 * Returns `null` if either the venue coordinates are unknown (no Places
 * Autocomplete in Sprint 3) or the supplier has no `base_location`. The
 * engine interprets `null` by skipping the `distance_fee` rule with
 * reason `"no_venue_location"`.
 *
 * Lane 0 ships a stub that always returns `null`. Lane 1 wires the real
 * PostGIS query.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type GetDistanceKmParams = {
  /** Service-role client. Reads suppliers.base_location which is public via service-role. */
  admin: SupabaseClient;
  supplier_id: string;
  venue_lat: number | null;
  venue_lng: number | null;
};

export async function getDistanceKm(params: GetDistanceKmParams): Promise<number | null> {
  void params; // stub — Lane 1 replaces with ST_Distance query
  return null;
}
