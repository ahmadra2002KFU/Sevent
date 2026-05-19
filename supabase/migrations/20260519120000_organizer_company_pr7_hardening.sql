-- =============================================================================
-- 20260519120000 — Organizer companies: PR 7 hardening from the 10-finding audit.
--
-- Lands the DB-layer fixes from the 2026-05-19 multi-agent audit:
--
--   #1 atomic resend_organizer_invite_tx (replaces the non-atomic revoke→create
--      chain that could leave admins with no pending invite + a dead email link)
--   #2 organizer_companies.quote_acceptance_threshold_halalas — per-company
--      spend cap for member-role actors; accept_quote_tx_v2 now enforces it
--   #3 admin↔admin guard rails — admins can no longer change another admin's
--      role or remove another admin; only owners can. errcodes P0058 / P0059.
--   #5 auto_promote_oldest_admin_to_owner trigger fires when the sole owner is
--      soft-deleted, promoting the oldest active admin to owner (audit row
--      action='ownership_transferred'). Without this we leave zombie
--      companies that no remaining member can administer.
--   #7 sensitive-column revoke on organizer_companies — cr_number / vat_number
--      / billing_email are stripped from the `authenticated` REST role so
--      regular members can no longer SELECT them via PostgREST. service_role
--      bypass remains; settings UI (admin client) reads + renders per-role.
--   #8 admin invite floor — create_organizer_invite_tx now refuses to mint
--      another admin when the actor's role is admin (only owner may issue
--      admin invites). errcode P0061.
--
-- (#4 markAsIndividualAction TOCTOU and #6 acceptInviteAction requireAccess
--  ride along in the application code, not this migration.)
--
-- Errcode reservations (continuing the P0050 block):
--   P0058  admin_cannot_change_admin_role     — change_member_role_tx
--   P0059  admin_cannot_remove_admin           — remove_company_member_tx
--   P0060  quote_above_member_threshold        — accept_quote_tx_v2
--   P0061  admin_cannot_invite_admin           — create_organizer_invite_tx
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. organizer_companies — spend cap column.
-- ---------------------------------------------------------------------------

alter table public.organizer_companies
  add column if not exists quote_acceptance_threshold_halalas bigint;

comment on column public.organizer_companies.quote_acceptance_threshold_halalas is
  'Per-company cap on the total a member-role actor can accept on a quote. '
  'NULL = unlimited. Owners and admins are never threshold-gated. Enforced '
  'inside accept_quote_tx_v2 via P0060.';

-- ---------------------------------------------------------------------------
-- 2. Sensitive-column revoke on organizer_companies (audit finding #7).
--
--    PostgREST honors column-level GRANTs. Revoking SELECT on the three
--    finance fields from authenticated/anon means those roles can no longer
--    read them via REST regardless of RLS row visibility. service_role
--    bypasses GRANT checks and still has access — settings actions (and any
--    admin client read) keep working.
--
--    REVOKE is idempotent.
-- ---------------------------------------------------------------------------

revoke select (cr_number, vat_number, billing_email)
  on table public.organizer_companies
  from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. create_organizer_invite_tx — admin invite floor.
--
--    Adds the role-of-actor check: admins may only invite members; only
--    owners may invite admins. The owner-only-issues-owner guard remains
--    via the existing p_role = 'owner' rejection (P0052).
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

  select role into v_actor_role
    from public.organizer_memberships
   where company_id = p_company_id
     and profile_id = p_actor_profile_id
     and removed_at is null;
  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'not_company_admin:%', p_actor_profile_id using errcode = 'P0051';
  end if;

  if p_role = 'owner' then
    raise exception 'invite_role_invalid:owner' using errcode = 'P0052';
  end if;

  -- Admin invite floor: an admin cannot mint another admin. Only owners
  -- may issue admin-role invites. PR 7 audit finding #8.
  if v_actor_role = 'admin' and p_role = 'admin' then
    raise exception 'admin_cannot_invite_admin' using errcode = 'P0061';
  end if;

  if p_token is null or p_token = '' then
    raise exception 'invite_token_invalid' using errcode = 'P0052';
  end if;

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
    raise exception 'invite_email_already_pending:%', v_email using errcode = 'P0050';
  end;

  insert into public.organizer_membership_events (
    company_id, actor_profile_id, target_profile_id,
    action, to_role, metadata
  ) values (
    p_company_id,
    p_actor_profile_id,
    null,
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
-- 4. resend_organizer_invite_tx — atomic revoke-then-create.
--
--    Replaces the two-RPC chain in resendInviteAction. Inside a single
--    transaction we flip the existing pending invite to `revoked` and
--    insert a fresh one with a new token + expiry. If anything raises,
--    the whole thing rolls back and the original pending invite stays
--    intact (PR 7 audit finding #1).
-- ---------------------------------------------------------------------------

create or replace function public.resend_organizer_invite_tx(
  p_invite_id uuid,
  p_actor_profile_id uuid,
  p_new_token text,
  p_new_expires_at timestamptz
)
returns table(out_invite_id uuid, out_email text, out_role public.org_member_role, out_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.org_member_role;
  v_invite record;
  v_new_id uuid;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  if p_new_token is null or p_new_token = '' then
    raise exception 'invite_token_invalid' using errcode = 'P0052';
  end if;

  select *
    into v_invite
    from public.organizer_invites
   where id = p_invite_id
     for update;
  if not found then
    raise exception 'invite_not_found:%', p_invite_id using errcode = 'P0053';
  end if;

  select role into v_actor_role
    from public.organizer_memberships
   where company_id = v_invite.company_id
     and profile_id = p_actor_profile_id
     and removed_at is null;
  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'not_company_admin:%', p_actor_profile_id using errcode = 'P0051';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'invite_already_resolved:%', v_invite.status using errcode = 'P0054';
  end if;

  -- Admin invite floor still applies on resend (an admin can't resend an
  -- existing admin-role invite — only owners can rotate admin tokens).
  if v_actor_role = 'admin' and v_invite.role = 'admin' then
    raise exception 'admin_cannot_invite_admin' using errcode = 'P0061';
  end if;

  -- Step 1: revoke the existing pending invite (audit row written below).
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
    jsonb_build_object('invite_id', p_invite_id, 'email', v_invite.email, 'reason', 'resend')
  );

  -- Step 2: mint a fresh invite carrying the same (email, role).
  begin
    insert into public.organizer_invites (
      company_id, email, role, token_hash, status, invited_by, expires_at
    ) values (
      v_invite.company_id,
      v_invite.email,
      v_invite.role,
      encode(extensions.digest(p_new_token, 'sha256'), 'hex'),
      'pending',
      p_actor_profile_id,
      p_new_expires_at
    )
    returning id into v_new_id;
  exception when unique_violation then
    -- Should be impossible since we just revoked the only pending row for
    -- this (company, email), but keep the guard so a logic regression
    -- raises P0050 instead of silently succeeding.
    raise exception 'invite_email_already_pending:%', v_invite.email using errcode = 'P0050';
  end;

  insert into public.organizer_membership_events (
    company_id, actor_profile_id, target_profile_id,
    action, to_role, metadata
  ) values (
    v_invite.company_id,
    p_actor_profile_id,
    null,
    'invited',
    v_invite.role,
    jsonb_build_object('email', v_invite.email, 'invite_id', v_new_id, 'reason', 'resend')
  );

  return query select v_new_id, v_invite.email, v_invite.role, p_new_expires_at;
end
$$;

revoke all on function public.resend_organizer_invite_tx(
  uuid, uuid, text, timestamptz
) from public;
grant execute on function public.resend_organizer_invite_tx(
  uuid, uuid, text, timestamptz
) to service_role;

-- ---------------------------------------------------------------------------
-- 5. change_member_role_tx — admins can't change another admin.
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

  if p_new_role = 'owner' then
    raise exception 'cannot_change_owner_role:to_owner' using errcode = 'P0056';
  end if;

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

  select role into v_actor_role
    from public.organizer_memberships
   where company_id = p_company_id
     and profile_id = p_actor_profile_id
     and removed_at is null;
  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'not_company_admin:%', p_actor_profile_id using errcode = 'P0051';
  end if;

  -- Admins can only manage members. PR 7 audit finding #3: an admin cannot
  -- demote a sibling admin (only owners can). Self-demote-from-admin still
  -- works since the target's check below catches v_target_role='admin'
  -- but the actor IS the target — admins should be able to step down to
  -- member. Allow self-demote even when actor=admin and target=admin.
  if v_actor_role = 'admin'
     and v_target_role = 'admin'
     and p_actor_profile_id <> p_target_profile_id then
    raise exception 'admin_cannot_change_admin_role' using errcode = 'P0058';
  end if;

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
-- 6. remove_company_member_tx — admins can't remove another admin.
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
-- 7. auto_promote_oldest_admin_to_owner — owner-succession safety net.
--
--    When the sole active owner of a company is soft-deleted (removed_at
--    set), promote the oldest active admin to owner. If no admins exist,
--    the company remains owner-less; surfacing that is a follow-up
--    product decision (orphaned-company flag).
--
--    Trigger fires AFTER UPDATE of removed_at when the new value is
--    non-null and the old row had role='owner' AND removed_at IS NULL.
--    Inside the trigger we re-check active-owner count under no extra
--    locking because the row we just touched is already FOR UPDATEd by
--    the caller. The partial unique owner index keeps us from accidentally
--    minting two owners simultaneously.
-- ---------------------------------------------------------------------------

create or replace function public.auto_promote_oldest_admin_to_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promote_target uuid;
  v_active_owner_count int;
begin
  if new.removed_at is null then
    return new;
  end if;
  if old.removed_at is not null then
    return new;
  end if;
  if old.role <> 'owner' then
    return new;
  end if;

  select count(*) into v_active_owner_count
    from public.organizer_memberships
   where company_id = new.company_id
     and role = 'owner'
     and removed_at is null;
  if v_active_owner_count > 0 then
    return new;
  end if;

  -- Pick the oldest active admin (joined_at ASC). Lock to avoid racing
  -- with a concurrent role change that drops the admin pool.
  select profile_id
    into v_promote_target
    from public.organizer_memberships
   where company_id = new.company_id
     and role = 'admin'
     and removed_at is null
   order by joined_at asc
   limit 1
   for update;

  if v_promote_target is null then
    -- No admin available — company is orphaned; do nothing. A future
    -- ops surface should pick this up via a count(*)=0 query.
    return new;
  end if;

  update public.organizer_memberships
     set role = 'owner'
   where company_id = new.company_id
     and profile_id = v_promote_target;

  insert into public.organizer_membership_events (
    company_id, actor_profile_id, target_profile_id,
    action, from_role, to_role, metadata
  ) values (
    new.company_id,
    null,  -- system actor
    v_promote_target,
    'ownership_transferred',
    'admin',
    'owner',
    jsonb_build_object(
      'reason', 'auto_promote_after_owner_removed',
      'prior_owner', old.profile_id
    )
  );

  return new;
end
$$;

drop trigger if exists organizer_memberships_auto_promote_owner on public.organizer_memberships;
create trigger organizer_memberships_auto_promote_owner
  after update of removed_at on public.organizer_memberships
  for each row
  execute function public.auto_promote_oldest_admin_to_owner();

-- ---------------------------------------------------------------------------
-- 8. accept_quote_tx_v2 — enforce member spend cap.
-- ---------------------------------------------------------------------------

create or replace function public.accept_quote_tx_v2(
  p_quote_id uuid,
  p_organizer_id uuid,
  p_soft_hold_minutes int,
  p_company_id uuid,
  p_actor_profile_id uuid
)
returns table(booking_id uuid, block_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_rfq record;
  v_quote record;
  v_rev record;
  v_booking_id uuid;
  v_block_id uuid;
  v_rfq_status public.rfq_status;
  v_actor uuid;
  v_actor_role public.org_member_role;
  v_threshold bigint;
  v_quote_total bigint;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  v_actor := coalesce(p_actor_profile_id, p_organizer_id);

  if p_soft_hold_minutes is null or p_soft_hold_minutes <= 0 or p_soft_hold_minutes > 20160 then
    raise exception 'soft_hold_minutes_invalid:%', p_soft_hold_minutes using errcode = 'P0012';
  end if;

  -- 1. Resolve rfq_id + event_id from the quote.
  select q.rfq_id, r.event_id, q.id as quote_id
    into v_rfq
    from public.quotes q
    join public.rfqs r on r.id = q.rfq_id
   where q.id = p_quote_id;
  if not found then
    raise exception 'quote_not_found' using errcode = 'P0002';
  end if;

  -- 2. Lock the event.
  select e.*
    into v_event
    from public.events e
   where e.id = v_rfq.event_id
     for update;

  -- 3. Ownership check.
  if not (
    (p_company_id is null and v_event.organizer_id = p_organizer_id)
    or (
      p_company_id is not null
      and v_event.company_id = p_company_id
      and exists (
        select 1
          from public.organizer_memberships m
         where m.company_id = p_company_id
           and m.profile_id = v_actor
           and m.removed_at is null
      )
    )
  ) then
    raise exception 'organizer_mismatch' using errcode = 'P0006';
  end if;

  -- 4. Lock the RFQ and validate status.
  select r.status
    into v_rfq_status
    from public.rfqs r
   where r.id = v_rfq.rfq_id
     for update;
  if v_rfq_status not in ('sent', 'quoted') then
    raise exception 'rfq_not_bookable:%', v_rfq_status using errcode = 'P0010';
  end if;

  -- 5. Lock primary quote + siblings in deterministic order.
  perform 1
    from public.quotes
   where rfq_id = v_rfq.rfq_id
     and (id = p_quote_id or status = 'sent')
   order by id
     for update;

  -- 6. Re-read primary quote under lock.
  select q.*
    into v_quote
    from public.quotes q
   where q.id = p_quote_id;
  if v_quote.status = 'accepted' then
    raise exception 'quote_already_accepted' using errcode = 'P0003';
  end if;
  if v_quote.status <> 'sent' then
    raise exception 'quote_not_sendable:%', v_quote.status using errcode = 'P0004';
  end if;
  if v_quote.current_revision_id is null then
    raise exception 'quote_missing_revision' using errcode = 'P0005';
  end if;

  select *
    into v_rev
    from public.quote_revisions
   where id = v_quote.current_revision_id;

  -- 6b. PR 7 finding #2: enforce per-company spend cap for member-role actors.
  --     Owners and admins are never threshold-gated. Individual organizers
  --     (p_company_id IS NULL) are also exempt.
  if p_company_id is not null then
    select role into v_actor_role
      from public.organizer_memberships
     where company_id = p_company_id
       and profile_id = v_actor
       and removed_at is null;
    if v_actor_role = 'member' then
      select quote_acceptance_threshold_halalas into v_threshold
        from public.organizer_companies
       where id = p_company_id;
      if v_threshold is not null then
        v_quote_total := nullif(v_rev.snapshot_jsonb->>'total_halalas', '')::bigint;
        if v_quote_total is not null and v_quote_total > v_threshold then
          raise exception 'quote_above_member_threshold:% > %', v_quote_total, v_threshold
            using errcode = 'P0060';
        end if;
      end if;
    end if;
  end if;

  -- 7. Create booking.
  insert into public.bookings (
    rfq_id,
    quote_id,
    accepted_quote_revision_id,
    organizer_id,
    supplier_id,
    confirmation_status,
    awaiting_since,
    confirm_deadline,
    company_id,
    actor_profile_id
  ) values (
    v_quote.rfq_id,
    v_quote.id,
    v_rev.id,
    p_organizer_id,
    v_quote.supplier_id,
    'awaiting_supplier',
    now(),
    now() + make_interval(mins => p_soft_hold_minutes),
    p_company_id,
    p_actor_profile_id
  ) returning id into v_booking_id;

  -- 8. Soft-hold insert.
  begin
    insert into public.availability_blocks (
      supplier_id,
      starts_at,
      ends_at,
      reason,
      booking_id,
      quote_revision_id,
      expires_at,
      created_by
    ) values (
      v_quote.supplier_id,
      v_event.starts_at,
      v_event.ends_at,
      'soft_hold',
      v_booking_id,
      v_rev.id,
      now() + make_interval(mins => p_soft_hold_minutes),
      p_organizer_id
    ) returning id into v_block_id;
  exception
    when sqlstate 'P0001' then
      raise exception 'supplier_unavailable:%', sqlerrm using errcode = 'P0007';
  end;

  -- 9. Flip statuses.
  update public.quotes
     set status = 'accepted', accepted_at = now()
   where id = p_quote_id;

  update public.rfqs
     set status = 'booked'
   where id = v_quote.rfq_id;

  update public.quotes
     set status = 'rejected', rejected_at = now()
   where rfq_id = v_quote.rfq_id
     and id <> p_quote_id
     and status = 'sent';

  return query select v_booking_id, v_block_id;
end
$$;

revoke all on function public.accept_quote_tx_v2(uuid, uuid, int, uuid, uuid) from public;
grant execute on function public.accept_quote_tx_v2(uuid, uuid, int, uuid, uuid) to service_role;

notify pgrst, 'reload schema';
