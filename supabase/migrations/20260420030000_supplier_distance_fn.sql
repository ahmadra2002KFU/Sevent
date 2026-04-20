-- =============================================================================
-- Sprint 4 Lane 1 — supplier_distance_km RPC
-- =============================================================================
--
-- Exposes the single PostGIS query the pricing engine needs to evaluate a
-- `distance_fee` rule: great-circle distance from a supplier's cached
-- `base_location` to the event's venue coordinates, in kilometres.
--
-- Why a SECURITY DEFINER RPC and not an inline `.from("suppliers").select(...)`:
--  - `suppliers.base_location` is `geography(point, 4326)`; the PostgREST
--    JSON projection of `geography` is a hex-encoded EWKB blob, not something
--    we want to deserialize client-side. PostGIS `ST_Distance` does the work
--    in-db and we only ship a numeric back.
--  - Centralises the conversion to km (÷1000) in one place; future changes
--    (e.g. swap haversine for a routing service) stay behind the RPC.
--  - Grants are locked to `service_role` so the function can't be invoked by
--    a signed-in organizer who hasn't been vetted by the server action layer.
--
-- Null contract (mirrored in src/lib/domain/pricing/distance.ts):
--  - Returns NULL if the supplier has no base_location (not yet onboarded).
--  - Callers pass lat/lng as `double precision`; the engine is responsible for
--    passing NULL when the venue has no coordinates (no Places Autocomplete in
--    Sprint 3). This function will still execute with NULL inputs and return
--    NULL via the SQL-standard NULL-propagating semantics.
--
-- Deterministic output: ST_Distance over geography(4326) is geodesic and
-- depends only on the two points, so the pricing engine's determinism
-- guarantee (same ctx → same snapshot) is preserved as long as the supplier's
-- base_location hasn't moved.
-- -----------------------------------------------------------------------------

create or replace function public.supplier_distance_km(
  p_supplier_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns double precision
language sql
security definer
stable
set search_path = public
as $$
  select st_distance(
           s.base_location,
           st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
         ) / 1000.0
    from public.suppliers s
   where s.id = p_supplier_id
     and s.base_location is not null
     and p_lat is not null
     and p_lng is not null;
$$;

revoke all on function public.supplier_distance_km(uuid, double precision, double precision) from public;
grant execute on function public.supplier_distance_km(uuid, double precision, double precision) to service_role;
