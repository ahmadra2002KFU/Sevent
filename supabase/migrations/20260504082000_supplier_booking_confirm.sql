-- =============================================================================
-- 20260504082000 — Supplier booking confirm / decline.
--
-- After an organizer accepts a quote (`accept_quote_tx`) the booking lands in
-- `confirmation_status = 'awaiting_supplier'` with a 48-hour soft-hold on the
-- supplier's calendar. The supplier currently has no way to confirm or
-- decline — the booking detail page renders a "Sprint 5" placeholder instead
-- of action buttons, so either the soft-hold expires (locking the supplier
-- out of any other accept on that window) or the organizer chases the
-- supplier off-platform.
--
-- This migration adds two atomic RPCs the supplier-side server actions wrap:
--
--   * `confirm_booking_tx(p_booking_id, p_supplier_id)` — supplier accepts
--     the booking. Booking flips to `confirmed`. The soft-hold on the
--     supplier's calendar is converted to a firm `booked` block (reason flips,
--     expires_at cleared). RFQ stays `booked`. Quote stays `accepted`.
--
--   * `cancel_booking_supplier_tx(p_booking_id, p_supplier_id, p_reason)` —
--     supplier declines. Booking flips to `cancelled`. The soft-hold is
--     released (released_at = now). The accepted quote flips back to
--     `rejected` (so it isn't held forever as the chosen one), and the RFQ
--     goes back to `sent` so the organizer can pick a different quote.
--     Sibling quotes that `accept_quote_tx` auto-rejected stay rejected —
--     the organizer can re-send a fresh RFQ if they want a wider net; we do
--     NOT silently un-reject them here because that would change another
--     supplier's quote out from under them without notice.
--
-- Error codes (P02xx slot — booking lifecycle, distinct from accept_quote_tx
-- which uses P000x):
--   P0201 — booking not found
--   P0202 — booking does not belong to this supplier
--   P0203 — booking is no longer in awaiting_supplier state
--   P0204 — confirm deadline has passed
-- =============================================================================

set search_path = public;

-- 1. Optional cancellation reason ---------------------------------------------
-- Most cancellations carry a reason code or short note; the column is
-- nullable so callers can omit it.
alter table public.bookings
  add column if not exists cancellation_reason_code text;

-- 2. confirm_booking_tx -------------------------------------------------------

create or replace function public.confirm_booking_tx(
  p_booking_id uuid,
  p_supplier_id uuid
)
returns table (booking_id uuid)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_status      public.booking_confirmation_status;
  v_supplier_id uuid;
  v_deadline    timestamptz;
begin
  -- Lock the booking row to serialise concurrent supplier confirm/cancel
  -- AND any organizer-side write. SELECT FOR UPDATE on a single PK is cheap.
  select b.confirmation_status, b.supplier_id, b.confirm_deadline
    into v_status, v_supplier_id, v_deadline
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if not found then
    raise exception 'P0201: booking_not_found' using errcode = 'P0201';
  end if;

  if v_supplier_id is distinct from p_supplier_id then
    raise exception 'P0202: supplier_mismatch' using errcode = 'P0202';
  end if;

  if v_status <> 'awaiting_supplier' then
    raise exception 'P0203: booking_not_awaiting:%', v_status
      using errcode = 'P0203';
  end if;

  if v_deadline is not null and v_deadline < now() then
    raise exception 'P0204: confirm_deadline_passed' using errcode = 'P0204';
  end if;

  -- Flip booking → confirmed.
  update public.bookings
     set confirmation_status = 'confirmed',
         confirmed_at        = now()
   where id = p_booking_id;

  -- Promote the soft-hold to a firm booked block. The block's window is
  -- already set (it was created in `accept_quote_tx`); we only flip the
  -- reason and clear `expires_at` so the row stays active indefinitely.
  update public.availability_blocks
     set reason     = 'booked',
         expires_at = null
   where booking_id = p_booking_id
     and reason     = 'soft_hold'
     and released_at is null;

  return query select p_booking_id;
end;
$$;

revoke all on function public.confirm_booking_tx(uuid, uuid) from public;
grant execute on function public.confirm_booking_tx(uuid, uuid) to authenticated;

-- 3. cancel_booking_supplier_tx ----------------------------------------------

create or replace function public.cancel_booking_supplier_tx(
  p_booking_id uuid,
  p_supplier_id uuid,
  p_reason text default null
)
returns table (booking_id uuid)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_status      public.booking_confirmation_status;
  v_supplier_id uuid;
  v_quote_id    uuid;
  v_rfq_id      uuid;
  v_supplier_profile_id uuid;
begin
  select b.confirmation_status, b.supplier_id, b.quote_id, b.rfq_id
    into v_status, v_supplier_id, v_quote_id, v_rfq_id
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if not found then
    raise exception 'P0201: booking_not_found' using errcode = 'P0201';
  end if;

  if v_supplier_id is distinct from p_supplier_id then
    raise exception 'P0202: supplier_mismatch' using errcode = 'P0202';
  end if;

  -- We allow cancellation from either `awaiting_supplier` (the normal path)
  -- or `confirmed` (a supplier who confirmed and then must back out before
  -- the event date). The state machine handles both — confirmation_status
  -- is the single source of truth.
  if v_status not in ('awaiting_supplier', 'confirmed') then
    raise exception 'P0203: booking_not_cancellable:%', v_status
      using errcode = 'P0203';
  end if;

  -- Resolve the supplier's profile_id so we can stamp `cancelled_by`.
  -- `bookings.cancelled_by` references `profiles.id`, not `suppliers.id`.
  select s.profile_id
    into v_supplier_profile_id
    from public.suppliers s
   where s.id = p_supplier_id;

  -- Flip booking → cancelled.
  update public.bookings
     set confirmation_status     = 'cancelled',
         cancelled_at            = now(),
         cancelled_by            = v_supplier_profile_id,
         cancellation_reason_code = nullif(trim(coalesce(p_reason, '')), '')
   where id = p_booking_id;

  -- Release the calendar block so the supplier is bookable again on this
  -- window. We do NOT delete — the row stays for audit.
  update public.availability_blocks
     set released_at = now()
   where booking_id = p_booking_id
     and released_at is null;

  -- Flip the quote back to rejected and the RFQ back to sent so the
  -- organizer can pick a different supplier without re-creating the RFQ.
  update public.quotes
     set status      = 'rejected',
         rejected_at = now()
   where id = v_quote_id
     and status = 'accepted';

  update public.rfqs
     set status = 'sent'
   where id = v_rfq_id
     and status = 'booked';

  return query select p_booking_id;
end;
$$;

revoke all on function public.cancel_booking_supplier_tx(uuid, uuid, text) from public;
grant execute on function public.cancel_booking_supplier_tx(uuid, uuid, text) to authenticated;
