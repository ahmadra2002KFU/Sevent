-- =============================================================================
-- 20260518112000 — Organizer companies: composite FKs for the
--                  "actor must be a current member of company_id" invariant.
--
-- PR 1 of the multi-user company-organizer refactor.
--
-- Reviewer correction: a composite FK is cheaper than a deferred trigger
-- (~0.05ms vs 0.3–0.5ms per insert, single btree probe, no PL/pgSQL frame)
-- and Postgres-native.
--
-- Each FK matches a TUPLE (company_id, actor_id) against organizer_memberships'
-- primary key (company_id, profile_id). Postgres's default MATCH SIMPLE
-- semantics for composite FKs treat a tuple containing any NULL as "no
-- match required" — so individual organizers (company_id = NULL) pass through
-- unchecked while company organizers must have a current membership row.
--
-- Why soft-delete on memberships matters: this FK keys on the PK, not on
-- (removed_at IS NULL). A removed member's row stays in the table, so the
-- FK still resolves. The "currently a member" check is enforced at the RLS
-- and RPC layers (which join with `removed_at IS NULL`), not by this FK.
-- This keeps the invariant cheap AND keeps audit history intact — a
-- hard-DELETE would cascade-block every event/booking the member ever
-- touched.
--
-- DEFERRABLE INITIALLY DEFERRED so transactional RPCs that insert both
-- the membership row AND the company-scoped row in the same transaction
-- (e.g. create_organizer_company_tx) don't trip the constraint mid-statement.
--
-- Actor column per table:
--   events                   (company_id, organizer_id)
--   bookings                 (company_id, actor_profile_id)
--   rfqs                     (company_id, actor_profile_id)
--   disputes                 (company_id, raised_by)
--   quote_proposal_requests  (company_id, actor_profile_id)
-- =============================================================================

set search_path = public;

-- 1. events -------------------------------------------------------------------

alter table public.events
  add constraint events_actor_is_company_member_fk
  foreign key (company_id, organizer_id)
  references public.organizer_memberships (company_id, profile_id)
  deferrable initially deferred;

-- 2. bookings -----------------------------------------------------------------

alter table public.bookings
  add constraint bookings_actor_is_company_member_fk
  foreign key (company_id, actor_profile_id)
  references public.organizer_memberships (company_id, profile_id)
  deferrable initially deferred;

-- 3. rfqs ---------------------------------------------------------------------

alter table public.rfqs
  add constraint rfqs_actor_is_company_member_fk
  foreign key (company_id, actor_profile_id)
  references public.organizer_memberships (company_id, profile_id)
  deferrable initially deferred;

-- 4. disputes -----------------------------------------------------------------

alter table public.disputes
  add constraint disputes_actor_is_company_member_fk
  foreign key (company_id, raised_by)
  references public.organizer_memberships (company_id, profile_id)
  deferrable initially deferred;

-- 5. quote_proposal_requests --------------------------------------------------

alter table public.quote_proposal_requests
  add constraint quote_proposal_requests_actor_is_company_member_fk
  foreign key (company_id, actor_profile_id)
  references public.organizer_memberships (company_id, profile_id)
  deferrable initially deferred;
