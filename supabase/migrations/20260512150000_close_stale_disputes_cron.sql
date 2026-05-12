-- Sevent · migration 20260512150000: close stale disputes cron.
-- Sprint "Pilot Closure" Slice 4 stream A.
--
-- Hourly job that auto-closes disputes left in open/investigating for more
-- than 30 days. The resolve trigger from 20260512140000 fires automatically
-- on the UPDATE, restoring bookings.service_status and clearing the review
-- suppression flag (publication cron then re-publishes any qualified reviews
-- on the next tick).

set search_path = public;

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
    select d.id          as dispute_id,
           d.booking_id,
           b.organizer_id,
           sup.profile_id as supplier_profile_id
      from public.disputes d
      join public.bookings b on b.id = d.booking_id
      join public.suppliers sup on sup.id = b.supplier_id
     where d.status in ('open', 'investigating')
       and d.opened_at < now() - interval '30 days'
     for update of d
  loop
    -- Triggering UPDATE fires disputes_resolve_restore_state, which restores
    -- booking + review state (when this is the last active dispute on the
    -- booking).
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

    -- Notify both parties.
    if v_dispute.organizer_id is not null then
      insert into public.notifications (user_id, kind, payload_jsonb)
      values (
        v_dispute.organizer_id,
        'dispute.auto_closed',
        jsonb_build_object(
          'dispute_id', v_dispute.dispute_id,
          'booking_id', v_dispute.booking_id,
          'reason', 'stale_window'
        )
      );
    end if;

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

revoke all on function public.close_stale_disputes() from public;
grant execute on function public.close_stale_disputes() to service_role;

comment on function public.close_stale_disputes() is
  'Lifecycle cron · hourly. Auto-closes disputes open/investigating for >30d '
  'with resolution_jsonb = {auto_closed:true, reason:''stale_window''}. The '
  'resolve trigger restores booking + review state. Idempotent.';

select cron.schedule(
  'close-stale-disputes',
  '0 * * * *',
  $$select public.close_stale_disputes()$$
);
