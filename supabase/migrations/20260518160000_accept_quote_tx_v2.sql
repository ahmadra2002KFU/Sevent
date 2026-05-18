-- =============================================================================
-- 20260518160000 — accept_quote_tx_v2: company-aware quote acceptance.
--
-- PR 2 of the multi-user company-organizer refactor.
--
-- WHY A NEW NAME, NOT AN OVERLOAD?
--   See the header on 20260518150000_send_rfq_tx_v2.sql — the same overload
--   ambiguity risk applies. v2 ships under a new name; v1 stays until the
--   later drop migration.
--
-- ADDITIVE BEHAVIOR
--   v1 signature: (p_quote_id, p_organizer_id, p_soft_hold_minutes default 2880)
--   v2 signature: + p_company_id uuid + p_actor_profile_id uuid (no defaults
--   — both are required, but callers pass NULL for the individual path).
--   Booking insert stamps the new columns:
--     bookings.company_id       = p_company_id        (NULL for individuals)
--     bookings.actor_profile_id = p_actor_profile_id  (NULL for individuals)
--
--   Soft-hold rows in availability_blocks keep `created_by = p_organizer_id`
--   — that column is the human-identity slot, identical to v1.
--
-- Composite FK `bookings_actor_is_company_member_fk` (in 20260518112000)
-- is the DB-level backstop on the new (company_id, actor_profile_id) pair.
--
-- Errcodes are reused from v1 (P0002 … P0012). No new codes.
-- =============================================================================

set search_path = public;

create or replace function public.accept_quote_tx_v2(
  p_quote_id uuid,
  p_organizer_id uuid,
  p_soft_hold_minutes int,
  p_company_id uuid,
  p_actor_profile_id uuid
)
returns table(booking_id uuid, block_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_rfq record;
  v_quote record;
  v_rev record;
  v_booking_id uuid;
  v_block_id uuid;
  v_rfq_status public.rfq_status;
  v_actor uuid;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  v_actor := coalesce(p_actor_profile_id, p_organizer_id);

  if p_soft_hold_minutes is null or p_soft_hold_minutes <= 0 or p_soft_hold_minutes > 20160 then
    raise exception 'soft_hold_minutes_invalid:%', p_soft_hold_minutes using errcode = 'P0012';
  end if;

  -- 1. Resolve rfq_id + event_id from the quote.
  select q.rfq_id, r.event_id, q.id as quote_id
    into v_rfq
    from public.quotes q
    join public.rfqs r on r.id = q.rfq_id
   where q.id = p_quote_id;
  if not found then
    raise exception 'quote_not_found' using errcode = 'P0002';
  end if;

  -- 2. Lock the event.
  select e.*
    into v_event
    from public.events e
   where e.id = v_rfq.event_id
     for update;

  -- 3. Ownership check, two-branch predicate.
  --    Individual: p_company_id IS NULL → events.organizer_id must match.
  --    Company:   p_company_id IS NOT NULL → events.company_id must match
  --               AND the actor must be a current member.
  if not (
    (p_company_id is null and v_event.organizer_id = p_organizer_id)
    or (
      p_company_id is not null
      and v_event.company_id = p_company_id
      and exists (
        select 1
          from public.organizer_memberships m
         where m.company_id = p_company_id
           and m.profile_id = v_actor
           and m.removed_at is null
      )
    )
  ) then
    raise exception 'organizer_mismatch' using errcode = 'P0006';
  end if;

  -- 4. Lock the RFQ and validate status.
  select r.status
    into v_rfq_status
    from public.rfqs r
   where r.id = v_rfq.rfq_id
     for update;
  if v_rfq_status not in ('sent', 'quoted') then
    raise exception 'rfq_not_bookable:%', v_rfq_status using errcode = 'P0010';
  end if;

  -- 5. Lock primary quote + siblings in deterministic order.
  perform 1
    from public.quotes
   where rfq_id = v_rfq.rfq_id
     and (id = p_quote_id or status = 'sent')
   order by id
     for update;

  -- 6. Re-read primary quote under lock.
  select q.*
    into v_quote
    from public.quotes q
   where q.id = p_quote_id;
  if v_quote.status = 'accepted' then
    raise exception 'quote_already_accepted' using errcode = 'P0003';
  end if;
  if v_quote.status <> 'sent' then
    raise exception 'quote_not_sendable:%', v_quote.status using errcode = 'P0004';
  end if;
  if v_quote.current_revision_id is null then
    raise exception 'quote_missing_revision' using errcode = 'P0005';
  end if;

  select *
    into v_rev
    from public.quote_revisions
   where id = v_quote.current_revision_id;

  -- 7. Create booking. Stamps the new company_id + actor_profile_id columns
  --    (NULL for individual flows — identical observable shape to v1).
  insert into public.bookings (
    rfq_id,
    quote_id,
    accepted_quote_revision_id,
    organizer_id,
    supplier_id,
    confirmation_status,
    awaiting_since,
    confirm_deadline,
    company_id,
    actor_profile_id
  ) values (
    v_quote.rfq_id,
    v_quote.id,
    v_rev.id,
    p_organizer_id,
    v_quote.supplier_id,
    'awaiting_supplier',
    now(),
    now() + make_interval(mins => p_soft_hold_minutes),
    p_company_id,
    p_actor_profile_id
  ) returning id into v_booking_id;

  -- 8. Soft-hold insert. created_by stays the organizer identity (v1 shape).
  begin
    insert into public.availability_blocks (
      supplier_id,
      starts_at,
      ends_at,
      reason,
      booking_id,
      quote_revision_id,
      expires_at,
      created_by
    ) values (
      v_quote.supplier_id,
      v_event.starts_at,
      v_event.ends_at,
      'soft_hold',
      v_booking_id,
      v_rev.id,
      now() + make_interval(mins => p_soft_hold_minutes),
      p_organizer_id
    ) returning id into v_block_id;
  exception
    when sqlstate 'P0001' then
      raise exception 'supplier_unavailable:%', sqlerrm using errcode = 'P0007';
  end;

  -- 9. Flip statuses.
  update public.quotes
     set status = 'accepted', accepted_at = now()
   where id = p_quote_id;

  update public.rfqs
     set status = 'booked'
   where id = v_quote.rfq_id;

  update public.quotes
     set status = 'rejected', rejected_at = now()
   where rfq_id = v_quote.rfq_id
     and id <> p_quote_id
     and status = 'sent';

  return query select v_booking_id, v_block_id;
end
$$;

revoke all on function public.accept_quote_tx_v2(uuid, uuid, int, uuid, uuid) from public;
grant execute on function public.accept_quote_tx_v2(uuid, uuid, int, uuid, uuid) to service_role;

notify pgrst, 'reload schema';
