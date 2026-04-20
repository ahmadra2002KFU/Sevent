-- =============================================================================
-- Fix: upsert_quote_revision_tx column ambiguity
-- =============================================================================
--
-- Lane 5 integration tests caught this: the function signature declares
-- `returns table(quote_id uuid, revision_id uuid, version int)`, and the
-- body uses unqualified `version` + `quote_id` in a SELECT against
-- `public.quote_revisions`. PL/pgSQL resolves those identifiers against the
-- OUT columns first, producing Postgres errcode `42702`:
--
--   column reference "version" is ambiguous
--
-- Repro: every call to `upsert_quote_revision_tx` fails immediately.
--
-- Fix: alias the table (`qr`) and qualify every column reference. Also
-- qualify the `quote_id = v_quote_id` predicate so it can't resolve to the
-- OUT column by accident. Behaviour is unchanged — this is a pure
-- syntactic disambiguation.
-- =============================================================================

create or replace function public.upsert_quote_revision_tx(
  p_rfq_id uuid,
  p_supplier_id uuid,
  p_author_id uuid,
  p_snapshot jsonb,
  p_content_hash text,
  p_source public.quote_source
)
returns table(quote_id uuid, revision_id uuid, version int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
  v_quote_status public.quote_status;
  v_next_version int;
  v_revision_id uuid;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  -- 1. Ensure a quote row exists for this (rfq, supplier) pair.
  insert into public.quotes (rfq_id, supplier_id, source, status)
       values (p_rfq_id, p_supplier_id, p_source, 'draft')
  on conflict (rfq_id, supplier_id) do update
       set source = excluded.source
    returning id into v_quote_id;

  -- 2. Lock the quote row + read its status so the version computation is
  --    race-free AND terminal quotes cannot be resurrected.
  select q.status
    into v_quote_status
    from public.quotes q
   where q.id = v_quote_id
     for update;
  if v_quote_status not in ('draft', 'sent') then
    raise exception 'quote_revision_not_editable:%', v_quote_status using errcode = 'P0011';
  end if;

  -- 3. Next version is max+1 under the lock — no retry needed.
  --    Alias + qualify every column reference so it cannot resolve to the
  --    OUT parameters (`version`, `quote_id`) in the RETURNS TABLE clause.
  select coalesce(max(qr.version), 0) + 1
    into v_next_version
    from public.quote_revisions qr
   where qr.quote_id = v_quote_id;

  -- 4. Insert the immutable snapshot.
  insert into public.quote_revisions (quote_id, version, author_id, snapshot_jsonb, content_hash)
       values (v_quote_id, v_next_version, p_author_id, p_snapshot, p_content_hash)
    returning id into v_revision_id;

  -- 5. Flip the live quote row to point at the new revision and status=sent.
  update public.quotes
     set current_revision_id = v_revision_id,
         source = p_source,
         status = 'sent',
         sent_at = now()
   where id = v_quote_id;

  return query select v_quote_id, v_revision_id, v_next_version;
end
$$;

revoke all on function public.upsert_quote_revision_tx(uuid, uuid, uuid, jsonb, text, public.quote_source) from public;
grant execute on function public.upsert_quote_revision_tx(uuid, uuid, uuid, jsonb, text, public.quote_source) to service_role;
