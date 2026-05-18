begin;
-- The on_auth_user_created trigger auto-inserts a profile row on auth.users
-- INSERT; use the raw_user_meta_data to seed role + display name so we don't
-- have to UPDATE afterwards (and the trigger picks role='organizer' by
-- default if not specified).
insert into auth.users (id, email, encrypted_password, instance_id, email_confirmed_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000001', 'owner@test.local', '', '00000000-0000-0000-0000-000000000000', now(), '{"full_name":"Owner Test","role":"organizer"}'::jsonb),
       ('00000000-0000-0000-0000-000000000002', 'admin@test.local', '', '00000000-0000-0000-0000-000000000000', now(), '{"full_name":"Admin Test","role":"organizer"}'::jsonb),
       ('00000000-0000-0000-0000-000000000003', 'member@test.local', '', '00000000-0000-0000-0000-000000000000', now(), '{"full_name":"Member Test","role":"organizer"}'::jsonb);
-- Make sure the trigger-created profile rows have role='organizer' regardless
-- of how the trigger interprets metadata.
update public.profiles set role='organizer' where id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);

\echo '== 1) create company (owner) =='
select * from public.create_organizer_company_tx(
  '00000000-0000-0000-0000-000000000001',
  'Acme Co', 'sharika', 'acme-pr4-smoke', null, null, 'billing@acme.test', 'en'
);

\echo '== 2) invite admin =='
select * from public.create_organizer_invite_tx(
  (select id from public.organizer_companies where slug='acme-pr4-smoke'),
  '00000000-0000-0000-0000-000000000001',
  'admin@test.local',
  'admin'::public.org_member_role,
  'tok-admin',
  now() + interval '7 days'
);

\echo '== 3) accept admin invite =='
select * from public.accept_organizer_invite_tx(
  (select id from public.organizer_invites where company_id=(select id from public.organizer_companies where slug='acme-pr4-smoke') and email='admin@test.local'),
  'tok-admin',
  '00000000-0000-0000-0000-000000000002'
);

\echo '== 4) update company (admin) =='
select public.update_organizer_company_tx(
  (select id from public.organizer_companies where slug='acme-pr4-smoke'),
  '00000000-0000-0000-0000-000000000002',
  'Acme Updated', 'sharika muhaddatha', '1010123456', '300000000000003',
  'newbilling@acme.test', 'ar', null
);

\echo '== 5) invite member then change to admin =='
select * from public.create_organizer_invite_tx(
  (select id from public.organizer_companies where slug='acme-pr4-smoke'),
  '00000000-0000-0000-0000-000000000002',
  'member@test.local',
  'member'::public.org_member_role,
  'tok-member',
  now() + interval '7 days'
);
select * from public.accept_organizer_invite_tx(
  (select id from public.organizer_invites where company_id=(select id from public.organizer_companies where slug='acme-pr4-smoke') and email='member@test.local'),
  'tok-member',
  '00000000-0000-0000-0000-000000000003'
);
select public.change_member_role_tx(
  (select id from public.organizer_companies where slug='acme-pr4-smoke'),
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  'admin'::public.org_member_role
);

\echo '== 6) attempt change-to-owner (must fail P0056) =='
do $$
begin
  perform public.change_member_role_tx(
    (select id from public.organizer_companies where slug='acme-pr4-smoke'),
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003',
    'owner'::public.org_member_role
  );
  raise notice 'BUG: P0056 not raised';
exception when others then
  raise notice 'GOOD: sqlstate % msg %', sqlstate, sqlerrm;
end$$;

\echo '== 7) revoke an invite =='
select * from public.create_organizer_invite_tx(
  (select id from public.organizer_companies where slug='acme-pr4-smoke'),
  '00000000-0000-0000-0000-000000000002',
  'tmp@test.local',
  'member'::public.org_member_role,
  'tok-tmp',
  now() + interval '7 days'
);
select public.revoke_organizer_invite_tx(
  (select id from public.organizer_invites where company_id=(select id from public.organizer_companies where slug='acme-pr4-smoke') and email='tmp@test.local' and status='pending'),
  '00000000-0000-0000-0000-000000000002',
  'no longer needed'
);

\echo '== 8) duplicate-pending invite (must fail P0050) =='
do $$
begin
  perform public.create_organizer_invite_tx(
    (select id from public.organizer_companies where slug='acme-pr4-smoke'),
    '00000000-0000-0000-0000-000000000002',
    'admin@test.local',
    'admin'::public.org_member_role,
    'tok-dup',
    now() + interval '7 days'
  );
  raise notice 'BUG: P0050 not raised';
exception when others then
  raise notice 'GOOD: sqlstate % msg %', sqlstate, sqlerrm;
end$$;

\echo '== 9) FINAL state =='
select name, name_ar, default_language, billing_email from public.organizer_companies where slug='acme-pr4-smoke';
select profile_id, role::text from public.organizer_memberships where company_id=(select id from public.organizer_companies where slug='acme-pr4-smoke') and removed_at is null order by joined_at;
select action, actor_profile_id, target_profile_id, from_role::text, to_role::text from public.organizer_membership_events where company_id=(select id from public.organizer_companies where slug='acme-pr4-smoke') order by created_at;

rollback;
