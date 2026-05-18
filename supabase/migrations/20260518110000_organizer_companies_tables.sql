-- =============================================================================
-- 20260518110000 — Organizer companies: four new tables + indexes + triggers.
--
-- PR 1 of the multi-user company-organizer refactor.
--
-- Tables created (in dependency order):
--   1. organizer_companies         — one row per company entity.
--   2. organizer_memberships       — (company_id, profile_id) join table;
--                                    soft-delete via removed_at to keep the
--                                    composite-FK actor-is-member invariant
--                                    cascade-safe.
--   3. organizer_invites           — sha256-tokened email invites.
--   4. organizer_membership_events — append-only audit log.
--
-- RLS is NOT enabled here. See migration 20260518130000 for policies.
--
-- After the four tables exist, this migration attaches the FK on
-- profiles.last_active_company_id (declared as a plain uuid in 20260518100000)
-- to organizer_companies(id) with ON DELETE SET NULL.
-- =============================================================================

set search_path = public;

-- 1. organizer_companies ------------------------------------------------------

create table public.organizer_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_ar text,
  slug text not null unique,
  cr_number text,
  vat_number text,
  billing_email text,
  logo_path text,
  default_language text not null default 'en' check (default_language in ('en', 'ar')),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizer_companies_created_by_idx
  on public.organizer_companies (created_by);

create trigger organizer_companies_set_updated_at
  before update on public.organizer_companies
  for each row execute function public.set_updated_at();

-- 2. organizer_memberships ----------------------------------------------------

create table public.organizer_memberships (
  company_id uuid not null references public.organizer_companies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_member_role not null,
  invited_by uuid references public.profiles (id),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (company_id, profile_id)
);

-- Exactly one active owner per company. removed_at IS NULL excludes
-- soft-deleted memberships so a previous owner can be left around for audit.
create unique index organizer_memberships_one_active_owner_idx
  on public.organizer_memberships (company_id)
  where role = 'owner' and removed_at is null;

-- Reverse lookup for the RLS hot path: WHERE profile_id = auth.uid().
-- The PK alone (company_id, profile_id) cannot serve this — we need
-- profile_id as the leading column. INCLUDE keeps it an index-only scan.
create index organizer_memberships_profile_idx
  on public.organizer_memberships (profile_id, removed_at)
  include (company_id, role);

-- 3. organizer_invites --------------------------------------------------------

create table public.organizer_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.organizer_companies (id) on delete cascade,
  email text not null,
  role public.org_member_role not null check (role <> 'owner'),
  token_hash text not null,
  status public.org_invite_status not null default 'pending',
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index organizer_invites_company_status_idx
  on public.organizer_invites (company_id, status);

-- One pending invite per (company, email). Re-issue after revoke/accept is
-- naturally permitted because the partial predicate excludes those rows.
create unique index organizer_invites_one_pending_per_email_idx
  on public.organizer_invites (company_id, lower(email))
  where status = 'pending';

-- 4. organizer_membership_events ---------------------------------------------

create table public.organizer_membership_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.organizer_companies (id) on delete cascade,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  target_profile_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in (
    'joined',
    'left',
    'removed',
    'role_changed',
    'ownership_transferred',
    'invited',
    'invite_revoked',
    'invite_accepted'
  )),
  from_role public.org_member_role,
  to_role public.org_member_role,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index organizer_membership_events_company_idx
  on public.organizer_membership_events (company_id, created_at desc);

-- 5. Attach the deferred FK on profiles.last_active_company_id ----------------
--
-- The column was added in 20260518100000 as a plain uuid because
-- organizer_companies didn't exist yet. Now we can wire the FK with
-- ON DELETE SET NULL — if a company is deleted, the user's "last active"
-- pointer is cleared (not blocked).

alter table public.profiles
  add constraint profiles_last_active_company_fk
  foreign key (last_active_company_id)
  references public.organizer_companies (id)
  on delete set null;
