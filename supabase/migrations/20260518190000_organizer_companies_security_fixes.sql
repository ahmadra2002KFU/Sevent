-- =============================================================================
-- 20260518190000 — Organizer companies: PR 1.5 security fixes.
--
-- Addresses findings from the 8-reviewer audit of PR 1 + PR 2:
--
--   #1  RLS bypass on memberships — the `FOR ALL` admin policy lets any
--       owner/admin INSERT/UPDATE/DELETE membership rows directly via
--       PostgREST, bypassing the lifecycle RPCs (sole-owner guard, audit
--       inserts, partial-unique-owner invariant under some race orderings).
--       Fix: replace the `FOR ALL` policy with SELECT-only. Writes go
--       through SECURITY DEFINER RPCs which run as service_role and
--       bypass RLS entirely, so the lockdown does not break legitimate
--       flows.
--
--   #2  NULL invite token bypass — `digest(NULL, 'sha256')` returns NULL
--       and `token_hash <> NULL` evaluates to NULL, so the IF never fires.
--       A caller passing a valid invite_id with `p_token = NULL` could
--       accept any pending invite. Fix: explicit null/empty guard upfront
--       and `IS DISTINCT FROM` for the hash comparison.
--
--   #3  Owner-transfer race vs concurrent member removal — transfer reads
--       the target membership without FOR UPDATE. A concurrent
--       remove_company_member_tx can soft-delete the target between the
--       read and the promote, leaving the company with zero active owners.
--       Fix: FOR UPDATE on both the from-user and to-user membership rows,
--       in deterministic profile_id order to avoid deadlock, with a
--       removed_at re-check after lock.
--
--   #4  Idempotent invite-already-member rollback — the original code did
--       `UPDATE invite SET status=accepted` then `RAISE EXCEPTION P0048`,
--       which aborted the transaction and rolled back the UPDATE. Same
--       pattern on the `expired` flip. Fix: raise without the UPDATE; the
--       lifecycle RPCs do not own status-reflecting side effects when the
--       caller's request is rejected.
--
--   Perf: helpers use `(select auth.uid())` so the planner treats it as an
--   initplan and evaluates once per query instead of per row. The current
--   bare `auth.uid()` is the documented Supabase anti-pattern for RLS.
--
-- All four function replacements keep the same signatures and errcodes —
-- this is a security/correctness patch, not an API change. Server actions
-- in PR 2 are unaffected.
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. Helpers — switch to `(select auth.uid())` for initplan inlining.
-- ---------------------------------------------------------------------------

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
       and m.profile_id = (select auth.uid())
       and m.removed_at is null
  );
$$;

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
       and m.profile_id = (select auth.uid())
       and m.removed_at is null
       and m.role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. RLS lockdown — memberships: admin manage (FOR ALL → SELECT only).
--
-- Audit finding #1: the original policy below admitted INSERT/UPDATE/DELETE
-- by any company admin via PostgREST, which would bypass every guard rail
-- in the lifecycle RPCs.
--
--   drop policy "memberships: admin manage"
--   create policy "memberships: admin manage"
--     for all
--     using (public.is_company_admin(company_id))
--     with check (public.is_company_admin(company_id))
--
-- The replacement collapses into the existing self-read policy + a new
-- admin-read policy. All mutations require service_role (i.e. a lifecycle
-- RPC). Direct INSERT/UPDATE/DELETE from `authenticated` is now denied.
-- ---------------------------------------------------------------------------

drop policy if exists "memberships: admin manage" on public.organizer_memberships;

-- The existing self-read policy already grants admin-read via
-- `is_company_admin(company_id)` (see 20260518130000_organizer_companies_rls.sql:60-64),
-- so we don't need a separate admin-read policy. We do nothing else here —
-- the absence of an INSERT/UPDATE/DELETE policy = no mutation permitted via
-- the authenticated role. service_role bypasses RLS.

-- ---------------------------------------------------------------------------
-- 3. transfer_company_ownership_tx — lock both membership rows + recheck.
-- ---------------------------------------------------------------------------

create or replace function public.transfer_company_ownership_tx(
  p_company_id uuid,
  p_from_profile_id uuid,
  p_to_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked uuid;
  v_from_role public.org_member_role;
  v_to_role public.org_member_role;
  v_lock_first uuid;
  v_lock_second uuid;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  -- Serialise on the company row first — prevents two concurrent transfers
  -- on the same company from racing.
  select id into v_locked
    from public.organizer_companies
   where id = p_company_id
     for update;
  if not found then
    raise exception 'company_not_found:%', p_company_id using errcode = 'P0041';
  end if;

  -- Lock the two membership rows in deterministic profile_id order so
  -- two transfers (or a transfer racing a removal) on the same company
  -- can't deadlock by acquiring locks in opposite orders.
  if p_from_profile_id < p_to_profile_id then
    v_lock_first  := p_from_profile_id;
    v_lock_second := p_to_profile_id;
  else
    v_lock_first  := p_to_profile_id;
    v_lock_second := p_from_profile_id;
  end if;

  -- Lock attempt + presence check. We don't filter on removed_at in the
  -- lock query because we need the lock even on a soft-deleted row so a
  -- concurrent reactivate is serialised against us. The role + removed_at
  -- checks happen on the values read under the lock.
  perform 1
    from public.organizer_memberships
   where company_id = p_company_id
     and profile_id in (v_lock_first, v_lock_second)
   order by profile_id
     for update;

  -- Re-read from-user under the lock.
  select role into v_from_role
    from public.organizer_memberships
   where company_id = p_company_id
     and profile_id = p_from_profile_id
     and removed_at is null;
  if v_from_role is null or v_from_role <> 'owner' then
    raise exception 'not_company_owner:%', p_from_profile_id using errcode = 'P0041';
  end if;

  -- Re-read to-user under the lock. The audit row needs the original role,
  -- so we capture it now (after the FOR UPDATE serialised any concurrent
  -- remove_company_member_tx).
  select role into v_to_role
    from public.organizer_memberships
   where company_id = p_company_id
     and profile_id = p_to_profile_id
     and removed_at is null;
  if v_to_role is null then
    raise exception 'target_not_company_member:%', p_to_profile_id using errcode = 'P0042';
  end if;

  -- Demote former owner first so the partial unique index
  -- (one active owner per company) never sees two active owners
  -- simultaneously inside the transaction.
  update public.organizer_memberships
     set role = 'admin'
   where company_id = p_company_id
     and profile_id = p_from_profile_id;

  update public.organizer_memberships
     set role = 'owner'
   where company_id = p_company_id
     and profile_id = p_to_profile_id;

  -- Audit.
  insert into public.organizer_membership_events (
    company_id, actor_profile_id, target_profile_id,
    action, from_role, to_role
  ) values
    (p_company_id, p_from_profile_id, p_from_profile_id, 'role_changed', 'owner', 'admin'),
    (p_company_id, p_from_profile_id, p_to_profile_id, 'ownership_transferred', v_to_role, 'owner');
end
$$;

revoke all on function public.transfer_company_ownership_tx(uuid, uuid, uuid) from public;
grant execute on function public.transfer_company_ownership_tx(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. accept_organizer_invite_tx — null/empty token guard,
--    IS DISTINCT FROM hash compare, drop UPDATE-then-RAISE rollback bugs.
-- ---------------------------------------------------------------------------

create or replace function public.accept_organizer_invite_tx(
  p_invite_id uuid,
  p_token text,
  p_profile_id uuid
)
returns table(out_company_id uuid, out_role public.org_member_role)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_now timestamptz := now();
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  -- Reject missing tokens upfront so a caller cannot pass NULL and benefit
  -- from `digest(NULL,'sha256')` returning NULL (which used to make the
  -- `<>` comparison evaluate to NULL and skip the IF).
  if p_token is null or p_token = '' then
    raise exception 'invite_token_mismatch' using errcode = 'P0046';
  end if;

  -- Lock the invite row to serialise concurrent accepts / revokes.
  select *
    into v_invite
    from public.organizer_invites
   where id = p_invite_id
     for update;
  if not found then
    raise exception 'invite_not_pending:not_found' using errcode = 'P0043';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'invite_not_pending:%', v_invite.status using errcode = 'P0043';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'invite_not_pending:revoked' using errcode = 'P0043';
  end if;

  if v_invite.expires_at <= v_now then
    -- Raise without an `UPDATE ... status='expired'` before it — the raise
    -- aborts the transaction and the UPDATE would be rolled back anyway. A
    -- cron job (see 20260518170000 header) is the right place to reflect
    -- the expired state once the invite ages out.
    raise exception 'invite_expired' using errcode = 'P0047';
  end if;

  -- IS DISTINCT FROM treats NULLs correctly (NULL is distinct from anything,
  -- including itself). Defence in depth on top of the p_token null guard.
  if v_invite.token_hash is distinct from encode(digest(p_token, 'sha256'), 'hex') then
    raise exception 'invite_token_mismatch' using errcode = 'P0046';
  end if;

  -- Already a current member? Raise immediately. Don't UPDATE the invite
  -- before raising — the raise rolls the UPDATE back, so it was a no-op
  -- bug. If we want to mark the invite accepted in this case (so the
  -- admin UI shows it as resolved) we'd need an autonomous-transaction
  -- mechanism, which Postgres doesn't have natively; leave the invite
  -- pending and rely on the admin to revoke it.
  if exists (
    select 1
      from public.organizer_memberships
     where company_id = v_invite.company_id
       and profile_id = p_profile_id
       and removed_at is null
  ) then
    raise exception 'invite_email_already_member' using errcode = 'P0048';
  end if;

  -- Insert membership. On conflict (existing row with removed_at NOT NULL)
  -- the soft-deleted row is reactivated.
  insert into public.organizer_memberships (
    company_id, profile_id, role, invited_by, joined_at, removed_at
  ) values (
    v_invite.company_id, p_profile_id, v_invite.role, v_invite.invited_by, v_now, null
  )
  on conflict (company_id, profile_id) do update
     set role = excluded.role,
         invited_by = excluded.invited_by,
         joined_at = excluded.joined_at,
         removed_at = null;

  -- Flip invite + last-active pointer.
  update public.organizer_invites
     set status = 'accepted',
         accepted_at = v_now,
         accepted_by = p_profile_id
   where id = p_invite_id;

  update public.profiles
     set organizer_legal_type = 'company',
         last_active_company_id = v_invite.company_id
   where id = p_profile_id;

  -- Audit.
  insert into public.organizer_membership_events (
    company_id, actor_profile_id, target_profile_id, action, to_role
  ) values (
    v_invite.company_id, p_profile_id, p_profile_id, 'invite_accepted', v_invite.role
  );

  return query select v_invite.company_id, v_invite.role;
end
$$;

revoke all on function public.accept_organizer_invite_tx(uuid, text, uuid) from public;
grant execute on function public.accept_organizer_invite_tx(uuid, text, uuid) to service_role;

notify pgrst, 'reload schema';
