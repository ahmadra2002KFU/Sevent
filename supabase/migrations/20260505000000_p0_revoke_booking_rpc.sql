-- P0-1: Close auth-bypass on supplier booking RPCs.
--
-- confirm_booking_tx and cancel_booking_supplier_tx are SECURITY DEFINER
-- with a tautological ownership check (compares the booking's stored
-- supplier_id to the caller-supplied p_supplier_id). With EXECUTE granted
-- to authenticated/anon, any authenticated user can call them via PostgREST
-- and confirm/cancel any booking by guessing UUIDs.
--
-- The Server Action in src/app/(supplier)/supplier/bookings/[id]/actions.ts
-- already validates ownership through requireAccess("supplier.bookings"),
-- which resolves the supplier_id from the auth cookie server-side. That
-- Server Action uses the service-role admin client to call the RPC, so
-- limiting EXECUTE to service_role keeps the legitimate path working while
-- removing the PostgREST attack surface entirely.

revoke execute on function public.confirm_booking_tx(p_booking_id uuid, p_supplier_id uuid)
  from public, anon, authenticated;

revoke execute on function public.cancel_booking_supplier_tx(p_booking_id uuid, p_supplier_id uuid, p_reason text)
  from public, anon, authenticated;

grant execute on function public.confirm_booking_tx(p_booking_id uuid, p_supplier_id uuid)
  to service_role;

grant execute on function public.cancel_booking_supplier_tx(p_booking_id uuid, p_supplier_id uuid, p_reason text)
  to service_role;
