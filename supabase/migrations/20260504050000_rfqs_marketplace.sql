-- =============================================================================
-- 20260504050000 — RFQ marketplace: schema (column, enum value, index)
--
-- Split from the original combined migration because Postgres refuses to use
-- a newly-added enum value in the same transaction as the ALTER TYPE that
-- added it (SQLSTATE 55P04 `unsafe use of new value`). The self-apply RLS
-- policy in 20260504051000_rfqs_marketplace_rls.sql references 'self_applied'
-- so it had to land in its own migration that runs after this one commits.
--
-- Three coordinated schema changes:
--   1. `rfqs.is_published_to_marketplace boolean` — per-RFQ publish flag.
--      NEW RFQs default to TRUE (user chose "ON by default, organizer opts
--      out"). Existing rows are backfilled to FALSE so yesterday's private
--      RFQs aren't retroactively exposed.
--   2. `rfq_invite_source` enum += 'self_applied' — written by a supplier's
--      marketplace Apply click. Existing sources ('auto_match',
--      'organizer_picked') stay put.
--   3. Partial index on `rfqs(is_published_to_marketplace, status, sent_at desc)`
--      to support the marketplace browse query.
-- =============================================================================

set search_path = public;

-- 1. is_published_to_marketplace ---------------------------------------------

-- Add with a SAFE default (false) first, backfill every existing row, then
-- flip the default to true so NEW inserts are published by default. This
-- sequence avoids surprise-publishing the entire historical RFQ dataset the
-- moment this migration runs.
alter table public.rfqs
  add column if not exists is_published_to_marketplace boolean not null default false;

update public.rfqs
   set is_published_to_marketplace = false
 where is_published_to_marketplace is null;

alter table public.rfqs
  alter column is_published_to_marketplace set default true;

create index if not exists rfqs_marketplace_browse_idx
  on public.rfqs (is_published_to_marketplace, status, sent_at desc)
  where is_published_to_marketplace;

-- 2. rfq_invite_source += 'self_applied' -------------------------------------

alter type public.rfq_invite_source add value if not exists 'self_applied';
