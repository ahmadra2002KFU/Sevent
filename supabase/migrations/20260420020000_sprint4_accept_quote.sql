-- =============================================================================
-- Sprint 4 — Quote acceptance, soft-hold booking state machine, revision upsert
-- =============================================================================
--
-- Ships the transactional primitives that let an organizer accept a quote and
-- atomically create (booking + soft-hold) while preventing double-book races,
-- and let a supplier append an immutable quote revision without racing itself.
--
-- Lock ordering (MUST be preserved across all future edits — deviating will
-- deadlock two concurrent accepts on the same event with different suppliers):
--
--     events → rfqs → quotes (primary + siblings ORDER BY id FOR UPDATE) → suppliers
--
-- The `suppliers` row is only locked implicitly via the overlap trigger's
-- `SELECT concurrent_event_limit … FOR UPDATE`; that must stay last in the
-- chain so it can't be locked before quotes.
--
-- concurrent_event_limit assumption: v1 pilot treats every supplier as capacity
-- 1 (one active event per time window). The overlap trigger hard-fails the
-- moment any supplier has `concurrent_event_limit != 1`, so a future policy
-- change must rewrite the trigger FIRST. The intentional fail-loud avoids a
-- silent correctness bug.
--
-- Raise codes used (map in the UI layer — do not leak raw message text):
--   P0001  availability_conflict:<block_id>        -- overlap trigger
--   P0002  quote_not_found                         -- accept_quote_tx
--   P0003  quote_already_accepted                  -- accept_quote_tx
--   P0004  quote_not_sendable:<status>             -- accept_quote_tx
--   P0005  quote_missing_revision                  -- accept_quote_tx
--   P0006  organizer_mismatch                      -- accept_quote_tx
--   P0007  supplier_unavailable:<reason>           -- accept_quote_tx (trigger → caught)
--   P0008  concurrent_event_limit_unsupported:<n>  -- overlap trigger guard
--   P0009  accepted_revision_mismatches_quote      -- bookings invariant trigger
--   P0010  rfq_not_bookable:<status>               -- accept_quote_tx (terminal RFQ)
--   P0011  quote_revision_not_editable:<status>    -- upsert_quote_revision_tx (terminal quote)
--   P0012  soft_hold_minutes_invalid:<n>           -- accept_quote_tx (0/negative/too large)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. availability_blocks overlap guard (trigger only — no inline pre-check).
-- -----------------------------------------------------------------------------
--
-- Correctness guarantee: any INSERT or overlap-relevant UPDATE into
-- availability_blocks re-queries the row's neighbours under a FOR UPDATE lock
-- on suppliers, and raises P0001 on any conflict. Expired soft_holds and
-- released rows are ignored. The narrow UPDATE OF clause avoids firing the
-- trigger on unrelated column changes (e.g. `created_by` rewrites).
create or replace function public.availability_blocks_guard_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  conflict_id uuid;
  v_limit int;
begin
  -- v1 assumes concurrent_event_limit=1. Hard-fail the moment someone widens
  -- capacity so a downstream bug can't silently allow a double-booking.
  select s.concurrent_event_limit
    into v_limit
    from public.suppliers s
   where s.id = new.supplier_id
     for update;
  if v_limit is distinct from 1 then
    raise exception 'concurrent_event_limit_unsupported:%', v_limit
      using errcode = 'P0008';
  end if;

  select ab.id
    into conflict_id
    from public.availability_blocks ab
   where ab.supplier_id = new.supplier_id
     and ab.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
     and ab.released_at is null
     and (ab.reason <> 'soft_hold' or ab.expires_at > now())
     and tstzrange(ab.starts_at, ab.ends_at) && tstzrange(new.starts_at, new.ends_at)
   limit 1;

  if conflict_id is not null then
    raise exception using
      errcode = 'P0001',
      message = format('availability_conflict:%s', conflict_id);
  end if;

  return new;
end
$$;

drop trigger if exists availability_blocks_guard_overlap on public.availability_blocks;
create trigger availability_blocks_guard_overlap
  before insert or update of
    supplier_id, starts_at, ends_at, reason, expires_at, released_at
  on public.availability_blocks
  for each row execute function public.availability_blocks_guard_overlap();


-- -----------------------------------------------------------------------------
-- 2. Defence-in-depth idempotency: one active booking per quote.
-- -----------------------------------------------------------------------------
--
-- accept_quote_tx enforces this via the FOR UPDATE lock on quotes, but a future
-- code path that bypasses the RPC would silently create two active bookings
-- referencing the same quote. The partial unique index catches that at DB
-- level.
create unique index if not exists bookings_active_quote_unique
  on public.bookings (quote_id)
  where confirmation_status in ('awaiting_supplier', 'confirmed');


-- -----------------------------------------------------------------------------
-- 3. bookings invariant: accepted_quote_revision_id must belong to quote_id.
-- -----------------------------------------------------------------------------
create or replace function public.bookings_verify_revision_quote()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_quote_id uuid;
begin
  select qr.quote_id
    into v_quote_id
    from public.quote_revisions qr
   where qr.id = new.accepted_quote_revision_id;

  if v_quote_id is null then
    raise exception 'accepted_revision_not_found: %', new.accepted_quote_revision_id
      using errcode = 'P0009';
  end if;

  if v_quote_id is distinct from new.quote_id then
    raise exception 'accepted_revision_mismatches_quote: revision % belongs to quote %, booking.quote_id %',
      new.accepted_quote_revision_id, v_quote_id, new.quote_id
      using errcode = 'P0009';
  end if;

  return new;
end
$$;

drop trigger if exists bookings_verify_revision_quote on public.bookings;
create trigger bookings_verify_revision_quote
  before insert or update of quote_id, accepted_quote_revision_id
  on public.bookings
  for each row execute function public.bookings_verify_revision_quote();


-- -----------------------------------------------------------------------------
-- 4. accept_quote_tx — atomic acceptance + soft-hold.
-- -----------------------------------------------------------------------------
--
-- Security model: SECURITY DEFINER so it runs with owner rights regardless of
-- the caller's RLS; grants are revoked from public and granted only to
-- service_role, so only the server action (which has already verified the
-- organizer's identity via requireRole) can invoke it. The function trusts
-- p_organizer_id as authoritative — never accept it from client input without
-- re-checking the caller in the calling server action.
create or replace function public.accept_quote_tx(
  p_quote_id uuid,
  p_organizer_id uuid,
  p_soft_hold_minutes int default 2880  -- 48h per state-machines.md
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
begin
  -- Fail fast under contention; don't let a stuck session hang the request.
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  -- 0. Validate soft-hold duration. 0/negative creates an already-expired hold
  --    (trigger ignores expired, so a second accept would reserve the same
  --    window). Upper bound keeps runaway clients from holding a slot forever.
  if p_soft_hold_minutes is null or p_soft_hold_minutes <= 0 or p_soft_hold_minutes > 20160 then
    raise exception 'soft_hold_minutes_invalid:%', p_soft_hold_minutes using errcode = 'P0012';
  end if;

  -- 1. Resolve rfq_id + event_id from the quote (no lock yet — just a lookup).
  select q.rfq_id, r.event_id, q.id as quote_id
    into v_rfq
    from public.quotes q
    join public.rfqs r on r.id = q.rfq_id
   where q.id = p_quote_id;
  if not found then
    raise exception 'quote_not_found' using errcode = 'P0002';
  end if;

  -- 2. Lock events FIRST. Two concurrent accepts on the same event serialise
  --    here before either one touches quotes, preventing the
  --    quotes-then-events → events-then-quotes deadlock cycle.
  select e.*
    into v_event
    from public.events e
   where e.id = v_rfq.event_id
     for update;
  if v_event.organizer_id <> p_organizer_id then
    raise exception 'organizer_mismatch' using errcode = 'P0006';
  end if;

  -- 3. Lock the RFQ row + validate its status. A terminal RFQ
  --    ('expired' | 'cancelled' | 'booked') can still have a stale 'sent'
  --    quote pointing at it; accepting would silently overwrite terminal state.
  select r.status
    into v_rfq_status
    from public.rfqs r
   where r.id = v_rfq.rfq_id
     for update;
  if v_rfq_status not in ('sent', 'quoted') then
    raise exception 'rfq_not_bookable:%', v_rfq_status using errcode = 'P0010';
  end if;

  -- 4. Lock the primary quote + every sibling that might be flipped to
  --    rejected, in deterministic UUID order so two concurrent accepts on
  --    different quotes of the same RFQ take locks in the same order.
  perform 1
    from public.quotes
   where rfq_id = v_rfq.rfq_id
     and (id = p_quote_id or status = 'sent')
   order by id
     for update;

  -- 5. Re-read the primary quote under lock.
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

  -- 6. Create the booking FIRST. availability_blocks.booking_id has an FK to
  --    bookings(id) so we need the row to exist before the soft-hold insert.
  insert into public.bookings (
    rfq_id,
    quote_id,
    accepted_quote_revision_id,
    organizer_id,
    supplier_id,
    confirmation_status,
    awaiting_since,
    confirm_deadline
  ) values (
    v_quote.rfq_id,
    v_quote.id,
    v_rev.id,
    p_organizer_id,
    v_quote.supplier_id,
    'awaiting_supplier',
    now(),
    now() + make_interval(mins => p_soft_hold_minutes)
  ) returning id into v_booking_id;

  -- 7. Insert the soft-hold. The overlap trigger acquires the suppliers lock
  --    and enforces the conflict check. Translate its P0001 into a structured
  --    P0007 so the UI layer can render a clean "no longer available" message.
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

  -- 8. Flip statuses. Siblings were already locked in step 4.
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

revoke all on function public.accept_quote_tx(uuid, uuid, int) from public;
grant execute on function public.accept_quote_tx(uuid, uuid, int) to service_role;


-- -----------------------------------------------------------------------------
-- 5. upsert_quote_revision_tx — append-only revision + quote status flip.
-- -----------------------------------------------------------------------------
--
-- FOR UPDATE on the quote row serialises the version race; no retry loop
-- needed. Caller must have already re-computed the snapshot server-side (for
-- rule_engine / mixed sources) and pre-computed the content_hash.
create or replace function public.upsert_quote_revision_tx(
  p_rfq_id uuid,
  p_supplier_id uuid,
  p_author_id uuid,
  p_snapshot jsonb,
  p_content_hash text,
  p_source public.quote_source
)
returns table(quote_id uuid, revision_id uuid, version int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
  v_quote_status public.quote_status;
  v_next_version int;
  v_revision_id uuid;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  -- 1. Ensure a quote row exists for this (rfq, supplier) pair.
  insert into public.quotes (rfq_id, supplier_id, source, status)
       values (p_rfq_id, p_supplier_id, p_source, 'draft')
  on conflict (rfq_id, supplier_id) do update
       set source = excluded.source
    returning id into v_quote_id;

  -- 2. Lock the quote row + read its status so the version computation is
  --    race-free AND terminal quotes cannot be resurrected.
  select q.status
    into v_quote_status
    from public.quotes q
   where q.id = v_quote_id
     for update;
  if v_quote_status not in ('draft', 'sent') then
    raise exception 'quote_revision_not_editable:%', v_quote_status using errcode = 'P0011';
  end if;

  -- 3. Next version is max+1 under the lock — no retry needed.
  select coalesce(max(version), 0) + 1
    into v_next_version
    from public.quote_revisions
   where quote_id = v_quote_id;

  -- 4. Insert the immutable snapshot.
  insert into public.quote_revisions (quote_id, version, author_id, snapshot_jsonb, content_hash)
       values (v_quote_id, v_next_version, p_author_id, p_snapshot, p_content_hash)
    returning id into v_revision_id;

  -- 5. Flip the live quote row to point at the new revision and status=sent.
  update public.quotes
     set current_revision_id = v_revision_id,
         source = p_source,
         status = 'sent',
         sent_at = now()
   where id = v_quote_id;

  return query select v_quote_id, v_revision_id, v_next_version;
end
$$;

revoke all on function public.upsert_quote_revision_tx(uuid, uuid, uuid, jsonb, text, public.quote_source) from public;
grant execute on function public.upsert_quote_revision_tx(uuid, uuid, uuid, jsonb, text, public.quote_source) to service_role;
