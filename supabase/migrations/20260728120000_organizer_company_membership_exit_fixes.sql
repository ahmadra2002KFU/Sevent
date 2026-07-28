-- =============================================================================
-- 20260728120000 — Organizer companies: membership-exit fixes.
--
-- Fixes the "removed member is locked out of the product" trap found in the
-- 2026-07-28 teams/companies review (finding F1).
--
-- THE TRAP
--   `remove_company_member_tx` cleared `profiles.last_active_company_id` but
--   left `profiles.organizer_legal_type = 'company'`. A user whose ONLY
--   membership was removed therefore ended up with:
--
--       organizer_legal_type = 'company'  AND  0 active memberships
--
--   which `buildOrganizerDecision` (src/lib/auth/access.ts) maps to the
--   `organizer.no_company` access state. That state's allowedRoutePrefixes are
--   only /organizer/onboarding/company, /invite/organizer, /auth, /sign-out —
--   so the user could no longer reach their dashboard, lost sight of their own
--   individual (company_id IS NULL) events and bookings, and had no route back
--   to the path picker to re-declare as an individual. The only escape was
--   creating a brand-new company.
--
-- THE FIX
--   1. `remove_company_member_tx` now resets `organizer_legal_type` to NULL
--      when the removed member has no remaining ACTIVE membership. NULL is the
--      "not declared" value: the resolver maps it to `organizer.active`, the
--      dashboard comes back, individual rows are visible again, and the
--      dismissible onboarding banner offers a clean re-entry into company
--      creation. We deliberately do NOT write 'individual' — that would assert
--      a choice the user never made and would suppress the banner.
--
--   2. A one-time backfill frees anyone already trapped by the old behaviour.
--
-- Both parts are idempotent. Part 2 is a no-op on environments where no member
-- has ever been removed.
--
-- Everything else about the function — the admin/owner precondition, the
-- admin-cannot-remove-admin guard (P0059), the sole-owner guard (P0044), the
-- soft delete, the last_active_company_id clear and the audit row — is
-- unchanged from 20260519120000.
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. remove_company_member_tx — reset legal type on last-membership exit.
-- ---------------------------------------------------------------------------

create or replace function public.remove_company_member_tx(
  p_company_id uuid,
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.org_member_role;
  v_target_role public.org_member_role;
  v_active_owner_count int;
  v_remaining_memberships int;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  select role
    into v_target_role
    from public.organizer_memberships
   where company_id = p_company_id
     and profile_id = p_target_profile_id
     and removed_at is null
     for update;
  if not found then
    raise exception 'member_not_found:%', p_target_profile_id using errcode = 'P0049';
  end if;

  if p_actor_profile_id <> p_target_profile_id then
    select role into v_actor_role
      from public.organizer_memberships
     where company_id = p_company_id
       and profile_id = p_actor_profile_id
       and removed_at is null;
    if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
      raise exception 'not_company_admin:%', p_actor_profile_id using errcode = 'P0045';
    end if;

    -- PR 7 audit finding #3: admins can't remove another admin. Only owners
    -- can. (Self-remove is still permitted regardless of role via the
    -- outer `<>` branch.)
    if v_actor_role = 'admin' and v_target_role = 'admin' then
      raise exception 'admin_cannot_remove_admin' using errcode = 'P0059';
    end if;
  end if;

  -- Sole-owner guard runs regardless of actor (self or not) so an owner
  -- cannot accidentally orphan the company.
  if v_target_role = 'owner' then
    select count(*) into v_active_owner_count
      from public.organizer_memberships
     where company_id = p_company_id
       and role = 'owner'
       and removed_at is null;
    if v_active_owner_count <= 1 then
      raise exception 'cannot_remove_sole_owner' using errcode = 'P0044';
    end if;
  end if;

  update public.organizer_memberships
     set removed_at = now()
   where company_id = p_company_id
     and profile_id = p_target_profile_id;

  update public.profiles
     set last_active_company_id = null
   where id = p_target_profile_id
     and last_active_company_id = p_company_id;

  -- F1: if that was the target's last active membership, drop them back to
  -- the undeclared state so the resolver yields `organizer.active` instead of
  -- the route-restricted `organizer.no_company`. Counted AFTER the soft delete
  -- above, so the row we just retired is already excluded.
  select count(*)
    into v_remaining_memberships
    from public.organizer_memberships
   where profile_id = p_target_profile_id
     and removed_at is null;

  if v_remaining_memberships = 0 then
    update public.profiles
       set organizer_legal_type = null
     where id = p_target_profile_id
       and organizer_legal_type = 'company';
  end if;

  insert into public.organizer_membership_events (
    company_id, actor_profile_id, target_profile_id, action, from_role, metadata
  ) values (
    p_company_id,
    p_actor_profile_id,
    p_target_profile_id,
    case when p_actor_profile_id = p_target_profile_id then 'left' else 'removed' end,
    v_target_role,
    case when p_reason is null then '{}'::jsonb else jsonb_build_object('reason', p_reason) end
  );
end
$$;

revoke all on function public.remove_company_member_tx(uuid, uuid, uuid, text) from public;
grant execute on function public.remove_company_member_tx(uuid, uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. One-time backfill — free anyone already trapped.
--
--    Any profile still flagged as a company organizer with zero active
--    memberships got there through the old code path (or through a company
--    row being deleted out from under them). Reset them to the undeclared
--    state so their next request resolves to `organizer.active`.
--
--    Guarded on role='organizer' because `organizer_legal_type` is meaningless
--    for other roles, and on the exact 'company' value so declared individuals
--    are untouched. Idempotent: a re-run matches nothing.
-- ---------------------------------------------------------------------------

update public.profiles p
   set organizer_legal_type = null
 where p.role = 'organizer'
   and p.organizer_legal_type = 'company'
   and not exists (
     select 1
       from public.organizer_memberships m
      where m.profile_id = p.id
        and m.removed_at is null
   );

-- ---------------------------------------------------------------------------
-- 3. reset_orphaned_company_legal_type — on-demand self-heal.
--
--    Parts 1 and 2 cover every route into the trap that exists today, but the
--    invariant "legal_type='company' ⇒ at least one active membership" is not
--    enforced by a constraint, so a future code path (a company-delete flow,
--    a manual data fix) could reintroduce it. This RPC lets the path picker
--    heal the caller's own row before deciding whether to bounce them.
--
--    Race-free by construction: the NOT EXISTS runs inside the same UPDATE
--    statement, so a concurrent create_organizer_company_tx either commits
--    first (a membership exists → this matches nothing) or commits second
--    (it writes 'company' over our NULL → also correct). Returns true when a
--    row was actually healed.
-- ---------------------------------------------------------------------------

create or replace function public.reset_orphaned_company_legal_type(
  p_profile_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  update public.profiles p
     set organizer_legal_type = null
   where p.id = p_profile_id
     and p.role = 'organizer'
     and p.organizer_legal_type = 'company'
     and not exists (
       select 1
         from public.organizer_memberships m
        where m.profile_id = p.id
          and m.removed_at is null
     );

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end
$$;

revoke all on function public.reset_orphaned_company_legal_type(uuid) from public;
grant execute on function public.reset_orphaned_company_legal_type(uuid) to service_role;
