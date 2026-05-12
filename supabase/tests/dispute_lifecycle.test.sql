-- Sevent · dispute lifecycle test (Sprint "Pilot Closure" · Slice 4 stream A).
--
-- Exercises:
--
--   * disputes_open_set_state trigger        — booking → 'disputed',
--                                              reviews.published_at cleared,
--                                              suppressed_for_dispute = true.
--   * disputes_resolve_restore_state trigger — booking → 'completed' (only
--                                              when no sibling dispute is
--                                              still active);
--                                              suppressed_for_dispute = false.
--   * close_stale_disputes() function        — auto-closes 30d+ disputes,
--                                              fires resolve trigger.
--   * Concurrent disputes                    — siblings still active block
--                                              state restoration.
--   * Idempotency                            — every function/trigger is
--                                              safe to re-run.
--
-- Assumes `pnpm seed` has been run. Fixtures are inserted on top of seed
-- data inside a single transaction that is rolled back at the end.
--
-- How to run (local, Supabase CLI):
--   psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/dispute_lifecycle.test.sql

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
  v_booking_id uuid;
  v_review_a uuid;
  v_review_b uuid;
  v_dispute_a uuid;
  v_dispute_b uuid;
  v_dispute_stale uuid;
  v_category_id uuid;
  v_subcategory_id uuid;
  v_count int;
  v_closed int;
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

  select id into v_subcategory_id
    from public.categories
   where parent_id is not null
   order by sort_order, slug
   limit 1;
  select parent_id into v_category_id
    from public.categories
   where id = v_subcategory_id;

  -- Event + RFQ + quote + revision (event already past so we can mark
  -- completed without time travel).
  insert into public.events (organizer_id, event_type, city, starts_at, ends_at)
  values (v_organizer, 'business_events', 'riyadh',
          now() - interval '10 days', now() - interval '10 days' + interval '4 hours')
  returning id into v_event_id;

  insert into public.rfqs (event_id, category_id, subcategory_id, status, sent_at)
  values (v_event_id, v_category_id, v_subcategory_id, 'booked', now() - interval '15 days')
  returning id into v_rfq_id;

  insert into public.quotes (rfq_id, supplier_id, status, sent_at, accepted_at)
  values (v_rfq_id, v_supplier, 'accepted', now() - interval '14 days', now() - interval '13 days')
  returning id into v_quote_id;

  insert into public.quote_revisions (quote_id, version, author_id, snapshot_jsonb, content_hash)
  values (v_quote_id, 1, v_supplier_profile,
          '{"engine_version":"1.0.0","currency":"SAR","total_halalas":100000}'::jsonb,
          'test-hash-' || replace(v_quote_id::text, '-', ''))
  returning id into v_revision_id;

  update public.quotes set current_revision_id = v_revision_id where id = v_quote_id;

  -- Confirmed + completed booking.
  insert into public.bookings (
    rfq_id, quote_id, accepted_quote_revision_id, organizer_id, supplier_id,
    confirmation_status, service_status, awaiting_since, confirm_deadline,
    confirmed_at, completed_at
  ) values (
    v_rfq_id, v_quote_id, v_revision_id, v_organizer, v_supplier,
    'confirmed', 'completed',
    now() - interval '13 days', now() - interval '12 days',
    now() - interval '12 days', now() - interval '9 days'
  ) returning id into v_booking_id;

  -- Two published reviews (one each side).
  insert into public.reviews (
    booking_id, reviewer_id, reviewee_id, ratings_jsonb, text,
    submitted_at, window_closes_at, published_at, suppressed_for_dispute
  ) values (
    v_booking_id, v_organizer, v_supplier_profile,
    '{"overall":5,"value":5,"punctuality":5,"professionalism":5}'::jsonb,
    'great service', now() - interval '8 days',
    now() - interval '9 days' + interval '14 days',
    now() - interval '5 days', false
  ) returning id into v_review_a;

  insert into public.reviews (
    booking_id, reviewer_id, reviewee_id, ratings_jsonb, text,
    submitted_at, window_closes_at, published_at, suppressed_for_dispute
  ) values (
    v_booking_id, v_supplier_profile, v_organizer,
    '{"overall":4,"value":4,"punctuality":5,"professionalism":4}'::jsonb,
    'good client', now() - interval '7 days',
    now() - interval '9 days' + interval '14 days',
    now() - interval '5 days', false
  ) returning id into v_review_b;

  -- =========================================================================
  -- TEST 1 · Opening a dispute flips state and suppresses reviews.
  -- =========================================================================
  insert into public.disputes (booking_id, raised_by, reason_code, description)
  values (v_booking_id, v_organizer, 'service_not_as_described', 'food was cold')
  returning id into v_dispute_a;

  perform 1 from public.bookings where id = v_booking_id and service_status = 'disputed';
  if not found then
    raise exception 'TEST 1 FAIL: booking did not flip to disputed';
  end if;

  select count(*) into v_count from public.reviews
   where booking_id = v_booking_id
     and published_at is null
     and suppressed_for_dispute = true;
  if v_count <> 2 then
    raise exception 'TEST 1 FAIL: expected 2 suppressed reviews, got %', v_count;
  end if;

  -- =========================================================================
  -- TEST 2 · Resolving the only active dispute restores state.
  -- =========================================================================
  update public.disputes
     set status = 'resolved',
         resolved_at = now(),
         resolved_by = v_organizer,
         resolution_jsonb = '{"outcome":"partial_refund"}'::jsonb
   where id = v_dispute_a;

  perform 1 from public.bookings where id = v_booking_id and service_status = 'completed';
  if not found then
    raise exception 'TEST 2 FAIL: booking did not return to completed';
  end if;

  select count(*) into v_count from public.reviews
   where booking_id = v_booking_id
     and suppressed_for_dispute = false;
  if v_count <> 2 then
    raise exception 'TEST 2 FAIL: expected 2 unsuppressed reviews, got %', v_count;
  end if;

  -- published_at stays null — the cron will republish.
  select count(*) into v_count from public.reviews
   where booking_id = v_booking_id
     and published_at is null;
  if v_count <> 2 then
    raise exception 'TEST 2 FAIL: published_at should remain null until cron runs (got % published)', 2 - v_count;
  end if;

  -- =========================================================================
  -- TEST 3 · Concurrent disputes: still-active sibling blocks restoration.
  -- =========================================================================
  insert into public.disputes (booking_id, raised_by, reason_code, description)
  values (v_booking_id, v_organizer, 'service_not_as_described', 'sibling A')
  returning id into v_dispute_a;

  insert into public.disputes (booking_id, raised_by, reason_code, description)
  values (v_booking_id, v_supplier_profile, 'late_payment', 'sibling B')
  returning id into v_dispute_b;

  -- Booking should be back to disputed.
  perform 1 from public.bookings where id = v_booking_id and service_status = 'disputed';
  if not found then
    raise exception 'TEST 3 FAIL: booking did not flip back to disputed for sibling open';
  end if;

  -- Resolve only A.
  update public.disputes
     set status = 'resolved',
         resolved_at = now(),
         resolved_by = v_organizer,
         resolution_jsonb = '{"outcome":"no_action"}'::jsonb
   where id = v_dispute_a;

  -- B still active → booking must STAY disputed.
  perform 1 from public.bookings where id = v_booking_id and service_status = 'disputed';
  if not found then
    raise exception 'TEST 3 FAIL: booking restored while sibling dispute still active';
  end if;

  -- Now resolve B.
  update public.disputes
     set status = 'closed',
         resolved_at = now(),
         resolved_by = v_organizer,
         resolution_jsonb = '{"outcome":"no_action"}'::jsonb
   where id = v_dispute_b;

  perform 1 from public.bookings where id = v_booking_id and service_status = 'completed';
  if not found then
    raise exception 'TEST 3 FAIL: booking did not restore after last active dispute resolved';
  end if;

  -- =========================================================================
  -- TEST 4 · close_stale_disputes() auto-closes 30d+ disputes.
  -- =========================================================================
  insert into public.disputes (booking_id, raised_by, reason_code, description, opened_at)
  values (v_booking_id, v_organizer, 'service_not_as_described', 'stale case', now() - interval '31 days')
  returning id into v_dispute_stale;

  -- Booking should be disputed again (open trigger fired on insert).
  perform 1 from public.bookings where id = v_booking_id and service_status = 'disputed';
  if not found then
    raise exception 'TEST 4 FAIL: stale dispute did not flip booking to disputed';
  end if;

  select public.close_stale_disputes() into v_closed;
  if v_closed <> 1 then
    raise exception 'TEST 4 FAIL: expected 1 stale dispute closed, got %', v_closed;
  end if;

  perform 1 from public.disputes
   where id = v_dispute_stale
     and status = 'closed'
     and (resolution_jsonb->>'auto_closed')::boolean = true
     and resolution_jsonb->>'reason' = 'stale_window';
  if not found then
    raise exception 'TEST 4 FAIL: stale dispute was not auto-closed with correct resolution_jsonb';
  end if;

  -- Resolve trigger should have restored the booking.
  perform 1 from public.bookings where id = v_booking_id and service_status = 'completed';
  if not found then
    raise exception 'TEST 4 FAIL: booking not restored after auto-close';
  end if;

  -- Two notification rows for the auto-close.
  select count(*) into v_count from public.notifications
   where kind = 'dispute.auto_closed'
     and (payload_jsonb->>'dispute_id')::uuid = v_dispute_stale;
  if v_count <> 2 then
    raise exception 'TEST 4 FAIL: expected 2 auto_closed notifications, got %', v_count;
  end if;

  -- =========================================================================
  -- TEST 5 · Idempotency of close_stale_disputes.
  -- =========================================================================
  select public.close_stale_disputes() into v_closed;
  if v_closed <> 0 then
    raise exception 'TEST 5 FAIL: second close_stale_disputes not idempotent: %', v_closed;
  end if;

  raise notice 'dispute lifecycle test: OK (open/resolve, concurrent, stale auto-close, idempotent)';
end
$$;

rollback;
