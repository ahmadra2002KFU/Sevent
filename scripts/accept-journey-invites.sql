\echo '== accept teammate1 =='
select * from public.accept_organizer_invite_tx(
  '0f21ebb5-13da-415e-b7dd-8402761ece6b',
  '8Cf8Blce2vgGsb4uUi2MN3loKuGRFd15hRTsvkK_3SE',
  '31eb29cd-4fc1-46be-ba38-f446e3c49be0'
);

\echo '== accept teammate2 =='
select * from public.accept_organizer_invite_tx(
  '6e82b5e9-7343-42e6-a2b7-5ef4a67d7f31',
  'MQV6tizQnO72NZm6M86ZdEIkvnMSx46Qcaxb2_pUauo',
  '0a53ec83-c92d-44b2-96d0-6ab47088b53f'
);

\echo '== accept teammate3 =='
select * from public.accept_organizer_invite_tx(
  '5d7a7569-5a48-4d03-a146-7f751900a658',
  'ROiY4MVT2z8scqNn3sUw7bkyPGzFbaTy64ULLEe463E',
  '13dfeccf-6bde-4df2-bc4c-217d23d16428'
);

\echo '== final memberships =='
select p.email, m.role::text, m.removed_at from public.organizer_memberships m
  join auth.users p on p.id=m.profile_id
  where m.company_id=(select id from public.organizer_companies where slug='journey-events')
  order by m.joined_at;

\echo '== audit log =='
select action, actor_profile_id::text, target_profile_id::text, to_role::text from public.organizer_membership_events
  where company_id=(select id from public.organizer_companies where slug='journey-events')
  order by created_at;
