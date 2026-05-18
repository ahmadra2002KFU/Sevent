-- =============================================================================
-- 20260518100000 — Organizer companies: enums + profiles columns.
--
-- PR 1 of the multi-user company-organizer refactor.
--
-- This migration is intentionally additive and isolated to enum types + two
-- nullable columns on profiles. No tables are created here — see migration
-- 20260518110000 for the four new tables (organizer_companies,
-- organizer_memberships, organizer_invites, organizer_membership_events).
--
-- Design notes:
--   * `organizer_legal_type` is added as a NULLABLE column on profiles.
--     NULL means "not declared / behave as an existing individual organizer".
--     This is a one-column gate for the post-signup onboarding flow even
--     before any membership row exists, so we don't derive it from memberships.
--   * `last_active_company_id` is the third-priority fallback in the active-
--     company resolver (after signed query-param and HttpOnly cookie). We add
--     it as a plain uuid here; the FK to organizer_companies(id) ON DELETE SET
--     NULL is attached in migration 20260518110000 once that table exists.
--   * No changes to `sevent_role` — companies live alongside the existing
--     enum, not as a new role.
-- =============================================================================

set search_path = public;

-- 1. Enums --------------------------------------------------------------------

create type public.organizer_legal_type as enum ('individual', 'company');
create type public.org_member_role      as enum ('owner', 'admin', 'member');
create type public.org_invite_status    as enum ('pending', 'accepted', 'revoked', 'expired');

-- 2. profiles columns ---------------------------------------------------------

alter table public.profiles
  add column organizer_legal_type public.organizer_legal_type;

alter table public.profiles
  add column last_active_company_id uuid;

comment on column public.profiles.organizer_legal_type is
  'NULL = not declared (behave as individual). Set to ''individual'' or ''company'' via the post-signup onboarding choice.';
comment on column public.profiles.last_active_company_id is
  'Fallback signal for active-company resolution. FK to organizer_companies attached in 20260518110000.';
