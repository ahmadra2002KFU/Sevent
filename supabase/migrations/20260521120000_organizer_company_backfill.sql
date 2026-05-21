-- =============================================================================
-- 20260521120000 — Backfill company_id on existing organizer rows.
--
-- Context: the multi-user organizer-company feature (migrations 20260518*–
-- 20260519*) added a nullable `company_id` to events / rfqs / bookings /
-- disputes / quote_proposal_requests but explicitly deferred the data backfill
-- (see 20260518111000). Combined with the app still writing company_id = NULL,
-- this left every company's opportunities visible only to the individual who
-- created them. The app write + read paths are now company-aware; this
-- migration backfills the historical rows so they become visible to the whole
-- company too.
--
-- SAFETY / SCOPE
--   * Only rows whose creator is a current member of EXACTLY ONE company are
--     backfilled — that mapping is unambiguous. Creators in zero or multiple
--     companies are left untouched (company_id stays NULL → behaves as an
--     individual row, exactly as before).
--   * Each UPDATE sets `company_id` together with the matching actor column so
--     the composite FKs from 20260518112000
--     (events: (company_id, organizer_id); rfqs/bookings/qpr:
--     (company_id, actor_profile_id); disputes: (company_id, raised_by)) are
--     satisfied. Those FKs are DEFERRABLE INITIALLY DEFERRED, so they validate
--     at COMMIT — every row written here points at a real membership.
--   * Idempotent: every statement is guarded by `company_id IS NULL`, so a
--     re-run is a no-op.
--   * No-op on environments with no companies / no rows (e.g. fresh local).
--
-- ORDER: events first (it is the source of truth other tables inherit from),
-- then bookings (own organizer_id), then rfqs (inherits event.company_id),
-- disputes (inherits booking.company_id), and qpr (inherits event.company_id).
-- =============================================================================

set search_path = public;

-- Reusable mapping: profile_id → its sole active company.
-- `(array_agg(...))[1]` rather than max(): there is no max(uuid), and the
-- HAVING count(*) = 1 guarantees the aggregate sees exactly one company_id.
create temporary table _sole_company on commit drop as
select profile_id, (array_agg(company_id))[1] as company_id
  from public.organizer_memberships
 where removed_at is null
 group by profile_id
having count(*) = 1;

-- 1. events — the individual creator's sole company.
update public.events e
   set company_id = sc.company_id
  from _sole_company sc
 where e.organizer_id = sc.profile_id
   and e.company_id is null;

-- 2. bookings — same rule on the booking's organizer_id; stamp the actor too.
update public.bookings b
   set company_id = sc.company_id,
       actor_profile_id = b.organizer_id
  from _sole_company sc
 where b.organizer_id = sc.profile_id
   and b.company_id is null;

-- 3. rfqs — inherit the parent event's freshly-set company; the event's
--    organizer is a member of that company (step 1 guarantees it), so it is a
--    valid actor for the composite FK.
update public.rfqs r
   set company_id = e.company_id,
       actor_profile_id = e.organizer_id
  from public.events e
 where r.event_id = e.id
   and e.company_id is not null
   and r.company_id is null;

-- 4. disputes — inherit the booking's company, but only when the dispute's
--    raiser is an organizer member of it (the supplier party can also raise
--    disputes, and a supplier is not a membership row → would break the FK).
update public.disputes d
   set company_id = b.company_id
  from public.bookings b
 where d.booking_id = b.id
   and b.company_id is not null
   and d.company_id is null
   and exists (
     select 1
       from public.organizer_memberships m
      where m.company_id = b.company_id
        and m.profile_id = d.raised_by
        and m.removed_at is null
   );

-- 5. quote_proposal_requests — inherit the event's company via quote → rfq →
--    event, stamping the requester as actor (guarded on membership).
update public.quote_proposal_requests qpr
   set company_id = e.company_id,
       actor_profile_id = qpr.requested_by
  from public.quotes q
  join public.rfqs r on r.id = q.rfq_id
  join public.events e on e.id = r.event_id
 where qpr.quote_id = q.id
   and e.company_id is not null
   and qpr.company_id is null
   and exists (
     select 1
       from public.organizer_memberships m
      where m.company_id = e.company_id
        and m.profile_id = qpr.requested_by
        and m.removed_at is null
   );
