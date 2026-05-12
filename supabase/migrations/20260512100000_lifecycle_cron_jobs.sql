-- Sevent · migration 20260512100000: lifecycle pg_cron jobs.
-- Sprint "Pilot Closure" Slice 1.
--
-- Two scheduled functions close the booking loop without manual admin work:
--
--   1. expire_soft_holds()    every 5 min  — cancels awaiting_supplier
--                                              bookings whose 48h soft-hold
--                                              has passed, releases the block,
--                                              and reopens the quote.
--   2. auto_mark_completed()  hourly       — flips confirmed bookings whose
--                                              event ended more than 24h ago
--                                              to service_status='completed',
--                                              opening the review window.
--
-- Both functions are SECURITY DEFINER with an explicit search_path. They use
-- direct INSERT into public.notifications rather than going through the TS
-- helper (we're running inside Postgres). Idempotency is enforced via row
-- predicates (released_at IS NULL, confirmation_status='awaiting_supplier',
-- service_status='scheduled') — re-running on identical data produces no
-- additional state changes.
--
-- We DO NOT delete availability_blocks rows; we soft-release via released_at.
-- This diverges from the original pseudocode in Claude Docs/state-machines.md
-- L61-77 (which used DELETE), in favor of preserving audit history and
-- letting the partial unique index on (booking_id) WHERE booking_id IS NOT NULL
-- continue to work cleanly across cancellation cycles.

set search_path = public;

-- =============================================================================
-- expire_soft_holds()
-- =============================================================================

create or replace function public.expire_soft_holds()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_expired_count integer := 0;
  v_block record;
begin
  -- Snapshot the set of soft-holds we are about to release. Doing this in a
  -- CTE inside the UPDATE statement would race with concurrent inserts; the
  -- explicit FOR UPDATE pattern keeps the bookings/quotes flips deterministic.
  for v_block in
    select b.id           as block_id,
           b.booking_id   as booking_id,
           bk.quote_id    as quote_id,
           bk.organizer_id,
           bk.supplier_id,
           sup.profile_id as supplier_profile_id
      from public.availability_blocks b
      left join public.bookings bk on bk.id = b.booking_id
      left join public.suppliers sup on sup.id = bk.supplier_id
     where b.reason = 'soft_hold'
       and b.released_at is null
       and b.expires_at is not null
       and b.expires_at < now()
     for update of b
  loop
    -- 1. Release the block (soft-delete).
    update public.availability_blocks
       set released_at = now()
     where id = v_block.block_id
       and released_at is null;

    -- 2. Cancel the booking if it is still awaiting confirmation. Skip if
    --    the supplier already confirmed (shouldn't happen — the confirm RPC
    --    flips the block to 'booked' in the same transaction — but be safe).
    if v_block.booking_id is not null then
      update public.bookings
         set confirmation_status = 'cancelled',
             cancelled_at = now(),
             cancelled_by = null  -- null = system cancellation
       where id = v_block.booking_id
         and confirmation_status = 'awaiting_supplier';

      -- 3. Return the quote to 'sent' so the organizer can accept a sibling
      --    quote or the supplier can resend without creating a new revision.
      if v_block.quote_id is not null then
        update public.quotes
           set status = 'sent',
               accepted_at = null
         where id = v_block.quote_id
           and status = 'accepted';
      end if;

      -- 4. Notify both parties. Direct INSERT — no JS helper available here.
      if v_block.organizer_id is not null then
        insert into public.notifications (user_id, kind, payload_jsonb)
        values (
          v_block.organizer_id,
          'booking.auto_cancelled_expired_hold',
          jsonb_build_object(
            'booking_id', v_block.booking_id,
            'reason', 'soft_hold_expired'
          )
        );
      end if;

      if v_block.supplier_profile_id is not null then
        insert into public.notifications (user_id, kind, payload_jsonb)
        values (
          v_block.supplier_profile_id,
          'booking.auto_cancelled_expired_hold',
          jsonb_build_object(
            'booking_id', v_block.booking_id,
            'reason', 'soft_hold_expired'
          )
        );
      end if;
    end if;

    v_expired_count := v_expired_count + 1;
  end loop;

  return v_expired_count;
end;
$$;

comment on function public.expire_soft_holds() is
  'Lifecycle cron · every 5 min. Releases expired soft-holds, cancels their '
  'awaiting_supplier bookings, returns the quote to ''sent'', and notifies '
  'both parties. Idempotent.';

-- =============================================================================
-- auto_mark_completed()
-- =============================================================================

create or replace function public.auto_mark_completed()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_completed_count integer := 0;
  v_booking record;
begin
  -- Find confirmed bookings whose event window ended more than 24h ago and
  -- which haven't been manually marked completed/in_progress/disputed yet.
  for v_booking in
    select bk.id           as booking_id,
           bk.organizer_id,
           bk.supplier_id,
           sup.profile_id  as supplier_profile_id
      from public.bookings bk
      join public.rfqs r on r.id = bk.rfq_id
      join public.events e on e.id = r.event_id
      join public.suppliers sup on sup.id = bk.supplier_id
     where bk.confirmation_status = 'confirmed'
       and bk.service_status = 'scheduled'
       and e.ends_at < now() - interval '24 hours'
     for update of bk
  loop
    update public.bookings
       set service_status = 'completed',
           completed_at = now()
     where id = v_booking.booking_id
       and service_status = 'scheduled';

    -- Notify both parties. The 14-day review window starts here, but
    -- reviews.window_closes_at is computed at review-submission time
    -- from bookings.completed_at — we do NOT pre-create review rows.
    if v_booking.organizer_id is not null then
      insert into public.notifications (user_id, kind, payload_jsonb)
      values (
        v_booking.organizer_id,
        'booking.auto_completed',
        jsonb_build_object('booking_id', v_booking.booking_id)
      );
    end if;

    if v_booking.supplier_profile_id is not null then
      insert into public.notifications (user_id, kind, payload_jsonb)
      values (
        v_booking.supplier_profile_id,
        'booking.auto_completed',
        jsonb_build_object('booking_id', v_booking.booking_id)
      );
    end if;

    v_completed_count := v_completed_count + 1;
  end loop;

  return v_completed_count;
end;
$$;

comment on function public.auto_mark_completed() is
  'Lifecycle cron · hourly. Flips confirmed bookings whose event ended more '
  'than 24h ago to service_status=''completed'', opening the review window '
  '(reviews.window_closes_at = completed_at + 14d, computed at submission). '
  'Notifies both parties. Idempotent.';

-- =============================================================================
-- Grants
-- =============================================================================
--
-- pg_cron on this stack runs jobs as the role that called cron.schedule() —
-- here, the postgres superuser running the migration. The functions
-- themselves are SECURITY DEFINER (owned by postgres), so the cron-internal
-- caller has the necessary privileges. Revoke from everyone else to keep
-- PostgREST from exposing these as RPCs.

revoke all on function public.expire_soft_holds() from public;
revoke all on function public.auto_mark_completed() from public;
grant execute on function public.expire_soft_holds() to service_role;
grant execute on function public.auto_mark_completed() to service_role;

-- =============================================================================
-- Schedule the jobs
-- =============================================================================
--
-- cron.schedule() is idempotent on jobname — re-running the migration just
-- updates the schedule/command. We use distinct, descriptive jobnames so
-- a future migration can `cron.unschedule('expire-soft-holds')` if needed.

select cron.schedule(
  'expire-soft-holds',
  '*/5 * * * *',
  $$select public.expire_soft_holds()$$
);

select cron.schedule(
  'auto-mark-completed',
  '0 * * * *',
  $$select public.auto_mark_completed()$$
);
