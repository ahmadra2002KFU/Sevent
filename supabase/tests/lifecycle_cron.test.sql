-- Sevent · lifecycle cron test (Sprint "Pilot Closure" · Slice 1).
--
-- Exercises the two pg_cron lifecycle functions added in migration
-- 20260512100000_lifecycle_cron_jobs.sql:
--
--   * expire_soft_holds()   — cancels awaiting_supplier bookings whose
--                              soft-hold has passed, releases the block,
--                              returns quote to 'sent', notifies both parties.
--   * auto_mark_completed() — flips confirmed scheduled bookings whose
--                              event ended >24h ago to 'completed'.
--
-- Both functions are asserted to be idempotent (a second call on the same
-- data produces no further state changes).
--
-- Assumes `pnpm seed` has been run: at least one organizer profile and one
-- approved supplier exist. Fixtures are inserted on top of seed data and the
-- whole script runs inside a single transaction that is rolled back at end.
--
-- How to run (local, Supabase CLI):
--   psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/lifecycle_cron.test.sql

\set ON_ERROR_STOP on

begin;

do $$
declare
  v_organizer uuid;
  v_supplier uuid;
  v_supplier_profile uuid;
  v_event_id uuid;
  v_rfq_id uuid;
  v_quote_id uuid;
  v_revision_id uuid;
  v_quote_id_b uuid;
  v_revision_id_b uuid;
  v_rfq_id_b uuid;
  v_event_id_b uuid;
  v_booking_expired uuid;
  v_booking_to_complete uuid;
  v_block_id uuid;
  v_category_id uuid;
  v_subcategory_id uuid;
  v_count int;
  v_expired int;
  v_completed int;
begin
  -- Locate seed fixtures.
  select id into v_organizer
    from public.profiles
   where role = 'organizer'
   order by created_at asc
   limit 1;
  if v_organizer is null then
    raise exception 'no seeded organizer profile — run pnpm seed first';
  end if;

  select s.id, s.profile_id into v_supplier, v_supplier_profile
    from public.suppliers s
   where s.verification_status = 'approved'
   order by s.created_at asc
   limit 1;
  if v_supplier is null then
    raise exception 'no seeded approved supplier — run pnpm seed first';
  end if;

  -- Any 2-level category pair.
  select id into v_subcategory_id
    from public.categories
   where parent_id is not null
   order by sort_order, slug
   limit 1;
  select parent_id into v_category_id
    from public.categories
   where id = v_subcategory_id;
  if v_subcategory_id is null then
    raise exception 'no seeded subcategory — run pnpm seed first';
  end if;

  -- Build an event whose window ended ~25h ago. Use a tiny window so the
  -- soft-hold overlap trigger has nothing else to conflict with.
  insert into public.events (organizer_id, event_type, city, starts_at, ends_at)
  values (v_organizer, 'business_events', 'riyadh',
          now() - interval '26 hours', now() - interval '25 hours')
  returning id into v_event_id;

  -- RFQ + quote + revision pointing at the supplier.
  insert into public.rfqs (event_id, category_id, subcategory_id, status, sent_at)
  values (v_event_id, v_category_id, v_subcategory_id, 'booked', now() - interval '30 hours')
  returning id into v_rfq_id;

  insert into public.quotes (rfq_id, supplier_id, status, sent_at, accepted_at)
  values (v_rfq_id, v_supplier, 'accepted', now() - interval '30 hours', now() - interval '50 hours')
  returning id into v_quote_id;

  insert into public.quote_revisions (quote_id, version, author_id, snapshot_jsonb, content_hash)
  values (v_quote_id, 1, v_supplier_profile,
          '{"engine_version":"1.0.0","currency":"SAR","total_halalas":100000}'::jsonb,
          'test-hash-' || replace(v_quote_id::text, '-', ''))
  returning id into v_revision_id;

  update public.quotes set current_revision_id = v_revision_id where id = v_quote_id;

  -- =========================================================================
  -- Booking A: awaiting_supplier with EXPIRED soft-hold (target of
  --            expire_soft_holds()).
  -- =========================================================================
  insert into public.bookings (
    rfq_id, quote_id, accepted_quote_revision_id, organizer_id, supplier_id,
    confirmation_status, awaiting_since, confirm_deadline
  ) values (
    v_rfq_id, v_quote_id, v_revision_id, v_organizer, v_supplier,
    'awaiting_supplier', now() - interval '50 hours', now() - interval '2 hours'
  ) returning id into v_booking_expired;

  -- Insert soft-hold with future expiry first (so the overlap trigger is
  -- happy), then flip expires_at into the past.
  insert into public.availability_blocks (
    supplier_id, starts_at, ends_at, reason, booking_id, quote_revision_id,
    expires_at, created_by
  ) values (
    v_supplier,
    now() - interval '26 hours', now() - interval '25 hours',
    'soft_hold', v_booking_expired, v_revision_id,
    now() + interval '1 hour', v_organizer
  ) returning id into v_block_id;

  update public.availability_blocks
     set expires_at = now() - interval '2 hours'
   where id = v_block_id;

  -- =========================================================================
  -- Booking B: confirmed + scheduled with event.ends_at 25h ago (target of
  --            auto_mark_completed()). Needs a SEPARATE quote because the
  --            partial unique index bookings_active_quote_unique disallows
  --            two active bookings on the same quote.
  -- =========================================================================
  insert into public.events (organizer_id, event_type, city, starts_at, ends_at)
  values (v_organizer, 'business_events', 'riyadh',
          now() - interval '26 hours', now() - interval '25 hours')
  returning id into v_event_id_b;

  insert into public.rfqs (event_id, category_id, subcategory_id, status, sent_at)
  values (v_event_id_b, v_category_id, v_subcategory_id, 'booked', now() - interval '30 hours')
  returning id into v_rfq_id_b;

  insert into public.quotes (rfq_id, supplier_id, status, sent_at, accepted_at)
  values (v_rfq_id_b, v_supplier, 'accepted', now() - interval '30 hours', now() - interval '50 hours')
  returning id into v_quote_id_b;

  insert into public.quote_revisions (quote_id, version, author_id, snapshot_jsonb, content_hash)
  values (v_quote_id_b, 1, v_supplier_profile,
          '{"engine_version":"1.0.0","currency":"SAR","total_halalas":100000}'::jsonb,
          'test-hash-b-' || replace(v_quote_id_b::text, '-', ''))
  returning id into v_revision_id_b;

  update public.quotes set current_revision_id = v_revision_id_b where id = v_quote_id_b;

  insert into public.bookings (
    rfq_id, quote_id, accepted_quote_revision_id, organizer_id, supplier_id,
    confirmation_status, service_status, awaiting_since, confirm_deadline, confirmed_at
  ) values (
    v_rfq_id_b, v_quote_id_b, v_revision_id_b, v_organizer, v_supplier,
    'confirmed', 'scheduled',
    now() - interval '40 hours', now() - interval '38 hours', now() - interval '38 hours'
  ) returning id into v_booking_to_complete;

  -- =========================================================================
  -- TEST 1 · expire_soft_holds() flips Booking A.
  -- =========================================================================
  select public.expire_soft_holds() into v_expired;
  if v_expired <> 1 then
    raise exception 'TEST 1 FAIL: expected 1 expired hold, got %', v_expired;
  end if;

  perform 1 from public.availability_blocks
    where id = v_block_id and released_at is not null;
  if not found then
    raise exception 'TEST 1 FAIL: block % was not released', v_block_id;
  end if;

  perform 1 from public.bookings
    where id = v_booking_expired
      and confirmation_status = 'cancelled'
      and cancelled_by is null
      and cancelled_at is not null;
  if not found then
    raise exception 'TEST 1 FAIL: booking % was not system-cancelled', v_booking_expired;
  end if;

  perform 1 from public.quotes where id = v_quote_id and status = 'sent';
  if not found then
    raise exception 'TEST 1 FAIL: quote % was not returned to sent', v_quote_id;
  end if;

  select count(*) into v_count from public.notifications
   where kind = 'booking.auto_cancelled_expired_hold'
     and (payload_jsonb->>'booking_id')::uuid = v_booking_expired;
  if v_count <> 2 then
    raise exception 'TEST 1 FAIL: expected 2 expiry notifications, got %', v_count;
  end if;

  -- =========================================================================
  -- TEST 2 · expire_soft_holds() is idempotent on already-expired data.
  -- =========================================================================
  select public.expire_soft_holds() into v_expired;
  if v_expired <> 0 then
    raise exception 'TEST 2 FAIL: second expire run not idempotent: %', v_expired;
  end if;

  select count(*) into v_count from public.notifications
   where kind = 'booking.auto_cancelled_expired_hold'
     and (payload_jsonb->>'booking_id')::uuid = v_booking_expired;
  if v_count <> 2 then
    raise exception 'TEST 2 FAIL: idempotent run added notifications (now %)', v_count;
  end if;

  -- =========================================================================
  -- TEST 3 · auto_mark_completed() flips Booking B.
  -- =========================================================================
  select public.auto_mark_completed() into v_completed;
  if v_completed <> 1 then
    raise exception 'TEST 3 FAIL: expected 1 auto-completed, got %', v_completed;
  end if;

  perform 1 from public.bookings
    where id = v_booking_to_complete
      and service_status = 'completed'
      and completed_at is not null;
  if not found then
    raise exception 'TEST 3 FAIL: booking % was not auto-completed', v_booking_to_complete;
  end if;

  select count(*) into v_count from public.notifications
   where kind = 'booking.auto_completed'
     and (payload_jsonb->>'booking_id')::uuid = v_booking_to_complete;
  if v_count <> 2 then
    raise exception 'TEST 3 FAIL: expected 2 auto-complete notifications, got %', v_count;
  end if;

  -- =========================================================================
  -- TEST 4 · auto_mark_completed() is idempotent.
  -- =========================================================================
  select public.auto_mark_completed() into v_completed;
  if v_completed <> 0 then
    raise exception 'TEST 4 FAIL: second auto-complete run not idempotent: %', v_completed;
  end if;

  raise notice 'lifecycle cron test: OK (expired=1, auto-completed=1, both idempotent)';
end
$$;

rollback;
