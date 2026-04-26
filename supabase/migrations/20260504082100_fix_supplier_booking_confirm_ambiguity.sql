-- =============================================================================
-- 20260504082100 — Fix `booking_id` ambiguity in supplier booking RPCs.
--
-- 20260504082000 declared `RETURNS TABLE (booking_id uuid)`, so the symbol
-- `booking_id` is in scope as an OUT-parameter inside the function body. The
-- UPDATE on `public.availability_blocks` then says
--   `where booking_id = p_booking_id`
-- and Postgres raises:
--   ERROR: column reference "booking_id" is ambiguous
-- because `availability_blocks.booking_id` is also a column.
--
-- The minimum-impact fix is to qualify the column with the table name. We
-- redeclare both functions with `CREATE OR REPLACE` so re-running the prior
-- migration is harmless and the public-grant chain stays intact (CREATE OR
-- REPLACE preserves grants by default).
-- =============================================================================

set search_path = public;

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

  update public.bookings
     set confirmation_status = 'confirmed',
         confirmed_at        = now()
   where id = p_booking_id;

  update public.availability_blocks
     set reason     = 'booked',
         expires_at = null
   where availability_blocks.booking_id = p_booking_id
     and reason     = 'soft_hold'
     and released_at is null;

  return query select p_booking_id;
end;
$$;

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
  v_status              public.booking_confirmation_status;
  v_supplier_id         uuid;
  v_quote_id            uuid;
  v_rfq_id              uuid;
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

  if v_status not in ('awaiting_supplier', 'confirmed') then
    raise exception 'P0203: booking_not_cancellable:%', v_status
      using errcode = 'P0203';
  end if;

  select s.profile_id
    into v_supplier_profile_id
    from public.suppliers s
   where s.id = p_supplier_id;

  update public.bookings
     set confirmation_status     = 'cancelled',
         cancelled_at            = now(),
         cancelled_by            = v_supplier_profile_id,
         cancellation_reason_code = nullif(trim(coalesce(p_reason, '')), '')
   where id = p_booking_id;

  update public.availability_blocks
     set released_at = now()
   where availability_blocks.booking_id = p_booking_id
     and released_at is null;

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
