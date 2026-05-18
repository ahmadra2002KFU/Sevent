-- =============================================================================
-- 20260518170000 — Organizer companies: lifecycle RPCs.
--
-- PR 2 of the multi-user company-organizer refactor.
--
-- All four functions are SECURITY DEFINER + REVOKE FROM public + GRANT TO
-- service_role — only server actions (which have already authenticated the
-- caller via requireAccess) can invoke them. Every function trusts the
-- caller-supplied actor id as authoritative; the calling server action
-- must re-verify against gate.user.id.
--
-- Errcode reservations (P0040 block):
--   P0040  company_already_exists           — create_organizer_company_tx
--   P0041  not_company_owner                — transfer_company_ownership_tx
--   P0042  target_not_company_member        — transfer_company_ownership_tx
--   P0043  invite_not_pending               — accept_organizer_invite_tx
--   P0044  cannot_remove_sole_owner         — remove_company_member_tx
--   P0045  not_company_admin                — remove_company_member_tx
--   P0046  invite_token_mismatch            — accept_organizer_invite_tx
--   P0047  invite_expired                   — accept_organizer_invite_tx
--   P0048  invite_email_already_member      — accept_organizer_invite_tx
--   P0049  member_not_found                 — remove_company_member_tx
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. create_organizer_company_tx
--    Atomic: insert company + owner membership + flip
--    profiles.organizer_legal_type to 'company'. Audit row in
--    organizer_membership_events.
-- ---------------------------------------------------------------------------

create or replace function public.create_organizer_company_tx(
  p_creator_id uuid,
  p_name text,
  p_name_ar text,
  p_slug text,
  p_cr_number text,
  p_vat_number text,
  p_billing_email text,
  p_default_language text
)
returns table(out_company_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  -- Insert company. Slug uniqueness is enforced by the column constraint;
  -- a conflicting slug raises 23505 → wrapped into P0040 for the UI.
  begin
    insert into public.organizer_companies (
      name, name_ar, slug, cr_number, vat_number,
      billing_email, default_language, created_by
    ) values (
      p_name, p_name_ar, p_slug, p_cr_number, p_vat_number,
      p_billing_email, coalesce(p_default_language, 'en'), p_creator_id
    )
    returning id into v_company_id;
  exception when unique_violation then
    raise exception 'company_already_exists:%', p_slug using errcode = 'P0040';
  end;

  -- Owner membership. The partial unique index
  -- organizer_memberships_one_active_owner_idx is the backstop.
  insert into public.organizer_memberships (company_id, profile_id, role, invited_by)
  values (v_company_id, p_creator_id, 'owner', p_creator_id);

  -- Flip the profile's legal type. NULL → 'company' (no-op if already set).
  update public.profiles
     set organizer_legal_type = 'company',
         last_active_company_id = v_company_id
   where id = p_creator_id;

  -- Audit.
  insert into public.organizer_membership_events (
    company_id, actor_profile_id, target_profile_id, action, to_role
  ) values (
    v_company_id, p_creator_id, p_creator_id, 'joined', 'owner'
  );

  return query select v_company_id;
end
$$;

revoke all on function public.create_organizer_company_tx(
  uuid, text, text, text, text, text, text, text
) from public;
grant execute on function public.create_organizer_company_tx(
  uuid, text, text, text, text, text, text, text
) to service_role;

-- ---------------------------------------------------------------------------
-- 2. transfer_company_ownership_tx
--    Locks the company row FOR UPDATE so two concurrent transfers serialise.
--    Demotes the current owner to admin, promotes the target.
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
  v_target_role public.org_member_role;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  -- Serialise on the company row.
  select id into v_locked
    from public.organizer_companies
   where id = p_company_id
     for update;
  if not found then
    raise exception 'company_not_found:%', p_company_id using errcode = 'P0041';
  end if;

  -- Confirm the from-user is the current owner.
  if not exists (
    select 1
      from public.organizer_memberships
     where company_id = p_company_id
       and profile_id = p_from_profile_id
       and role = 'owner'
       and removed_at is null
  ) then
    raise exception 'not_company_owner:%', p_from_profile_id using errcode = 'P0041';
  end if;

  -- Confirm the target is a current member.
  select role into v_target_role
    from public.organizer_memberships
   where company_id = p_company_id
     and profile_id = p_to_profile_id
     and removed_at is null;
  if not found then
    raise exception 'target_not_company_member:%', p_to_profile_id using errcode = 'P0042';
  end if;

  -- Demote former owner first so the partial unique index (one owner) never
  -- sees two active owners simultaneously. Both UPDATEs run in the same
  -- transaction under the FOR UPDATE on the company row.
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
    (p_company_id, p_from_profile_id, p_to_profile_id, 'ownership_transferred', v_target_role, 'owner');
end
$$;

revoke all on function public.transfer_company_ownership_tx(uuid, uuid, uuid) from public;
grant execute on function public.transfer_company_ownership_tx(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. accept_organizer_invite_tx
--    Verifies the sha256 token against organizer_invites.token_hash under
--    a FOR UPDATE lock on the invite row. Status checks are inside the lock,
--    so a race with revoke / re-accept can't double-insert a membership.
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
    -- Best-effort flip to 'expired' so the row reflects reality even if a
    -- cron job hasn't run yet.
    update public.organizer_invites
       set status = 'expired'
     where id = p_invite_id;
    raise exception 'invite_expired' using errcode = 'P0047';
  end if;

  -- Token match. Constant-length sha256 hex → `=` is safe here; no timing
  -- side-channel exposed because the value is server-side only and the
  -- caller can't iterate token-hash bits via the response.
  if v_invite.token_hash <> encode(digest(p_token, 'sha256'), 'hex') then
    raise exception 'invite_token_mismatch' using errcode = 'P0046';
  end if;

  -- Already a current member? Idempotent return (caller can treat the existing
  -- membership as success).
  if exists (
    select 1
      from public.organizer_memberships
     where company_id = v_invite.company_id
       and profile_id = p_profile_id
       and removed_at is null
  ) then
    update public.organizer_invites
       set status = 'accepted',
           accepted_at = v_now,
           accepted_by = p_profile_id
     where id = p_invite_id;
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

-- ---------------------------------------------------------------------------
-- 4. remove_company_member_tx
--    Soft-delete via removed_at. Refuses to remove the sole active owner —
--    use transfer_company_ownership_tx first.
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
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  -- Lock the target membership row so a concurrent role flip doesn't race
  -- with the sole-owner check below.
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

  -- Actor must be owner or admin of the company. (Self-removal is allowed
  -- regardless of role — a member can always leave.)
  if p_actor_profile_id <> p_target_profile_id then
    select role into v_actor_role
      from public.organizer_memberships
     where company_id = p_company_id
       and profile_id = p_actor_profile_id
       and removed_at is null;
    if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
      raise exception 'not_company_admin:%', p_actor_profile_id using errcode = 'P0045';
    end if;
  end if;

  -- Sole-owner guard. If we're removing an owner, ensure another owner exists.
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

  -- Soft-delete.
  update public.organizer_memberships
     set removed_at = now()
   where company_id = p_company_id
     and profile_id = p_target_profile_id;

  -- Clear last_active_company_id if the removed member had it pointing here.
  update public.profiles
     set last_active_company_id = null
   where id = p_target_profile_id
     and last_active_company_id = p_company_id;

  -- Audit.
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

notify pgrst, 'reload schema';
