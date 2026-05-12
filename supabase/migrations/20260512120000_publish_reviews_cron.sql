-- Sevent · migration 20260512120000: publish reviews cron.
-- Sprint "Pilot Closure" Slice 3.
--
-- Hourly job publishes pending reviews. Predicate (corrected per opencode
-- plan review §1, §3 — top-level no-dispute prerequisite, NOT precedence
-- ambiguous):
--
--   no open/investigating dispute on the booking
--   AND (both parties submitted OR window_closes_at < now())
--   AND published_at IS NULL
--
-- Per Claude Docs/state-machines.md L103-110:
--   * Dispute open → reviews.published_at is cleared by the dispute trigger
--     (20260512140000). The publish cron then naturally won't re-publish
--     them while the dispute is active (the dispute_count check fails).
--   * Dispute resolve → trigger sets suppressed_for_dispute=false, but
--     does NOT set published_at. The next tick of this cron re-publishes
--     iff the predicate still matches.

set search_path = public;

create or replace function public.publish_pending_reviews()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count integer := 0;
  v_review record;
begin
  for v_review in
    select r.id,
           r.booking_id,
           r.reviewee_id,
           r.window_closes_at,
           (
             select count(*) from public.reviews r2
              where r2.booking_id = r.booking_id
           ) as submitted_count
      from public.reviews r
     where r.published_at is null
       and not exists (
             select 1 from public.disputes d
              where d.booking_id = r.booking_id
                and d.status in ('open', 'investigating')
           )
       and (
             -- Both parties submitted on this booking. There are exactly
             -- two parties (organizer + supplier owner) so submitted_count
             -- = 2 means both have spoken.
             (select count(*) from public.reviews r2
               where r2.booking_id = r.booking_id) = 2
             OR r.window_closes_at < now()
           )
     for update of r
  loop
    update public.reviews
       set published_at = now()
     where id = v_review.id
       and published_at is null;

    -- Notify the reviewee that their (now-published) review is visible.
    if v_review.reviewee_id is not null then
      insert into public.notifications (user_id, kind, payload_jsonb)
      values (
        v_review.reviewee_id,
        'review.published',
        jsonb_build_object(
          'review_id', v_review.id,
          'booking_id', v_review.booking_id
        )
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.publish_pending_reviews() from public;
grant execute on function public.publish_pending_reviews() to service_role;

comment on function public.publish_pending_reviews() is
  'Lifecycle cron · hourly. Publishes pending reviews when both parties '
  'submitted OR the 14-day window closed, AND no dispute is open. Idempotent.';

select cron.schedule(
  'publish-pending-reviews',
  '0 * * * *',
  $$select public.publish_pending_reviews()$$
);
