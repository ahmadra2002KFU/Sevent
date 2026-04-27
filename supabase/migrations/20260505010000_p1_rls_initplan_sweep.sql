-- P1-5/6/7: RLS perf sweep + recursive policy fixes + function search_path.
--
-- ┌─ What this migration does ─────────────────────────────────────────────┐
-- │ 1. Wraps every bare auth.uid() in policy expressions as                │
-- │    (SELECT auth.uid()). Postgres recognises this pattern as an         │
-- │    initplan and evaluates it ONCE per query instead of once per row    │
-- │    — typical 5–10× speedup on RLS-protected list pages.                │
-- │ 2. Same wrap for bare is_admin().                                      │
-- │ 3. Replaces the recursive `EXISTS (SELECT 1 FROM profiles p WHERE      │
-- │    p.id = auth.uid() AND p.role='admin')` pattern in profiles policies │
-- │    with (SELECT public.is_admin()). Same logic, but reads cached       │
-- │    instead of recursively scanning profiles inside a profiles policy.  │
-- │ 4. Adds SET search_path = public, pg_catalog to three functions       │
-- │    (guard_supplier_verification, storage_supplier_id_from_path,        │
-- │    storage_path_owner_profile) for security hygiene.                   │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- The policy DROP + CREATE pairs below were generated from pg_policies
-- (the live, authoritative state) — see Claude Docs/_phase_b_generator.sql.
-- The migration runs inside Supabase CLI's implicit transaction, so each
-- table is never RLS-less to clients during the swap.
--
-- NOTE on the trigger function in 20260504081000_quote_proposal_requests_security.sql:
-- it has bare auth.uid() at lines 150-151 inside the function body. Wrapping
-- with (SELECT auth.uid()) inside a plpgsql function body provides NO
-- initplan benefit — that optimisation is specific to RLS policy expressions.
-- Skipped intentionally.

-- ─── 1. Function search_path additions (P1-7) ───────────────────────────────

create or replace function public.guard_supplier_verification()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'UPDATE'
     and new.verification_status is distinct from old.verification_status
     and current_user not in ('service_role', 'supabase_admin', 'postgres')
     and not public.is_admin() then
    raise exception 'only admins can change verification_status';
  end if;
  return new;
end;
$$;

create or replace function public.storage_supplier_id_from_path(path text)
returns uuid
language plpgsql
immutable
set search_path = public, pg_catalog
as $$
declare
  head text;
  id uuid;
begin
  head := split_part(path, '/', 1);
  begin
    id := head::uuid;
  exception when others then
    return null;
  end;
  return id;
end;
$$;

create or replace function public.storage_path_owner_profile(path text)
returns uuid
language sql
stable
set search_path = public, pg_catalog
as $$
  select s.profile_id
    from public.suppliers s
   where s.id = public.storage_supplier_id_from_path(path)
$$;

-- ─── 2. Policy DROP + CREATE pairs (76 policies) ────────────────────────────
-- Generated from pg_policies; see header comment for substitution rules.

drop policy if exists "availability_blocks: admin read" on public.availability_blocks;
create policy "availability_blocks: admin read" on public.availability_blocks
  for SELECT to public
  using ((SELECT public.is_admin()));

drop policy if exists "availability_blocks: owner all" on public.availability_blocks;
create policy "availability_blocks: owner all" on public.availability_blocks
  for ALL to public
  using ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = availability_blocks.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = availability_blocks.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))));

drop policy if exists "bookings: admin read" on public.bookings;
create policy "bookings: admin read" on public.bookings
  for SELECT to public
  using ((SELECT public.is_admin()));

drop policy if exists "bookings: organizer all" on public.bookings;
create policy "bookings: organizer all" on public.bookings
  for ALL to public
  using ((organizer_id = (SELECT auth.uid())))
  with check ((organizer_id = (SELECT auth.uid())));

drop policy if exists "bookings: supplier all" on public.bookings;
create policy "bookings: supplier all" on public.bookings
  for ALL to public
  using ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = bookings.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = bookings.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))));

drop policy if exists "categories: admin write" on public.categories;
create policy "categories: admin write" on public.categories
  for ALL to public
  using ((SELECT public.is_admin()))
  with check ((SELECT public.is_admin()));

drop policy if exists "dispute_evidence: admin all" on public.dispute_evidence;
create policy "dispute_evidence: admin all" on public.dispute_evidence
  for ALL to public
  using ((SELECT public.is_admin()))
  with check ((SELECT public.is_admin()));

drop policy if exists "dispute_evidence: party read" on public.dispute_evidence;
create policy "dispute_evidence: party read" on public.dispute_evidence
  for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM ((disputes d
     JOIN bookings b ON ((b.id = d.booking_id)))
     LEFT JOIN suppliers s ON ((s.id = b.supplier_id)))
  WHERE ((d.id = dispute_evidence.dispute_id) AND ((b.organizer_id = (SELECT auth.uid())) OR (s.profile_id = (SELECT auth.uid()))) AND (dispute_evidence.visible_to_other_party OR (dispute_evidence.submitted_by = (SELECT auth.uid())))))));

drop policy if exists "dispute_evidence: party write" on public.dispute_evidence;
create policy "dispute_evidence: party write" on public.dispute_evidence
  for INSERT to public
  with check (((submitted_by = (SELECT auth.uid())) AND (EXISTS ( SELECT 1
   FROM ((disputes d
     JOIN bookings b ON ((b.id = d.booking_id)))
     LEFT JOIN suppliers s ON ((s.id = b.supplier_id)))
  WHERE ((d.id = dispute_evidence.dispute_id) AND ((b.organizer_id = (SELECT auth.uid())) OR (s.profile_id = (SELECT auth.uid()))))))));

drop policy if exists "disputes: admin all" on public.disputes;
create policy "disputes: admin all" on public.disputes
  for ALL to public
  using ((SELECT public.is_admin()))
  with check ((SELECT public.is_admin()));

drop policy if exists "disputes: party open" on public.disputes;
create policy "disputes: party open" on public.disputes
  for INSERT to public
  with check (((EXISTS ( SELECT 1
   FROM (bookings b
     LEFT JOIN suppliers s ON ((s.id = b.supplier_id)))
  WHERE ((b.id = disputes.booking_id) AND ((b.organizer_id = (SELECT auth.uid())) OR (s.profile_id = (SELECT auth.uid())))))) AND (raised_by = (SELECT auth.uid()))));

drop policy if exists "disputes: party read" on public.disputes;
create policy "disputes: party read" on public.disputes
  for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM (bookings b
     LEFT JOIN suppliers s ON ((s.id = b.supplier_id)))
  WHERE ((b.id = disputes.booking_id) AND ((b.organizer_id = (SELECT auth.uid())) OR (s.profile_id = (SELECT auth.uid())))))));

drop policy if exists "events: admin read" on public.events;
create policy "events: admin read" on public.events
  for SELECT to public
  using ((SELECT public.is_admin()));

drop policy if exists "events: owner all" on public.events;
create policy "events: owner all" on public.events
  for ALL to public
  using ((organizer_id = (SELECT auth.uid())))
  with check ((organizer_id = (SELECT auth.uid())));

drop policy if exists "notifications: admin read" on public.notifications;
create policy "notifications: admin read" on public.notifications
  for SELECT to public
  using ((SELECT public.is_admin()));

drop policy if exists "notifications: owner mark read" on public.notifications;
create policy "notifications: owner mark read" on public.notifications
  for UPDATE to public
  using ((user_id = (SELECT auth.uid())))
  with check ((user_id = (SELECT auth.uid())));

drop policy if exists "notifications: owner read" on public.notifications;
create policy "notifications: owner read" on public.notifications
  for SELECT to public
  using ((user_id = (SELECT auth.uid())));

drop policy if exists "packages: admin read" on public.packages;
create policy "packages: admin read" on public.packages
  for SELECT to public
  using ((SELECT public.is_admin()));

drop policy if exists "packages: owner all" on public.packages;
create policy "packages: owner all" on public.packages
  for ALL to public
  using ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = packages.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = packages.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))));

drop policy if exists "pricing_rules: admin read" on public.pricing_rules;
create policy "pricing_rules: admin read" on public.pricing_rules
  for SELECT to public
  using ((SELECT public.is_admin()));

drop policy if exists "pricing_rules: owner all" on public.pricing_rules;
create policy "pricing_rules: owner all" on public.pricing_rules
  for ALL to public
  using ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = pricing_rules.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = pricing_rules.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))));

drop policy if exists "profiles: admin full read" on public.profiles;
create policy "profiles: admin full read" on public.profiles
  for SELECT to public
  using (((SELECT public.is_admin())));

drop policy if exists "profiles: admin full write" on public.profiles;
create policy "profiles: admin full write" on public.profiles
  for ALL to public
  using (((SELECT public.is_admin())))
  with check (((SELECT public.is_admin())));

drop policy if exists "profiles: self read" on public.profiles;
create policy "profiles: self read" on public.profiles
  for SELECT to public
  using (((SELECT auth.uid()) = id));

drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self update" on public.profiles
  for UPDATE to public
  using (((SELECT auth.uid()) = id))
  with check ((((SELECT auth.uid()) = id) AND ((role = ( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.id = (SELECT auth.uid())))) OR ((SELECT public.is_admin())))));

drop policy if exists "qpro: admin all" on public.quote_proposal_request_orphans;
create policy "qpro: admin all" on public.quote_proposal_request_orphans
  for ALL to public
  using ((SELECT public.is_admin()))
  with check ((SELECT public.is_admin()));

drop policy if exists "qpr: admin all" on public.quote_proposal_requests;
create policy "qpr: admin all" on public.quote_proposal_requests
  for ALL to public
  using ((SELECT public.is_admin()))
  with check ((SELECT public.is_admin()));

drop policy if exists "qpr: organizer insert" on public.quote_proposal_requests;
create policy "qpr: organizer insert" on public.quote_proposal_requests
  for INSERT to public
  with check ((caller_owns_quote_as_organizer(quote_id) AND (requested_by = (SELECT auth.uid()))));

drop policy if exists "quote_revisions: admin read" on public.quote_revisions;
create policy "quote_revisions: admin read" on public.quote_revisions
  for SELECT to public
  using ((SELECT public.is_admin()));

drop policy if exists "quote_revisions: organizer read" on public.quote_revisions;
create policy "quote_revisions: organizer read" on public.quote_revisions
  for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM ((quotes q
     JOIN rfqs r ON ((r.id = q.rfq_id)))
     JOIN events e ON ((e.id = r.event_id)))
  WHERE ((q.id = quote_revisions.quote_id) AND (e.organizer_id = (SELECT auth.uid()))))));

drop policy if exists "quote_revisions: supplier insert" on public.quote_revisions;
create policy "quote_revisions: supplier insert" on public.quote_revisions
  for INSERT to public
  with check ((EXISTS ( SELECT 1
   FROM (quotes q
     JOIN suppliers s ON ((s.id = q.supplier_id)))
  WHERE ((q.id = quote_revisions.quote_id) AND (s.profile_id = (SELECT auth.uid()))))));

drop policy if exists "quote_revisions: supplier read" on public.quote_revisions;
create policy "quote_revisions: supplier read" on public.quote_revisions
  for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM (quotes q
     JOIN suppliers s ON ((s.id = q.supplier_id)))
  WHERE ((q.id = quote_revisions.quote_id) AND (s.profile_id = (SELECT auth.uid()))))));

drop policy if exists "quotes: admin read" on public.quotes;
create policy "quotes: admin read" on public.quotes
  for SELECT to public
  using ((SELECT public.is_admin()));

drop policy if exists "quotes: organizer accept/reject" on public.quotes;
create policy "quotes: organizer accept/reject" on public.quotes
  for UPDATE to public
  using ((EXISTS ( SELECT 1
   FROM (rfqs r
     JOIN events e ON ((e.id = r.event_id)))
  WHERE ((r.id = quotes.rfq_id) AND (e.organizer_id = (SELECT auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM (rfqs r
     JOIN events e ON ((e.id = r.event_id)))
  WHERE ((r.id = quotes.rfq_id) AND (e.organizer_id = (SELECT auth.uid()))))));

drop policy if exists "quotes: organizer read" on public.quotes;
create policy "quotes: organizer read" on public.quotes
  for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM (rfqs r
     JOIN events e ON ((e.id = r.event_id)))
  WHERE ((r.id = quotes.rfq_id) AND (e.organizer_id = (SELECT auth.uid()))))));

drop policy if exists "quotes: supplier all" on public.quotes;
create policy "quotes: supplier all" on public.quotes
  for ALL to public
  using ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = quotes.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = quotes.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))));

drop policy if exists "reviews: admin read" on public.reviews;
create policy "reviews: admin read" on public.reviews
  for SELECT to public
  using ((SELECT public.is_admin()));

drop policy if exists "reviews: reviewer insert" on public.reviews;
create policy "reviews: reviewer insert" on public.reviews
  for INSERT to public
  with check ((reviewer_id = (SELECT auth.uid())));

drop policy if exists "reviews: reviewer read" on public.reviews;
create policy "reviews: reviewer read" on public.reviews
  for SELECT to public
  using ((reviewer_id = (SELECT auth.uid())));

drop policy if exists "rfq_invites: admin read" on public.rfq_invites;
create policy "rfq_invites: admin read" on public.rfq_invites
  for SELECT to public
  using ((SELECT public.is_admin()));

drop policy if exists "rfq_invites: organizer read" on public.rfq_invites;
create policy "rfq_invites: organizer read" on public.rfq_invites
  for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM (rfqs r
     JOIN events e ON ((e.id = r.event_id)))
  WHERE ((r.id = rfq_invites.rfq_id) AND (e.organizer_id = (SELECT auth.uid()))))));

drop policy if exists "rfq_invites: organizer write" on public.rfq_invites;
create policy "rfq_invites: organizer write" on public.rfq_invites
  for ALL to public
  using ((EXISTS ( SELECT 1
   FROM (rfqs r
     JOIN events e ON ((e.id = r.event_id)))
  WHERE ((r.id = rfq_invites.rfq_id) AND (e.organizer_id = (SELECT auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM (rfqs r
     JOIN events e ON ((e.id = r.event_id)))
  WHERE ((r.id = rfq_invites.rfq_id) AND (e.organizer_id = (SELECT auth.uid()))))));

drop policy if exists "rfq_invites: supplier read own" on public.rfq_invites;
create policy "rfq_invites: supplier read own" on public.rfq_invites
  for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = rfq_invites.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))));

drop policy if exists "rfq_invites: supplier respond" on public.rfq_invites;
create policy "rfq_invites: supplier respond" on public.rfq_invites
  for UPDATE to public
  using ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = rfq_invites.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = rfq_invites.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))));

drop policy if exists "rfq_invites: supplier self-apply" on public.rfq_invites;
create policy "rfq_invites: supplier self-apply" on public.rfq_invites
  for INSERT to public
  with check (((source = 'self_applied'::rfq_invite_source) AND (EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = rfq_invites.supplier_id) AND (s.profile_id = (SELECT auth.uid())) AND (s.verification_status = 'approved'::supplier_verification_status) AND s.is_published))) AND (EXISTS ( SELECT 1
   FROM rfqs r
  WHERE ((r.id = rfq_invites.rfq_id) AND r.is_published_to_marketplace AND (r.status = 'sent'::rfq_status))))));

drop policy if exists "rfqs: admin read" on public.rfqs;
create policy "rfqs: admin read" on public.rfqs
  for SELECT to public
  using ((SELECT public.is_admin()));

drop policy if exists "rfqs: organizer all" on public.rfqs;
create policy "rfqs: organizer all" on public.rfqs
  for ALL to public
  using ((EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = rfqs.event_id) AND (e.organizer_id = (SELECT auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = rfqs.event_id) AND (e.organizer_id = (SELECT auth.uid()))))));

drop policy if exists "supplier_categories: owner write" on public.supplier_categories;
create policy "supplier_categories: owner write" on public.supplier_categories
  for ALL to public
  using ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = supplier_categories.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = supplier_categories.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))));

drop policy if exists "supplier_categories: public read" on public.supplier_categories;
create policy "supplier_categories: public read" on public.supplier_categories
  for SELECT to public
  using (((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = supplier_categories.supplier_id) AND s.is_published AND (s.verification_status = 'approved'::supplier_verification_status)))) OR (EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = supplier_categories.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))) OR (SELECT public.is_admin())));

drop policy if exists "supplier_docs: admin read" on public.supplier_docs;
create policy "supplier_docs: admin read" on public.supplier_docs
  for SELECT to public
  using ((SELECT public.is_admin()));

drop policy if exists "supplier_docs: admin write" on public.supplier_docs;
create policy "supplier_docs: admin write" on public.supplier_docs
  for ALL to public
  using ((SELECT public.is_admin()))
  with check ((SELECT public.is_admin()));

drop policy if exists "supplier_docs: owner read" on public.supplier_docs;
create policy "supplier_docs: owner read" on public.supplier_docs
  for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = supplier_docs.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))));

drop policy if exists "supplier_docs: owner write" on public.supplier_docs;
create policy "supplier_docs: owner write" on public.supplier_docs
  for ALL to public
  using ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = supplier_docs.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = supplier_docs.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))));

drop policy if exists "supplier_media: admin read" on public.supplier_media;
create policy "supplier_media: admin read" on public.supplier_media
  for SELECT to public
  using ((SELECT public.is_admin()));

drop policy if exists "supplier_media: owner all" on public.supplier_media;
create policy "supplier_media: owner all" on public.supplier_media
  for ALL to public
  using ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = supplier_media.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM suppliers s
  WHERE ((s.id = supplier_media.supplier_id) AND (s.profile_id = (SELECT auth.uid()))))));

drop policy if exists "suppliers: admin read" on public.suppliers;
create policy "suppliers: admin read" on public.suppliers
  for SELECT to public
  using ((SELECT public.is_admin()));

drop policy if exists "suppliers: admin write" on public.suppliers;
create policy "suppliers: admin write" on public.suppliers
  for ALL to public
  using ((SELECT public.is_admin()))
  with check ((SELECT public.is_admin()));

drop policy if exists "suppliers: owner insert" on public.suppliers;
create policy "suppliers: owner insert" on public.suppliers
  for INSERT to public
  with check ((profile_id = (SELECT auth.uid())));

drop policy if exists "suppliers: owner read" on public.suppliers;
create policy "suppliers: owner read" on public.suppliers
  for SELECT to public
  using ((profile_id = (SELECT auth.uid())));

drop policy if exists "suppliers: owner update" on public.suppliers;
create policy "suppliers: owner update" on public.suppliers
  for UPDATE to public
  using ((profile_id = (SELECT auth.uid())))
  with check ((profile_id = (SELECT auth.uid())));

drop policy if exists "contracts: admin all" on storage.objects;
create policy "contracts: admin all" on storage.objects
  for ALL to public
  using (((bucket_id = 'contracts'::text) AND (SELECT public.is_admin())))
  with check (((bucket_id = 'contracts'::text) AND (SELECT public.is_admin())));

drop policy if exists "contracts: admin read" on storage.objects;
create policy "contracts: admin read" on storage.objects
  for SELECT to public
  using (((bucket_id = 'contracts'::text) AND (SELECT public.is_admin())));

drop policy if exists "docs: admin read" on storage.objects;
create policy "docs: admin read" on storage.objects
  for SELECT to public
  using (((bucket_id = 'supplier-docs'::text) AND (SELECT public.is_admin())));

drop policy if exists "docs: admin write" on storage.objects;
create policy "docs: admin write" on storage.objects
  for ALL to public
  using (((bucket_id = 'supplier-docs'::text) AND (SELECT public.is_admin())))
  with check (((bucket_id = 'supplier-docs'::text) AND (SELECT public.is_admin())));

drop policy if exists "docs: owner delete" on storage.objects;
create policy "docs: owner delete" on storage.objects
  for DELETE to public
  using (((bucket_id = 'supplier-docs'::text) AND ((SELECT auth.uid()) = storage_path_owner_profile(name))));

drop policy if exists "docs: owner read" on storage.objects;
create policy "docs: owner read" on storage.objects
  for SELECT to public
  using (((bucket_id = 'supplier-docs'::text) AND ((SELECT auth.uid()) = storage_path_owner_profile(name))));

drop policy if exists "docs: owner update" on storage.objects;
create policy "docs: owner update" on storage.objects
  for UPDATE to public
  using (((bucket_id = 'supplier-docs'::text) AND ((SELECT auth.uid()) = storage_path_owner_profile(name))))
  with check (((bucket_id = 'supplier-docs'::text) AND ((SELECT auth.uid()) = storage_path_owner_profile(name))));

drop policy if exists "docs: owner write" on storage.objects;
create policy "docs: owner write" on storage.objects
  for INSERT to public
  with check (((bucket_id = 'supplier-docs'::text) AND ((SELECT auth.uid()) = storage_path_owner_profile(name))));

drop policy if exists "logos: admin all" on storage.objects;
create policy "logos: admin all" on storage.objects
  for ALL to public
  using (((bucket_id = 'supplier-logos'::text) AND (SELECT public.is_admin())))
  with check (((bucket_id = 'supplier-logos'::text) AND (SELECT public.is_admin())));

drop policy if exists "logos: owner delete" on storage.objects;
create policy "logos: owner delete" on storage.objects
  for DELETE to public
  using (((bucket_id = 'supplier-logos'::text) AND ((SELECT auth.uid()) = storage_path_owner_profile(name))));

drop policy if exists "logos: owner update" on storage.objects;
create policy "logos: owner update" on storage.objects
  for UPDATE to public
  using (((bucket_id = 'supplier-logos'::text) AND ((SELECT auth.uid()) = storage_path_owner_profile(name))))
  with check (((bucket_id = 'supplier-logos'::text) AND ((SELECT auth.uid()) = storage_path_owner_profile(name))));

drop policy if exists "logos: owner write" on storage.objects;
create policy "logos: owner write" on storage.objects
  for INSERT to public
  with check (((bucket_id = 'supplier-logos'::text) AND ((SELECT auth.uid()) = storage_path_owner_profile(name))));

drop policy if exists "portfolio: admin all" on storage.objects;
create policy "portfolio: admin all" on storage.objects
  for ALL to public
  using (((bucket_id = 'supplier-portfolio'::text) AND (SELECT public.is_admin())))
  with check (((bucket_id = 'supplier-portfolio'::text) AND (SELECT public.is_admin())));

drop policy if exists "portfolio: owner delete" on storage.objects;
create policy "portfolio: owner delete" on storage.objects
  for DELETE to public
  using (((bucket_id = 'supplier-portfolio'::text) AND ((SELECT auth.uid()) = storage_path_owner_profile(name))));

drop policy if exists "portfolio: owner update" on storage.objects;
create policy "portfolio: owner update" on storage.objects
  for UPDATE to public
  using (((bucket_id = 'supplier-portfolio'::text) AND ((SELECT auth.uid()) = storage_path_owner_profile(name))))
  with check (((bucket_id = 'supplier-portfolio'::text) AND ((SELECT auth.uid()) = storage_path_owner_profile(name))));

drop policy if exists "portfolio: owner write" on storage.objects;
create policy "portfolio: owner write" on storage.objects
  for INSERT to public
  with check (((bucket_id = 'supplier-portfolio'::text) AND ((SELECT auth.uid()) = storage_path_owner_profile(name))));

