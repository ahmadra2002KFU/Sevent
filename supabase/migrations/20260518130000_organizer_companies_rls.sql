-- =============================================================================
-- 20260518130000 — Organizer companies: RLS policies.
--
-- PR 1 of the multi-user company-organizer refactor.
--
-- Scope (in order):
--   A. Enable RLS on the four new tables (organizer_companies,
--      organizer_memberships, organizer_invites, organizer_membership_events)
--      and add their policies.
--   B. Rewrite every organizer-scoped policy on existing tables so the
--      predicate admits the company branch via public.is_company_member().
--      The shape is:
--          (company_id IS NULL AND <existing individual predicate>)
--          OR public.is_company_member(<tablename>.company_id)
--      Partial indexes added in 20260518111000 are designed for exactly this
--      split — the planner chooses one branch per row.
--   C. Rewrite the contracts storage-bucket policy from
--      20260512110000_contracts_party_read_rls.sql so company members can
--      download contracts for bookings owned by their company.
--
-- All auth.uid() references use `(select auth.uid())` to preserve the
-- initplan optimisation from 20260505010000_p1_rls_initplan_sweep.sql.
-- is_admin() likewise. is_company_member()/is_company_admin() are STABLE +
-- LEAKPROOF so the planner can inline them.
--
-- The closing NOTIFY tells PostgREST to reload its schema cache so the
-- new helper functions and policies are reflected in REST behaviour.
-- =============================================================================

set search_path = public;

-- ============================================================================
-- A. New tables — enable RLS and add policies.
-- ============================================================================

-- A.1 organizer_companies ----------------------------------------------------

alter table public.organizer_companies enable row level security;

create policy "companies: member read" on public.organizer_companies
  for select using (public.is_company_member(id));

create policy "companies: admin update" on public.organizer_companies
  for update using (public.is_company_admin(id))
  with check (public.is_company_admin(id));

create policy "companies: creator insert" on public.organizer_companies
  for insert with check (created_by = (select auth.uid()));

-- No public delete policy — service role only.

-- A.2 organizer_memberships --------------------------------------------------
--
-- Self-read is required for is_company_member()/is_company_admin() to work
-- without SECURITY DEFINER. Admins of the company can also see all member
-- rows for that company.

alter table public.organizer_memberships enable row level security;

create policy "memberships: self read" on public.organizer_memberships
  for select using (
    profile_id = (select auth.uid())
    or public.is_company_admin(company_id)
  );

create policy "memberships: admin manage" on public.organizer_memberships
  for all using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

-- A.3 organizer_invites ------------------------------------------------------
--
-- Invite reads-by-token (for the accept page) go through the service role,
-- so there is no public read policy here.

alter table public.organizer_invites enable row level security;

create policy "invites: admin manage" on public.organizer_invites
  for all using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

-- A.4 organizer_membership_events --------------------------------------------
--
-- Append-only — writes go through the audit-emitting RPCs running as
-- service role. Members can read the log for their own company.

alter table public.organizer_membership_events enable row level security;

create policy "membership_events: member read" on public.organizer_membership_events
  for select using (public.is_company_member(company_id));

-- ============================================================================
-- B. Rewrite existing organizer-scoped policies to admit the company branch.
--
-- For every existing policy we drop the current definition (recreated by
-- 20260505010000_p1_rls_initplan_sweep.sql for most, by 20260504071000 for
-- the marketplace ones, and by 20260504080000 for qpr: organizer read /
-- organizer cancel / supplier read / supplier fulfill which the p1 sweep
-- did not touch) and recreate it with the OR-predicate.
-- ============================================================================

-- B.1 events: owner all ------------------------------------------------------
-- Source: 20260505010000_p1_rls_initplan_sweep.sql:174-178
--   using (organizer_id = (select auth.uid()))
--   with check (organizer_id = (select auth.uid()))

drop policy if exists "events: owner all" on public.events;
create policy "events: owner all" on public.events
  for all to public
  using (
    (events.company_id is null and events.organizer_id = (select auth.uid()))
    or public.is_company_member(events.company_id)
  )
  with check (
    (events.company_id is null and events.organizer_id = (select auth.uid()))
    or public.is_company_member(events.company_id)
  );

-- B.2 rfqs: organizer all ----------------------------------------------------
-- Source: 20260505010000_p1_rls_initplan_sweep.sql:403-411
--   using EXISTS (events e WHERE e.id = rfqs.event_id AND e.organizer_id = uid())
--
-- Two-branch predicate: the rfq either inherits ownership via the event
-- (legacy individual flow) or carries the company directly (new flow).

drop policy if exists "rfqs: organizer all" on public.rfqs;
create policy "rfqs: organizer all" on public.rfqs
  for all to public
  using (
    (rfqs.company_id is null and exists (
      select 1 from public.events e
       where e.id = rfqs.event_id
         and e.organizer_id = (select auth.uid())
    ))
    or public.is_company_member(rfqs.company_id)
  )
  with check (
    (rfqs.company_id is null and exists (
      select 1 from public.events e
       where e.id = rfqs.event_id
         and e.organizer_id = (select auth.uid())
    ))
    or public.is_company_member(rfqs.company_id)
  );

-- B.3 rfq_invites: organizer read + organizer write --------------------------
-- Source: 20260505010000_p1_rls_initplan_sweep.sql:352-370
-- Reach rfqs.company_id via the existing join chain.

drop policy if exists "rfq_invites: organizer read" on public.rfq_invites;
create policy "rfq_invites: organizer read" on public.rfq_invites
  for select to public
  using (
    exists (
      select 1
        from public.rfqs r
        join public.events e on e.id = r.event_id
       where r.id = rfq_invites.rfq_id
         and (
           (r.company_id is null and e.organizer_id = (select auth.uid()))
           or public.is_company_member(r.company_id)
         )
    )
  );

drop policy if exists "rfq_invites: organizer write" on public.rfq_invites;
create policy "rfq_invites: organizer write" on public.rfq_invites
  for all to public
  using (
    exists (
      select 1
        from public.rfqs r
        join public.events e on e.id = r.event_id
       where r.id = rfq_invites.rfq_id
         and (
           (r.company_id is null and e.organizer_id = (select auth.uid()))
           or public.is_company_member(r.company_id)
         )
    )
  )
  with check (
    exists (
      select 1
        from public.rfqs r
        join public.events e on e.id = r.event_id
       where r.id = rfq_invites.rfq_id
         and (
           (r.company_id is null and e.organizer_id = (select auth.uid()))
           or public.is_company_member(r.company_id)
         )
    )
  );

-- B.4 quotes: organizer read + organizer accept/reject -----------------------
-- Source: 20260505010000_p1_rls_initplan_sweep.sql:297-320

drop policy if exists "quotes: organizer read" on public.quotes;
create policy "quotes: organizer read" on public.quotes
  for select to public
  using (
    exists (
      select 1
        from public.rfqs r
        join public.events e on e.id = r.event_id
       where r.id = quotes.rfq_id
         and (
           (r.company_id is null and e.organizer_id = (select auth.uid()))
           or public.is_company_member(r.company_id)
         )
    )
  );

drop policy if exists "quotes: organizer accept/reject" on public.quotes;
create policy "quotes: organizer accept/reject" on public.quotes
  for update to public
  using (
    exists (
      select 1
        from public.rfqs r
        join public.events e on e.id = r.event_id
       where r.id = quotes.rfq_id
         and (
           (r.company_id is null and e.organizer_id = (select auth.uid()))
           or public.is_company_member(r.company_id)
         )
    )
  )
  with check (
    exists (
      select 1
        from public.rfqs r
        join public.events e on e.id = r.event_id
       where r.id = quotes.rfq_id
         and (
           (r.company_id is null and e.organizer_id = (select auth.uid()))
           or public.is_company_member(r.company_id)
         )
    )
  );

-- B.5 quote_revisions: organizer read ----------------------------------------
-- Source: 20260505010000_p1_rls_initplan_sweep.sql:272-279

drop policy if exists "quote_revisions: organizer read" on public.quote_revisions;
create policy "quote_revisions: organizer read" on public.quote_revisions
  for select to public
  using (
    exists (
      select 1
        from public.quotes q
        join public.rfqs r on r.id = q.rfq_id
        join public.events e on e.id = r.event_id
       where q.id = quote_revisions.quote_id
         and (
           (r.company_id is null and e.organizer_id = (select auth.uid()))
           or public.is_company_member(r.company_id)
         )
    )
  );

-- B.6 bookings: organizer all ------------------------------------------------
-- Source: 20260505010000_p1_rls_initplan_sweep.sql:101-105

drop policy if exists "bookings: organizer all" on public.bookings;
create policy "bookings: organizer all" on public.bookings
  for all to public
  using (
    (bookings.company_id is null and bookings.organizer_id = (select auth.uid()))
    or public.is_company_member(bookings.company_id)
  )
  with check (
    (bookings.company_id is null and bookings.organizer_id = (select auth.uid()))
    or public.is_company_member(bookings.company_id)
  );

-- B.7 disputes: party read + party open --------------------------------------
-- Source: 20260505010000_p1_rls_initplan_sweep.sql:153-167
-- The organizer-party branch grows the company OR-clause. The supplier-party
-- branch is unchanged.

drop policy if exists "disputes: party read" on public.disputes;
create policy "disputes: party read" on public.disputes
  for select to public
  using (
    exists (
      select 1
        from public.bookings b
        left join public.suppliers s on s.id = b.supplier_id
       where b.id = disputes.booking_id
         and (
           (b.company_id is null and b.organizer_id = (select auth.uid()))
           or public.is_company_member(b.company_id)
           or s.profile_id = (select auth.uid())
         )
    )
  );

drop policy if exists "disputes: party open" on public.disputes;
create policy "disputes: party open" on public.disputes
  for insert to public
  with check (
    exists (
      select 1
        from public.bookings b
        left join public.suppliers s on s.id = b.supplier_id
       where b.id = disputes.booking_id
         and (
           (b.company_id is null and b.organizer_id = (select auth.uid()))
           or public.is_company_member(b.company_id)
           or s.profile_id = (select auth.uid())
         )
    )
    and disputes.raised_by = (select auth.uid())
  );

-- B.8 dispute_evidence: party read + party write -----------------------------
-- Source: 20260505010000_p1_rls_initplan_sweep.sql:129-145

drop policy if exists "dispute_evidence: party read" on public.dispute_evidence;
create policy "dispute_evidence: party read" on public.dispute_evidence
  for select to public
  using (
    exists (
      select 1
        from public.disputes d
        join public.bookings b on b.id = d.booking_id
        left join public.suppliers s on s.id = b.supplier_id
       where d.id = dispute_evidence.dispute_id
         and (
           (b.company_id is null and b.organizer_id = (select auth.uid()))
           or public.is_company_member(b.company_id)
           or s.profile_id = (select auth.uid())
         )
         and (
           dispute_evidence.visible_to_other_party
           or dispute_evidence.submitted_by = (select auth.uid())
         )
    )
  );

drop policy if exists "dispute_evidence: party write" on public.dispute_evidence;
create policy "dispute_evidence: party write" on public.dispute_evidence
  for insert to public
  with check (
    dispute_evidence.submitted_by = (select auth.uid())
    and exists (
      select 1
        from public.disputes d
        join public.bookings b on b.id = d.booking_id
        left join public.suppliers s on s.id = b.supplier_id
       where d.id = dispute_evidence.dispute_id
         and (
           (b.company_id is null and b.organizer_id = (select auth.uid()))
           or public.is_company_member(b.company_id)
           or s.profile_id = (select auth.uid())
         )
    )
  );

-- B.9 quote_proposal_requests ------------------------------------------------
-- Sources:
--   * "qpr: organizer read"   from 20260504080000_quote_proposal_requests.sql:104
--   * "qpr: organizer insert" from 20260505010000_p1_rls_initplan_sweep.sql:262
--   * "qpr: organizer cancel" from 20260504080000_quote_proposal_requests.sql:120
--
-- These all currently delegate to caller_owns_quote_as_organizer(quote_id),
-- which joins quotes → rfqs → events and matches e.organizer_id = auth.uid().
-- To admit the company branch without rewriting the helper (it's a
-- SECURITY DEFINER fixture used by the supplier-side policies too), we
-- combine the helper with the new column predicate via OR.

drop policy if exists "qpr: organizer read" on public.quote_proposal_requests;
create policy "qpr: organizer read" on public.quote_proposal_requests
  for select to public
  using (
    public.caller_owns_quote_as_organizer(quote_proposal_requests.quote_id)
    or public.is_company_member(quote_proposal_requests.company_id)
  );

drop policy if exists "qpr: organizer insert" on public.quote_proposal_requests;
create policy "qpr: organizer insert" on public.quote_proposal_requests
  for insert to public
  with check (
    (
      public.caller_owns_quote_as_organizer(quote_proposal_requests.quote_id)
      or public.is_company_member(quote_proposal_requests.company_id)
    )
    and quote_proposal_requests.requested_by = (select auth.uid())
  );

drop policy if exists "qpr: organizer cancel" on public.quote_proposal_requests;
create policy "qpr: organizer cancel" on public.quote_proposal_requests
  for update to public
  using (
    public.caller_owns_quote_as_organizer(quote_proposal_requests.quote_id)
    or public.is_company_member(quote_proposal_requests.company_id)
  )
  with check (
    public.caller_owns_quote_as_organizer(quote_proposal_requests.quote_id)
    or public.is_company_member(quote_proposal_requests.company_id)
  );

-- ============================================================================
-- C. Contracts storage bucket — rewrite booking-party SELECT to admit
--    company members.
--
-- Source: 20260512110000_contracts_party_read_rls.sql:25-39
--
-- Path layout (set by src/lib/contracts/uploadAndPersist.ts):
--   contracts/{bookingId}/{accepted_quote_revision_id}.pdf
-- ============================================================================

drop policy if exists "contracts: booking-party read" on storage.objects;
create policy "contracts: booking-party read" on storage.objects
  for select to public
  using (
    bucket_id = 'contracts'
    and exists (
      select 1
        from public.bookings b
        left join public.suppliers s on s.id = b.supplier_id
       where b.id::text = split_part(name, '/', 1)
         and (
           (b.company_id is null and b.organizer_id = (select auth.uid()))
           or public.is_company_member(b.company_id)
           or s.profile_id = (select auth.uid())
         )
    )
  );

notify pgrst, 'reload schema';
