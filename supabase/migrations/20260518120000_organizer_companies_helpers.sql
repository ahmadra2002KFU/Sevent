-- =============================================================================
-- 20260518120000 — Organizer companies: is_company_member / is_company_admin
--                  SQL helpers for RLS predicates.
--
-- PR 1 of the multi-user company-organizer refactor.
--
-- These helpers are intentionally NOT SECURITY DEFINER. Per the design
-- review, we rely on memberships being self-readable (a permissive
-- self-read policy on organizer_memberships is created in 20260518130000).
-- Avoiding SECURITY DEFINER means the helpers run with the caller's
-- privileges, so any RLS audit can reason about them with the same lens
-- it uses for every other policy expression.
--
-- STABLE allows the planner to inline the helper into RLS predicates and use
-- the membership indexes (organizer_memberships_profile_idx created in
-- 20260518110000). EXPLAIN should NOT show "FunctionScan" for these — verify
-- in the perf checks called out in the plan. (LEAKPROOF would be a further
-- planner hint but requires superuser; Supabase's postgres role isn't one.)
--
-- Explicit `set search_path = public, pg_catalog` blocks the schema-hijack
-- attack class (an attacker creating a same-named table in a writable
-- schema that the function would otherwise resolve to).
-- =============================================================================

set search_path = public;

-- 1. is_company_member --------------------------------------------------------

create or replace function public.is_company_member(_company_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_catalog
as $$
  select _company_id is not null and exists (
    select 1
      from public.organizer_memberships m
     where m.company_id = _company_id
       and m.profile_id = auth.uid()
       and m.removed_at is null
  );
$$;

-- 2. is_company_admin ---------------------------------------------------------

create or replace function public.is_company_admin(_company_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_catalog
as $$
  select _company_id is not null and exists (
    select 1
      from public.organizer_memberships m
     where m.company_id = _company_id
       and m.profile_id = auth.uid()
       and m.removed_at is null
       and m.role in ('owner', 'admin')
  );
$$;

-- 3. Grants -------------------------------------------------------------------

revoke all on function public.is_company_member(uuid) from public;
revoke all on function public.is_company_admin(uuid)  from public;

grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.is_company_admin(uuid)  to authenticated;

notify pgrst, 'reload schema';
