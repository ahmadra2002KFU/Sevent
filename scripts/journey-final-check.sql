\echo '== final memberships =='
select p.email, m.role::text, m.removed_at::timestamp(0) from public.organizer_memberships m
  join auth.users p on p.id=m.profile_id
  where m.company_id=(select id from public.organizer_companies where slug='journey-events')
  order by m.joined_at;

\echo '== full audit timeline =='
select action,
       (select split_part(email,'@',1) from auth.users where id=actor_profile_id) as actor,
       (select split_part(email,'@',1) from auth.users where id=target_profile_id) as target,
       from_role::text as from_r,
       to_role::text as to_r,
       created_at::timestamp(0)
  from public.organizer_membership_events
  where company_id=(select id from public.organizer_companies where slug='journey-events')
  order by created_at;

\echo '== cron fan-out test (3 active members expected) =='
select public.notify_organizer_party(
  (select id from public.organizer_companies where slug='journey-events'),
  null,
  'test.journey_fanout',
  '{"k":1}'::jsonb
) as rows_written;
select count(*) as notif_count from public.notifications where kind='test.journey_fanout';
