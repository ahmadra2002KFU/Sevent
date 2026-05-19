-- PR 7 hardening smoke: exercises each new errcode + the auto-promote trigger.

begin;

insert into auth.users (id, email, encrypted_password, instance_id, email_confirmed_at, raw_user_meta_data)
values
  ('aa000000-0000-0000-0000-000000000001'::uuid, 'pr7-owner@t.local', '', '00000000-0000-0000-0000-000000000000', now(), '{"role":"organizer"}'::jsonb),
  ('aa000000-0000-0000-0000-000000000002'::uuid, 'pr7-adminA@t.local', '', '00000000-0000-0000-0000-000000000000', now(), '{"role":"organizer"}'::jsonb),
  ('aa000000-0000-0000-0000-000000000003'::uuid, 'pr7-adminB@t.local', '', '00000000-0000-0000-0000-000000000000', now(), '{"role":"organizer"}'::jsonb),
  ('aa000000-0000-0000-0000-000000000004'::uuid, 'pr7-member@t.local', '', '00000000-0000-0000-0000-000000000000', now(), '{"role":"organizer"}'::jsonb);
update public.profiles set role='organizer'
 where id in ('aa000000-0000-0000-0000-000000000001'::uuid,'aa000000-0000-0000-0000-000000000002'::uuid,'aa000000-0000-0000-0000-000000000003'::uuid,'aa000000-0000-0000-0000-000000000004'::uuid);

select * from public.create_organizer_company_tx(
  'aa000000-0000-0000-0000-000000000001', 'PR7', null, 'pr7-co', null, null, 'b@x.test', 'en'
);

-- Add adminA, adminB, member via direct membership insert (faster than full invite flow).
insert into public.organizer_memberships (company_id, profile_id, role, invited_by)
values
  ((select id from public.organizer_companies where slug='pr7-co'), 'aa000000-0000-0000-0000-000000000002'::uuid, 'admin', 'aa000000-0000-0000-0000-000000000001'::uuid),
  ((select id from public.organizer_companies where slug='pr7-co'), 'aa000000-0000-0000-0000-000000000003'::uuid, 'admin', 'aa000000-0000-0000-0000-000000000001'::uuid),
  ((select id from public.organizer_companies where slug='pr7-co'), 'aa000000-0000-0000-0000-000000000004'::uuid, 'member', 'aa000000-0000-0000-0000-000000000001'::uuid);

\echo '== P0058: admin cannot change another admins role =='
do $$
begin
  perform public.change_member_role_tx(
    (select id from public.organizer_companies where slug='pr7-co'),
    'aa000000-0000-0000-0000-000000000002', -- actor: adminA
    'aa000000-0000-0000-0000-000000000003', -- target: adminB
    'member'::public.org_member_role
  );
  raise notice 'BUG: should have raised P0058';
exception when others then
  raise notice 'sqlstate=% msg=%', sqlstate, sqlerrm;
end$$;

\echo '== P0059: admin cannot remove another admin =='
do $$
begin
  perform public.remove_company_member_tx(
    (select id from public.organizer_companies where slug='pr7-co'),
    'aa000000-0000-0000-0000-000000000002',
    'aa000000-0000-0000-0000-000000000003',
    null
  );
  raise notice 'BUG: should have raised P0059';
exception when others then
  raise notice 'sqlstate=% msg=%', sqlstate, sqlerrm;
end$$;

\echo '== self-demote-from-admin works (adminA demotes self) =='
select public.change_member_role_tx(
  (select id from public.organizer_companies where slug='pr7-co'),
  'aa000000-0000-0000-0000-000000000002',
  'aa000000-0000-0000-0000-000000000002',
  'member'::public.org_member_role
);

\echo '== owner can change adminB to member (was admin) =='
select public.change_member_role_tx(
  (select id from public.organizer_companies where slug='pr7-co'),
  'aa000000-0000-0000-0000-000000000001',
  'aa000000-0000-0000-0000-000000000003',
  'member'::public.org_member_role
);

\echo '== P0061: admin cannot invite admin =='
-- Promote adminA back to admin first.
update public.organizer_memberships set role='admin'
  where company_id=(select id from public.organizer_companies where slug='pr7-co')
    and profile_id='aa000000-0000-0000-0000-000000000002';
do $$
begin
  perform public.create_organizer_invite_tx(
    (select id from public.organizer_companies where slug='pr7-co'),
    'aa000000-0000-0000-0000-000000000002', -- actor: admin
    'new-admin@x.test',
    'admin'::public.org_member_role,
    'tok-admin-invite',
    now() + interval '7 days'
  );
  raise notice 'BUG: P0061 should have raised';
exception when others then
  raise notice 'sqlstate=% msg=%', sqlstate, sqlerrm;
end$$;

\echo '== atomic resend works (existing pending stays pending if create fails) =='
select * from public.create_organizer_invite_tx(
  (select id from public.organizer_companies where slug='pr7-co'),
  'aa000000-0000-0000-0000-000000000001',
  'resend-test@x.test',
  'member'::public.org_member_role,
  'tok-original',
  now() + interval '7 days'
);
select * from public.resend_organizer_invite_tx(
  (select id from public.organizer_invites where company_id=(select id from public.organizer_companies where slug='pr7-co') and email='resend-test@x.test' and status='pending'),
  'aa000000-0000-0000-0000-000000000001',
  'tok-new',
  now() + interval '7 days'
);
select status::text, count(*) from public.organizer_invites
  where company_id=(select id from public.organizer_companies where slug='pr7-co') and email='resend-test@x.test'
  group by status;

\echo '== auto-promote trigger: remove sole owner via direct UPDATE, expect oldest admin promoted =='
-- Save current memberships to compare later.
update public.organizer_memberships set removed_at=now()
  where company_id=(select id from public.organizer_companies where slug='pr7-co')
    and profile_id='aa000000-0000-0000-0000-000000000001';

select p.email, m.role::text, m.removed_at::timestamp(0) from public.organizer_memberships m
  join auth.users p on p.id=m.profile_id
  where m.company_id=(select id from public.organizer_companies where slug='pr7-co')
  order by m.joined_at;

\echo '== audit entry for auto-promote =='
select action, actor_profile_id::text, target_profile_id::text, from_role::text, to_role::text, metadata
  from public.organizer_membership_events
  where company_id=(select id from public.organizer_companies where slug='pr7-co')
    and action='ownership_transferred'
  order by created_at desc limit 2;

rollback;
