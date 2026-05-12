-- Sevent · migration 20260512140000: dispute lifecycle triggers.
-- Sprint "Pilot Closure" Slice 4 stream A.
--
-- Two AFTER triggers on public.disputes maintain the cross-table state
-- machine documented in Claude Docs/state-machines.md L103-110:
--
--   Opening (status → 'open' or 'investigating'):
--     • bookings.service_status → 'disputed'  (if not already)
--     • reviews.published_at → NULL           (suppress from public)
--     • reviews.suppressed_for_dispute → true (audit flag)
--
--   Resolving/closing (status → 'resolved' or 'closed'):
--     • only when NO OTHER dispute on the booking is still
--       open/investigating
--     • bookings.service_status → 'completed' (if currently 'disputed')
--     • reviews.suppressed_for_dispute → false
--     • published_at is NOT restored here — the hourly publish cron
--       (Slice 3) will re-publish at the next tick if the row still
--       meets its predicate.
--
-- Correctness note (opencode plan review §1, §3): public RLS on reviews
-- only checks `published_at IS NOT NULL`. Toggling suppressed_for_dispute
-- alone does NOT hide a published review from the public. Clearing
-- published_at is the correct suppression mechanism.

set search_path = public;

-- =============================================================================
-- Open trigger
-- =============================================================================

create or replace function public.disputes_handle_open()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_old_active boolean;
  v_new_active boolean;
begin
  v_new_active := new.status in ('open', 'investigating');
  if tg_op = 'UPDATE' then
    v_old_active := old.status in ('open', 'investigating');
  else
    v_old_active := false;
  end if;

  -- Only fire when transitioning INTO an active state.
  if v_new_active and not v_old_active then
    -- 1. Flip booking service_status to 'disputed' if currently completed or
    --    scheduled. We don't touch 'in_progress' (rare) or an already-
    --    disputed booking (multiple disputes can stack).
    update public.bookings
       set service_status = 'disputed'
     where id = new.booking_id
       and service_status in ('completed', 'scheduled');

    -- 2. Suppress every review for this booking. Clear published_at so the
    --    public RLS policy stops returning them; set the audit flag.
    update public.reviews
       set published_at = null,
           suppressed_for_dispute = true
     where booking_id = new.booking_id;
  end if;

  return new;
end;
$$;

drop trigger if exists disputes_open_set_state on public.disputes;
create trigger disputes_open_set_state
  after insert or update of status on public.disputes
  for each row execute function public.disputes_handle_open();

comment on function public.disputes_handle_open() is
  'On dispute INSERT or UPDATE to active status: flip bookings.service_status '
  'to disputed and clear reviews.published_at + set suppressed_for_dispute.';

-- =============================================================================
-- Resolve/close trigger
-- =============================================================================

create or replace function public.disputes_handle_resolve()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_other_active_count integer;
begin
  -- Only fire on UPDATE OF status moving FROM active TO terminal.
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if old.status not in ('open', 'investigating') then
    return new;
  end if;
  if new.status not in ('resolved', 'closed') then
    return new;
  end if;

  -- Check whether any sibling dispute on this booking is still active.
  select count(*)
    into v_other_active_count
    from public.disputes
   where booking_id = new.booking_id
     and id <> new.id
     and status in ('open', 'investigating');

  -- Only restore state when this was the last active dispute.
  if v_other_active_count = 0 then
    update public.bookings
       set service_status = 'completed'
     where id = new.booking_id
       and service_status = 'disputed';

    update public.reviews
       set suppressed_for_dispute = false
     where booking_id = new.booking_id;
    -- published_at intentionally NOT restored here. The hourly publish_
    -- pending_reviews() cron (Slice 3) will re-evaluate and publish if
    -- the row meets its predicate.
  end if;

  return new;
end;
$$;

drop trigger if exists disputes_resolve_restore_state on public.disputes;
create trigger disputes_resolve_restore_state
  after update of status on public.disputes
  for each row execute function public.disputes_handle_resolve();

comment on function public.disputes_handle_resolve() is
  'On dispute UPDATE from active to resolved/closed AND no sibling dispute '
  'still active: flip bookings.service_status back to completed and clear '
  'reviews.suppressed_for_dispute. Republication is handled by the cron.';
