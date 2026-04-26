-- =============================================================================
-- 20260504081000 — Quote proposal requests: security hardening.
--
-- Closes five defects on the table created in 20260504080000:
--
--   SEC-1 (CRITICAL) — Cross-tenant blob disclosure. The supplier UPDATE
--     policy had no WITH CHECK on `response_file_path`, so a malicious
--     supplier could write a foreign storage key (e.g. another supplier's
--     UUID prefix) and have the organizer-side loader mint a signed URL for
--     it. Enforced via a BEFORE-INSERT/UPDATE trigger that pulls the
--     supplier UUID from the parent quote and requires the path to start
--     with `{supplier_id}/proposal-responses/`. We use a trigger because
--     CHECK constraints cannot read another table.
--
--   SEC-2 (CRITICAL) — Status-transition guards. The supplier policy had no
--     WITH CHECK restricting transitions, so a supplier could rewrite
--     immutable columns (quote_id, requested_by, requested_at) or flip
--     `fulfilled → pending` to defeat the unique-pending index. A
--     BEFORE-UPDATE trigger now enforces:
--       * quote_id / requested_by / requested_at are immutable
--       * pending → fulfilled requires the supplier (or admin/service-role)
--         AND response_file_path + responded_at must be set
--       * pending → cancelled requires the organizer (or admin/service-role)
--         AND cancelled_at must be set
--       * everything else is rejected
--     service_role connections set auth.uid() to NULL, so the SECURITY
--     DEFINER helpers return false under server-action calls. We mirror
--     20260504010000_guard_supplier_verification_service_role.sql and
--     accept current_user in ('service_role','supabase_admin','postgres')
--     as a bypass — those are strictly more privileged than any user JWT
--     and the server actions already perform their own ownership checks.
--
--   SEC-5 (HIGH) — Orphaned blob cleanup. When the organizer re-requests
--     after a fulfilled cycle (a fresh row replaces the old one), or when
--     the parent quote cascade-deletes the request, the storage blob in
--     `supplier-docs` is leaked. There is no in-tree storage helper (grep
--     for `storage.delete_object` / `storage_objects_to_delete` came up
--     empty), and the brief disallows pg_net/HTTP from SQL. So we add a
--     small queue table `quote_proposal_request_orphans` and an AFTER
--     UPDATE/DELETE trigger that enqueues any path that is being lost. A
--     future drain job (server action / scheduled task) will read the
--     queue and call `storage.from('supplier-docs').remove([...])`.
--
--   MEDIUM — `requested_by` integrity. RLS forces requested_by = auth.uid()
--     for organizer inserts, but service_role bypasses RLS. A BEFORE-INSERT
--     trigger now coerces NEW.requested_by := auth.uid() when an end-user
--     JWT is present. Service-role inserts pass through unchanged (the
--     server action validates ownership in code).
--
--   MEDIUM — Idempotency. Every object below uses CREATE OR REPLACE or a
--     DROP IF EXISTS / CREATE pair so this migration is re-runnable, in
--     the same style as 20260504071000_fix_marketplace_rls.sql.
-- =============================================================================

set search_path = public;

-- 1. Orphan-blob cleanup queue ------------------------------------------------
--
-- Drained out-of-band by a future job. We deliberately do NOT call pg_net
-- or any external function from the trigger — keep the write path pure
-- SQL so it can never block the user-facing transaction on a flaky network
-- hop. `attempts` + `last_error` give the drainer somewhere to record
-- transient failures without losing the row.

create table if not exists public.quote_proposal_request_orphans (
  id          uuid primary key default gen_random_uuid(),
  bucket      text        not null default 'supplier-docs',
  file_path   text        not null,
  reason      text        not null check (reason in ('rerequest', 'cascade', 'manual')),
  created_at  timestamptz not null default now(),
  attempts    int         not null default 0,
  last_error  text,
  drained_at  timestamptz
);

create index if not exists quote_proposal_request_orphans_pending_idx
  on public.quote_proposal_request_orphans(created_at)
  where drained_at is null;

alter table public.quote_proposal_request_orphans enable row level security;

-- Only admins can read/write the queue from a user JWT. service_role bypasses
-- RLS as usual, which is what the future drainer will use.
drop policy if exists "qpro: admin all" on public.quote_proposal_request_orphans;
create policy "qpro: admin all" on public.quote_proposal_request_orphans
  for all using (public.is_admin())
  with check (public.is_admin());

-- 2. Helper: detect a service-role / superuser connection ---------------------
--
-- Mirrors guard_supplier_verification's check. Stable + SQL so it can be
-- inlined cheaply in the trigger body.

create or replace function public.caller_is_service_role()
returns boolean
language sql
stable
as $$
  select current_user in ('service_role', 'supabase_admin', 'postgres');
$$;

revoke all on function public.caller_is_service_role() from public;
grant execute on function public.caller_is_service_role() to authenticated, service_role;

-- 3. BEFORE INSERT/UPDATE — path scoping + transition guard + requested_by ----
--
-- One trigger for both ops keeps the rules colocated. The function reads
-- the parent quote's supplier_id once (SECURITY DEFINER so it bypasses RLS
-- on quotes) and uses it to validate the storage prefix. All other rules
-- are pure column comparisons.

create or replace function public.quote_proposal_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_supplier_id    uuid;
  v_is_service     boolean := public.caller_is_service_role();
  v_is_admin       boolean := false;
  v_is_supplier    boolean := false;
  v_is_organizer   boolean := false;
begin
  -- Resolve the parent quote's supplier_id. Used by the path-prefix check
  -- and by the role detection below.
  select q.supplier_id
    into v_supplier_id
    from public.quotes q
   where q.id = new.quote_id;

  if v_supplier_id is null then
    raise exception 'quote_proposal_requests: parent quote % not found', new.quote_id;
  end if;

  -- Identify the caller. Service-role connections have auth.uid() = NULL,
  -- so the SECURITY DEFINER helpers return false; we treat service_role as
  -- a separate, trusted lane.
  if not v_is_service then
    v_is_admin     := public.is_admin();
    v_is_supplier  := public.caller_is_quote_supplier(new.quote_id);
    v_is_organizer := public.caller_owns_quote_as_organizer(new.quote_id);
  end if;

  -- ---- INSERT path -------------------------------------------------------
  if tg_op = 'INSERT' then
    -- Coerce requested_by to auth.uid() when an end-user JWT is present.
    -- Under service_role auth.uid() is NULL — leave the supplied value;
    -- the server action validates ownership in code.
    if auth.uid() is not null then
      new.requested_by := auth.uid();
    end if;

    -- New rows must start in 'pending' (the only state RLS lets
    -- organizers create, and the only sensible initial state). This also
    -- prevents a service-role caller from writing a row that's already
    -- 'fulfilled' without going through the supplier path.
    if new.status <> 'pending' then
      raise exception
        'quote_proposal_requests: new rows must start as pending (got %)',
        new.status;
    end if;

    -- Path scoping: if the row is being inserted with a non-null path
    -- (unusual — normally only set on the supplier's UPDATE), require
    -- the supplier UUID prefix. Same rule as on UPDATE.
    if new.response_file_path is not null
       and new.response_file_path not like (v_supplier_id::text || '/proposal-responses/%') then
      raise exception
        'quote_proposal_requests: response_file_path must start with %/proposal-responses/',
        v_supplier_id;
    end if;

    return new;
  end if;

  -- ---- UPDATE path -------------------------------------------------------

  -- Immutable columns. We block writes from any caller, including
  -- service_role, because there is no legitimate reason to rewrite these.
  if new.quote_id is distinct from old.quote_id then
    raise exception 'quote_proposal_requests: quote_id is immutable';
  end if;
  if new.requested_by is distinct from old.requested_by then
    raise exception 'quote_proposal_requests: requested_by is immutable';
  end if;
  if new.requested_at is distinct from old.requested_at then
    raise exception 'quote_proposal_requests: requested_at is immutable';
  end if;

  -- Path scoping on UPDATE: the supplier (or anyone else) writing a path
  -- must scope it to the supplier UUID. SEC-1.
  if new.response_file_path is not null
     and new.response_file_path is distinct from old.response_file_path
     and new.response_file_path not like (v_supplier_id::text || '/proposal-responses/%') then
    raise exception
      'quote_proposal_requests: response_file_path must start with %/proposal-responses/',
      v_supplier_id;
  end if;

  -- Transition guard. SEC-2.
  if new.status is distinct from old.status then
    -- Service-role and admin can perform any legal transition. They still
    -- have to satisfy the shape checks below.
    if not (v_is_service or v_is_admin or v_is_supplier or v_is_organizer) then
      raise exception
        'quote_proposal_requests: caller not authorized to change status';
    end if;

    if old.status = 'pending' and new.status = 'fulfilled' then
      -- Supplier path: pending → fulfilled. Must set the response.
      if not (v_is_service or v_is_admin or v_is_supplier) then
        raise exception
          'quote_proposal_requests: only the supplier may fulfill';
      end if;
      if new.response_file_path is null or new.responded_at is null then
        raise exception
          'quote_proposal_requests: fulfilled rows require response_file_path + responded_at';
      end if;
    elsif old.status = 'pending' and new.status = 'cancelled' then
      -- Organizer path: pending → cancelled. Must stamp cancelled_at.
      if not (v_is_service or v_is_admin or v_is_organizer) then
        raise exception
          'quote_proposal_requests: only the organizer may cancel';
      end if;
      if new.cancelled_at is null then
        raise exception
          'quote_proposal_requests: cancelled rows require cancelled_at';
      end if;
    else
      raise exception
        'quote_proposal_requests: illegal status transition % → %',
        old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.quote_proposal_requests_guard() from public;

drop trigger if exists quote_proposal_requests_guard_biu
  on public.quote_proposal_requests;
create trigger quote_proposal_requests_guard_biu
  before insert or update on public.quote_proposal_requests
  for each row execute function public.quote_proposal_requests_guard();

-- 4. AFTER UPDATE/DELETE — orphan enqueue -------------------------------------
--
-- We enqueue when the row's response_file_path pointer is being lost:
--   * DELETE: the row goes away (typically a cascade from quotes).
--   * UPDATE: the path column itself changed to a different value (or NULL).
--
-- The current write paths don't UPDATE response_file_path in place — a
-- re-request creates a brand-new row, so the old fulfilled row is left
-- intact and its blob stays referenced. But we cover the UPDATE case
-- defensively so a future code path that mutates the column doesn't leak.

create or replace function public.quote_proposal_requests_enqueue_orphan()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    if old.response_file_path is not null then
      insert into public.quote_proposal_request_orphans (file_path, reason)
      values (old.response_file_path, 'cascade');
    end if;
    return old;
  end if;

  -- UPDATE
  if old.response_file_path is not null
     and old.response_file_path is distinct from new.response_file_path then
    insert into public.quote_proposal_request_orphans (file_path, reason)
    values (old.response_file_path, 'rerequest');
  end if;
  return new;
end;
$$;

revoke all on function public.quote_proposal_requests_enqueue_orphan() from public;

drop trigger if exists quote_proposal_requests_enqueue_orphan_aud
  on public.quote_proposal_requests;
create trigger quote_proposal_requests_enqueue_orphan_aud
  after update or delete on public.quote_proposal_requests
  for each row execute function public.quote_proposal_requests_enqueue_orphan();
