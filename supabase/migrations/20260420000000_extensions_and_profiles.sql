-- Sevent · migration 0001: extensions + profiles + role enum + signup trigger.
-- Sprint 1 · task S1-3. Remaining v1 tables land in migration 0002 (task S1-4).

-- =============================================================================
-- Extensions
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists btree_gist;
create extension if not exists postgis;
-- pg_cron lives in the `extensions` schema on Supabase local stack.
create extension if not exists pg_cron with schema extensions;

-- =============================================================================
-- Enums
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'sevent_role') then
    create type public.sevent_role as enum (
      'organizer',
      'supplier',
      'admin',
      'agency'
    );
  end if;
end
$$;

-- =============================================================================
-- profiles
-- One row per auth.users row, created via the trigger below.
-- =============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.sevent_role not null default 'organizer',
  full_name text,
  phone text,
  language text not null default 'en' check (language in ('en', 'ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

comment on table public.profiles is
  'Extension of auth.users with Sevent role + locale. Populated on signup by handle_new_user().';
comment on column public.profiles.role is
  'Active role for the account. Can be changed by admin only.';

-- =============================================================================
-- Signup trigger
-- On every new auth.users insert, create a profiles row. The desired role is
-- read from the signup metadata (user_metadata.role). Defaults to 'organizer'.
-- Admin role cannot be self-assigned; the trigger rejects that and falls back
-- to 'organizer' so admin privilege is only granted manually.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  resolved_role public.sevent_role;
  resolved_full_name text;
  resolved_phone text;
  resolved_language text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'organizer');
  if requested_role = 'admin' then
    resolved_role := 'organizer';
  elsif requested_role in ('organizer', 'supplier', 'agency') then
    resolved_role := requested_role::public.sevent_role;
  else
    resolved_role := 'organizer';
  end if;

  resolved_full_name := new.raw_user_meta_data ->> 'full_name';
  resolved_phone := new.raw_user_meta_data ->> 'phone';
  resolved_language := coalesce(new.raw_user_meta_data ->> 'language', 'en');
  if resolved_language not in ('en', 'ar') then
    resolved_language := 'en';
  end if;

  insert into public.profiles (id, role, full_name, phone, language)
  values (new.id, resolved_role, resolved_full_name, resolved_phone, resolved_language)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- updated_at auto-maintenance helper (reused by future tables)
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.profiles enable row level security;

drop policy if exists "profiles: self read" on public.profiles;
create policy "profiles: self read"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self update"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Prevent self-promotion: block role changes by anyone except an admin.
    and (
      role = (select role from public.profiles where id = auth.uid())
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin'
      )
    )
  );

drop policy if exists "profiles: admin full read" on public.profiles;
create policy "profiles: admin full read"
  on public.profiles
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "profiles: admin full write" on public.profiles;
create policy "profiles: admin full write"
  on public.profiles
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Helper used by later migrations.
create or replace function public.current_user_role()
returns public.sevent_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;
