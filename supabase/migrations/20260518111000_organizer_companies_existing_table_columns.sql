-- =============================================================================
-- 20260518111000 — Organizer companies: add company_id / actor_profile_id
--                  columns to existing organizer-scoped tables.
--
-- PR 1 of the multi-user company-organizer refactor.
--
-- Tables touched:
--   * events                  — + company_id
--   * bookings                — + company_id, + actor_profile_id
--   * rfqs                    — + company_id, + actor_profile_id
--   * disputes                — + company_id
--   * quote_proposal_requests — + company_id, + actor_profile_id
--
-- FK semantics:
--   * company_id        → organizer_companies(id) ON DELETE RESTRICT.
--                         Deleting a company must not silently null the
--                         ownership of events / money-carrying bookings.
--   * actor_profile_id  → profiles(id) ON DELETE SET NULL. Recording who
--                         clicked. Distinct from the existing organizer_id /
--                         raised_by columns (those keep their existing
--                         semantics — see "Identity-rename rule" in the plan).
--
-- Indexes — the OR-predicate `(company_id IS NULL AND organizer_id = uid())
--   OR is_company_member(company_id)` cannot use one index for both branches,
-- so we add separate partial indexes for the individual and company paths.
-- RFQs already inherit ownership via `event_id → events.organizer_id`, so we
-- only add a company-side partial index for that table.
--
-- All new columns are nullable. Backfill is out of scope for PR 1 — existing
-- individual organizers keep company_id = NULL and behave unchanged.
-- =============================================================================

set search_path = public;

-- 1. events -------------------------------------------------------------------

alter table public.events
  add column company_id uuid references public.organizer_companies (id) on delete restrict;

create index events_organizer_individual_idx
  on public.events (organizer_id)
  where company_id is null;

create index events_company_idx
  on public.events (company_id)
  where company_id is not null;

-- 2. bookings -----------------------------------------------------------------

alter table public.bookings
  add column company_id uuid references public.organizer_companies (id) on delete restrict;

alter table public.bookings
  add column actor_profile_id uuid references public.profiles (id) on delete set null;

create index bookings_organizer_individual_idx
  on public.bookings (organizer_id)
  where company_id is null;

create index bookings_company_idx
  on public.bookings (company_id)
  where company_id is not null;

-- 3. rfqs ---------------------------------------------------------------------
--
-- Denormalisation: rfqs already inherits ownership via event_id → events.
-- We carry company_id directly to avoid a join in every RLS predicate.
-- No "individual" partial index — the existing rfqs policy is event-joined
-- anyway and the company branch is the one that benefits from a direct probe.

alter table public.rfqs
  add column company_id uuid references public.organizer_companies (id) on delete restrict;

alter table public.rfqs
  add column actor_profile_id uuid references public.profiles (id) on delete set null;

create index rfqs_company_idx
  on public.rfqs (company_id)
  where company_id is not null;

-- 4. disputes -----------------------------------------------------------------

alter table public.disputes
  add column company_id uuid references public.organizer_companies (id) on delete restrict;

create index disputes_company_idx
  on public.disputes (company_id)
  where company_id is not null;

-- 5. quote_proposal_requests --------------------------------------------------

alter table public.quote_proposal_requests
  add column company_id uuid references public.organizer_companies (id) on delete restrict;

alter table public.quote_proposal_requests
  add column actor_profile_id uuid references public.profiles (id) on delete set null;

create index quote_proposal_requests_company_idx
  on public.quote_proposal_requests (company_id)
  where company_id is not null;
