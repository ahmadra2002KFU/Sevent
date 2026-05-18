-- =============================================================================
-- 20260519100000 — Organizer companies: PR 4 lifecycle RPCs.
--
-- Settings + members + invites (PR 4 of the multi-user company-organizer
-- refactor). Adds four more SECURITY DEFINER RPCs that the new settings
-- routes will call. All four follow the PR 2 / PR 1.5 pattern:
--
--   * security definer + REVOKE FROM public + GRANT TO service_role
--   * set local lock_timeout + statement_timeout at entry
--   * caller-supplied actor id treated as authoritative; the calling server
--     action MUST re-verify against gate.user.id
--   * audit row inserted into organizer_membership_events for every member-
--     visible state change
--   * `(select auth.uid())` is NOT used inside these functions because they
--     are security definer — auth.uid() reflects the service role, not the
--     human caller. Identity is passed in via p_actor_profile_id.
--
-- Errcode reservations (P0050 block — continues from PR 2's P0040 block):
--
--   P0050  invite_email_already_pending   — create_organizer_invite_tx
--   P0051  not_company_admin              — every mutation in this file
--   P0052  invite_role_invalid            — create_organizer_invite_tx
--   P0053  invite_not_found               — revoke_organizer_invite_tx
--   P0054  invite_already_resolved        — revoke_organizer_invite_tx
--   P0055  member_not_found               — change_member_role_tx
--   P0056  cannot_change_owner_role       — change_member_role_tx
--   P0057  invalid_role                   — change_member_role_tx
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. create_organizer_invite_tx
--
--    Issue a single-use invite. Token hashing happens server-side; the caller
--    supplies the plaintext token (cryptographically random, generated in the
--    server action) and we store only the sha256 hex. Plain text is returned
--    once so the calling action can embed it in the invite URL; it's not
--    retrievable after this call.
--
--    Partial unique index (company_id, lower(email)) WHERE status='pending'
--    enforces "at most one pending invite per (company, email)" at the DB
--    level. We catch the unique_violation and re-raise as P0050 so the UI
--    can show "already invited — resend or revoke first".
-- ---------------------------------------------------------------------------

create or replace function public.create_organizer_invite_tx(
  p_company_id uuid,
  p_actor_profile_id uuid,
  p_email text,
  p_role public.org_member_role,
  p_token text,
  p_expires_at timestamptz
)
returns table(out_invite_id uuid, out_email text, out_role public.org_member_role, out_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.org_member_role;
  v_invite_id uuid;
  v_email text;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  -- Actor must be a current admin/owner of the company. service_role bypass
  -- of RLS is exactly why we need the explicit re-check here.
  select role into v_actor_role
    from public.organizer_memberships
   where company_id = p_company_id
     and profile_id = p_actor_profile_id
     and removed_at is null;
  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'not_company_admin:%', p_actor_profile_id using errcode = 'P0051';
  end if;

  -- Role guard: the org_member_role enum's `owner` value is reserved for
  -- transfer_company_ownership_tx. Invites cannot grant ownership.
  if p_role = 'owner' then
    raise exception 'invite_role_invalid:owner' using errcode = 'P0052';
  end if;

  -- Token guard: refuse empty / null. The hash comparison in accept relies
  -- on a non-null hash; storing a digest of NULL would yield NULL which is
  -- the same audit-finding-#2 NULL-bypass class we patched in PR 1.5.
  if p_token is null or p_token = '' then
    raise exception 'invite_token_invalid' using errcode = 'P0052';
  end if;

  -- Normalize email — store lowercased for case-insensitive lookup. The
  -- partial unique index already uses lower(email) so the index agrees
  -- regardless of caller casing.
  v_email := lower(trim(p_email));
  if v_email is null or v_email = '' then
    raise exception 'invite_email_invalid' using errcode = 'P0052';
  end if;

  begin
    insert into public.organizer_invites (
      company_id, email, role, token_hash, status, invited_by, expires_at
    ) values (
      p_company_id,
      v_email,
      p_role,
      encode(extensions.digest(p_token, 'sha256'), 'hex'),
      'pending',
      p_actor_profile_id,
      p_expires_at
    )
    returning id into v_invite_id;
  exception when unique_violation then
    -- Conflicting pending invite already exists for this (company, email).
    raise exception 'invite_email_already_pending:%', v_email using errcode = 'P0050';
  end;

  insert into public.organizer_membership_events (
    company_id, actor_profile_id, target_profile_id,
    action, to_role, metadata
  ) values (
    p_company_id,
    p_actor_profile_id,
    null,  -- target profile is unknown until accept
    'invited',
    p_role,
    jsonb_build_object('email', v_email, 'invite_id', v_invite_id)
  );

  return query select v_invite_id, v_email, p_role, p_expires_at;
end
$$;

revoke all on function public.create_organizer_invite_tx(
  uuid, uuid, text, public.org_member_role, text, timestamptz
) from public;
grant execute on function public.create_organizer_invite_tx(
  uuid, uuid, text, public.org_member_role, text, timestamptz
) to service_role;

-- ---------------------------------------------------------------------------
-- 2. revoke_organizer_invite_tx
--
--    Idempotent flip pending → revoked. Refuses to operate on accepted /
--    already-revoked / expired invites (those are terminal and a revoke
--    against them would silently no-op, which masks UI bugs).
-- ---------------------------------------------------------------------------

create or replace function public.revoke_organizer_invite_tx(
  p_invite_id uuid,
  p_actor_profile_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_actor_role public.org_member_role;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  -- Lock the invite row to serialise revoke vs concurrent accept. The accept
  -- RPC also takes FOR UPDATE on this row; whichever wins races, the loser
  -- sees the terminal status and raises.
  select *
    into v_invite
    from public.organizer_invites
   where id = p_invite_id
     for update;
  if not found then
    raise exception 'invite_not_found:%', p_invite_id using errcode = 'P0053';
  end if;

  -- Actor must be admin/owner of the company the invite belongs to.
  select role into v_actor_role
    from public.organizer_memberships
   where company_id = v_invite.company_id
     and profile_id = p_actor_profile_id
     and removed_at is null;
  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'not_company_admin:%', p_actor_profile_id using errcode = 'P0051';
  end if;

  -- Only pending invites are revocable. accepted / revoked / expired are
  -- terminal — a revoke against them is a UI bug, not a no-op.
  if v_invite.status <> 'pending' then
    raise exception 'invite_already_resolved:%', v_invite.status using errcode = 'P0054';
  end if;

  update public.organizer_invites
     set status = 'revoked',
         revoked_at = now()
   where id = p_invite_id;

  insert into public.organizer_membership_events (
    company_id, actor_profile_id, target_profile_id,
    action, metadata
  ) values (
    v_invite.company_id,
    p_actor_profile_id,
    null,
    'invite_revoked',
    case
      when p_reason is null then jsonb_build_object('invite_id', p_invite_id, 'email', v_invite.email)
      else jsonb_build_object('invite_id', p_invite_id, 'email', v_invite.email, 'reason', p_reason)
    end
  );
end
$$;

revoke all on function public.revoke_organizer_invite_tx(uuid, uuid, text) from public;
grant execute on function public.revoke_organizer_invite_tx(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. change_member_role_tx
--
--    Promote/demote between admin <-> member. Cannot change anyone's role
--    to or from `owner` — that path is reserved for
--    transfer_company_ownership_tx, which has the lock-both-rows +
--    partial-unique-owner-index invariants.
-- ---------------------------------------------------------------------------

create or replace function public.change_member_role_tx(
  p_company_id uuid,
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_new_role public.org_member_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.org_member_role;
  v_target_role public.org_member_role;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  -- Refuse owner-related flips up front so the failure case is clear in the
  -- audit log (we never write a misleading audit row for an attempt).
  if p_new_role = 'owner' then
    raise exception 'cannot_change_owner_role:to_owner' using errcode = 'P0056';
  end if;

  -- Lock the target row so a concurrent role flip / remove serialises with us.
  select role into v_target_role
    from public.organizer_memberships
   where company_id = p_company_id
     and profile_id = p_target_profile_id
     and removed_at is null
     for update;
  if v_target_role is null then
    raise exception 'member_not_found:%', p_target_profile_id using errcode = 'P0055';
  end if;

  if v_target_role = 'owner' then
    raise exception 'cannot_change_owner_role:from_owner' using errcode = 'P0056';
  end if;

  -- Actor must be admin/owner. Self-demote is allowed because the owner-only
  -- path is already rejected above, so the only self-call here is an admin
  -- stepping down to member.
  select role into v_actor_role
    from public.organizer_memberships
   where company_id = p_company_id
     and profile_id = p_actor_profile_id
     and removed_at is null;
  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'not_company_admin:%', p_actor_profile_id using errcode = 'P0051';
  end if;

  -- No-op early exit when the role isn't changing. We still want to be
  -- idempotent without producing a noisy audit row for a clicked-twice
  -- button.
  if v_target_role = p_new_role then
    return;
  end if;

  update public.organizer_memberships
     set role = p_new_role
   where company_id = p_company_id
     and profile_id = p_target_profile_id;

  insert into public.organizer_membership_events (
    company_id, actor_profile_id, target_profile_id,
    action, from_role, to_role
  ) values (
    p_company_id, p_actor_profile_id, p_target_profile_id,
    'role_changed', v_target_role, p_new_role
  );
end
$$;

revoke all on function public.change_member_role_tx(
  uuid, uuid, uuid, public.org_member_role
) from public;
grant execute on function public.change_member_role_tx(
  uuid, uuid, uuid, public.org_member_role
) to service_role;

-- ---------------------------------------------------------------------------
-- 4. update_organizer_company_tx
--
--    Edit company profile fields. Slug + created_by are intentionally NOT
--    editable post-creation: slug appears in URLs that suppliers may have
--    bookmarked, and created_by is an immutable historical fact. Logo
--    upload writes the storage path separately via the supabase storage
--    bucket; here we just persist the chosen logo_path string when given.
--
--    No audit log row — this RPC touches `organizer_companies` only, not
--    membership state. Future product decision: surface a separate
--    `organizer_companies_events` log if company-profile edits need an
--    audit trail.
-- ---------------------------------------------------------------------------

create or replace function public.update_organizer_company_tx(
  p_company_id uuid,
  p_actor_profile_id uuid,
  p_name text,
  p_name_ar text,
  p_cr_number text,
  p_vat_number text,
  p_billing_email text,
  p_default_language text,
  p_logo_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.org_member_role;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  select role into v_actor_role
    from public.organizer_memberships
   where company_id = p_company_id
     and profile_id = p_actor_profile_id
     and removed_at is null;
  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'not_company_admin:%', p_actor_profile_id using errcode = 'P0051';
  end if;

  update public.organizer_companies
     set name = coalesce(p_name, name),
         name_ar = p_name_ar,
         cr_number = p_cr_number,
         vat_number = p_vat_number,
         billing_email = p_billing_email,
         default_language = coalesce(p_default_language, default_language),
         logo_path = p_logo_path
   where id = p_company_id;
end
$$;

revoke all on function public.update_organizer_company_tx(
  uuid, uuid, text, text, text, text, text, text, text
) from public;
grant execute on function public.update_organizer_company_tx(
  uuid, uuid, text, text, text, text, text, text, text
) to service_role;

-- ---------------------------------------------------------------------------
-- 5. accept_organizer_invite_tx — hotfix.
--
-- Both PR 2's original (20260518170000) and PR 1.5's redefinition
-- (20260518190000) call `digest(...)` unqualified inside a function with
-- `set search_path = public`. The pgcrypto `digest` function lives in the
-- `extensions` schema, so the call resolves to nothing and raises
-- `function digest(text, unknown) does not exist` at runtime — meaning
-- the entire organizer-invite-accept flow would 500 if anyone clicked an
-- invite link.
--
-- Caught by the PR 4 RPC smoke test (`scripts/pr4-rpc-smoke.sql`) when
-- chaining create_organizer_invite_tx → accept_organizer_invite_tx. Fix:
-- explicit `extensions.digest(...)` qualifier matching the PR 4 RPC. No
-- other behaviour changes; the function's contract and errcodes are
-- unchanged from PR 1.5.
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

  if p_token is null or p_token = '' then
    raise exception 'invite_token_mismatch' using errcode = 'P0046';
  end if;

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
    raise exception 'invite_expired' using errcode = 'P0047';
  end if;

  if v_invite.token_hash is distinct from encode(extensions.digest(p_token, 'sha256'), 'hex') then
    raise exception 'invite_token_mismatch' using errcode = 'P0046';
  end if;

  if exists (
    select 1
      from public.organizer_memberships
     where company_id = v_invite.company_id
       and profile_id = p_profile_id
       and removed_at is null
  ) then
    raise exception 'invite_email_already_member' using errcode = 'P0048';
  end if;

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

  update public.organizer_invites
     set status = 'accepted',
         accepted_at = v_now,
         accepted_by = p_profile_id
   where id = p_invite_id;

  update public.profiles
     set organizer_legal_type = 'company',
         last_active_company_id = v_invite.company_id
   where id = p_profile_id;

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
