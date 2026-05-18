-- =============================================================================
-- 20260519110000 — Organizer companies: PR 6 cron fan-out.
--
-- Three booking-anchored lifecycle cron jobs currently insert one
-- notification row keyed on `bookings.organizer_id`. For company-organizer
-- bookings (company_id IS NOT NULL) this means ONLY the actor who clicked
-- through gets the cancel / auto-complete / dispute-closed nudge, and
-- every other current member is silently in the dark.
--
-- This migration:
--
--   1. Adds a helper `public.notify_organizer_party(company_id, organizer_id,
--      kind, payload)` that fans out per-current-member when company_id is
--      non-null, falls back to the individual `organizer_id` otherwise.
--   2. Rewrites the three cron-driven functions to call the helper instead
--      of the inline `insert into notifications`:
--         * expire_soft_holds()       (20260512100000)
--         * auto_mark_completed()     (same file)
--         * close_stale_disputes()    (20260512150000)
--
-- The message-reminder cron (enqueue_message_reminders) is intentionally
-- NOT changed — messaging threads are per-user (app_feedback.user_id) and
-- have no company concept, so fan-out doesn't apply.
--
-- Idempotency stays guaranteed because every cron row already short-
-- circuits on a booking-state predicate; the helper only runs after the
-- state change.
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. notify_organizer_party
--
--    Fans out a notification row to every current member of `p_company_id`
--    (removed_at IS NULL). When `p_company_id IS NULL`, falls back to a
--    single row addressed to `p_organizer_id` — the legacy individual
--    organizer path. The function is intentionally permissive about
--    `p_organizer_id IS NULL` (skips the insert) so callers can pass
--    whatever the booking row carries without a precondition check.
-- ---------------------------------------------------------------------------

create or replace function public.notify_organizer_party(
  p_company_id uuid,
  p_organizer_id uuid,
  p_kind text,
  p_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count integer := 0;
  v_member uuid;
begin
  if p_company_id is null then
    if p_organizer_id is null then
      return 0;
    end if;
    insert into public.notifications (user_id, kind, payload_jsonb)
    values (p_organizer_id, p_kind, coalesce(p_payload, '{}'::jsonb));
    return 1;
  end if;

  for v_member in
    select profile_id
      from public.organizer_memberships
     where company_id = p_company_id
       and removed_at is null
  loop
    insert into public.notifications (user_id, kind, payload_jsonb)
    values (v_member, p_kind, coalesce(p_payload, '{}'::jsonb));
    v_count := v_count + 1;
  end loop;

  return v_count;
end
$$;

revoke all on function public.notify_organizer_party(uuid, uuid, text, jsonb) from public;
grant execute on function public.notify_organizer_party(uuid, uuid, text, jsonb) to service_role;

comment on function public.notify_organizer_party(uuid, uuid, text, jsonb) is
  'Fan-out helper for lifecycle crons. Writes one notification row per '
  'current member of p_company_id (or to p_organizer_id when p_company_id '
  'IS NULL). Returns the number of rows written.';

-- ---------------------------------------------------------------------------
-- 2. expire_soft_holds — replace inline insert with fan-out.
-- ---------------------------------------------------------------------------

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
  for v_block in
    select b.id           as block_id,
           b.booking_id   as booking_id,
           bk.quote_id    as quote_id,
           bk.organizer_id,
           bk.company_id  as company_id,
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
    update public.availability_blocks
       set released_at = now()
     where id = v_block.block_id
       and released_at is null;

    if v_block.booking_id is not null then
      update public.bookings
         set confirmation_status = 'cancelled',
             cancelled_at = now(),
             cancelled_by = null
       where id = v_block.booking_id
         and confirmation_status = 'awaiting_supplier';

      if v_block.quote_id is not null then
        update public.quotes
           set status = 'sent',
               accepted_at = null
         where id = v_block.quote_id
           and status = 'accepted';
      end if;

      perform public.notify_organizer_party(
        v_block.company_id,
        v_block.organizer_id,
        'booking.auto_cancelled_expired_hold',
        jsonb_build_object(
          'booking_id', v_block.booking_id,
          'reason', 'soft_hold_expired'
        )
      );

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

-- ---------------------------------------------------------------------------
-- 3. auto_mark_completed — same fan-out treatment.
-- ---------------------------------------------------------------------------

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
  for v_booking in
    select bk.id           as booking_id,
           bk.organizer_id,
           bk.company_id   as company_id,
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

    perform public.notify_organizer_party(
      v_booking.company_id,
      v_booking.organizer_id,
      'booking.auto_completed',
      jsonb_build_object('booking_id', v_booking.booking_id)
    );

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

-- ---------------------------------------------------------------------------
-- 4. close_stale_disputes — same fan-out treatment.
-- ---------------------------------------------------------------------------

create or replace function public.close_stale_disputes()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count integer := 0;
  v_dispute record;
begin
  for v_dispute in
    select d.id           as dispute_id,
           d.booking_id,
           b.organizer_id,
           b.company_id    as company_id,
           sup.profile_id  as supplier_profile_id
      from public.disputes d
      join public.bookings b on b.id = d.booking_id
      join public.suppliers sup on sup.id = b.supplier_id
     where d.status in ('open', 'investigating')
       and d.opened_at < now() - interval '30 days'
     for update of d
  loop
    update public.disputes
       set status = 'closed',
           resolved_at = now(),
           resolved_by = null,
           resolution_jsonb = jsonb_build_object(
             'auto_closed', true,
             'reason', 'stale_window',
             'closed_at', now()
           )
     where id = v_dispute.dispute_id;

    perform public.notify_organizer_party(
      v_dispute.company_id,
      v_dispute.organizer_id,
      'dispute.auto_closed',
      jsonb_build_object(
        'dispute_id', v_dispute.dispute_id,
        'booking_id', v_dispute.booking_id,
        'reason', 'stale_window'
      )
    );

    if v_dispute.supplier_profile_id is not null then
      insert into public.notifications (user_id, kind, payload_jsonb)
      values (
        v_dispute.supplier_profile_id,
        'dispute.auto_closed',
        jsonb_build_object(
          'dispute_id', v_dispute.dispute_id,
          'booking_id', v_dispute.booking_id,
          'reason', 'stale_window'
        )
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

notify pgrst, 'reload schema';
