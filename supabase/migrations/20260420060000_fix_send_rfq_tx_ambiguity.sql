-- =============================================================================
-- Fix: send_rfq_tx column ambiguity
-- =============================================================================
--
-- Same root cause as the upsert_quote_revision_tx fix at
-- 20260420040000_fix_upsert_quote_revision_ambiguity.sql: the function
-- signature declared `returns table(rfq_id uuid, invite_count int)`, so
-- PL/pgSQL's OUT column `rfq_id` collided with `rfq_invites.rfq_id` and
-- Postgres raised `42702 column reference "rfq_id" is ambiguous` when
-- planning the INSERT ... ON CONFLICT (rfq_id, supplier_id).
--
-- Repro: every call to `send_rfq_tx` failed on the invite upsert.
--
-- Fix: rename the OUT columns to `out_rfq_id` / `out_invite_count` so they
-- cannot collide with any table column name anywhere in the function body.
-- Behaviour is unchanged; the JS caller in
-- `src/app/(organizer)/organizer/rfqs/actions.ts` is updated in the same
-- commit to read the renamed keys.
-- =============================================================================

-- Must DROP first because `CREATE OR REPLACE` cannot change the RETURNS
-- TABLE column names (Postgres treats those as part of the return type;
-- SQLSTATE 42P13 otherwise).
drop function if exists public.send_rfq_tx(uuid, uuid, uuid, uuid, jsonb, int, jsonb);

create function public.send_rfq_tx(
  p_organizer_id uuid,
  p_event_id uuid,
  p_category_id uuid,
  p_subcategory_id uuid,
  p_requirements jsonb,
  p_response_deadline_hours int,
  p_invites jsonb
)
returns table(out_rfq_id uuid, out_invite_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rfq_id uuid;
  v_now timestamptz := now();
  v_response_due_at timestamptz;
  v_invite_count int;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  if p_response_deadline_hours is null or p_response_deadline_hours not in (24, 48, 72) then
    raise exception 'invalid_response_deadline:%', p_response_deadline_hours
      using errcode = 'P0020';
  end if;

  if p_invites is null or jsonb_typeof(p_invites) <> 'array' then
    raise exception 'invites_must_be_array' using errcode = 'P0021';
  end if;
  if jsonb_array_length(p_invites) < 1 then
    raise exception 'invites_empty' using errcode = 'P0022';
  end if;
  if jsonb_array_length(p_invites) > 20 then
    raise exception 'invites_too_many:%', jsonb_array_length(p_invites)
      using errcode = 'P0023';
  end if;

  perform 1
    from public.events e
   where e.id = p_event_id
     and e.organizer_id = p_organizer_id
     for update;
  if not found then
    raise exception 'event_not_found_or_not_owned' using errcode = 'P0024';
  end if;

  v_response_due_at := v_now + make_interval(hours => p_response_deadline_hours);

  insert into public.rfqs (
    event_id, category_id, subcategory_id, status,
    requirements_jsonb, sent_at
  ) values (
    p_event_id, p_category_id, p_subcategory_id, 'sent',
    p_requirements, v_now
  ) returning id into v_rfq_id;

  begin
    insert into public.rfq_invites (
      rfq_id, supplier_id, source, status, sent_at, response_due_at
    )
    select
      v_rfq_id,
      (inv->>'supplier_id')::uuid,
      (inv->>'source')::public.rfq_invite_source,
      'invited'::public.rfq_invite_status,
      v_now,
      v_response_due_at
      from jsonb_array_elements(p_invites) as inv
    on conflict (rfq_id, supplier_id) do update
      set source = excluded.source,
          status = 'invited',
          sent_at = v_now,
          response_due_at = v_response_due_at;
  exception
    when invalid_text_representation or check_violation then
      raise exception 'invalid_invite_source:%', sqlerrm using errcode = 'P0025';
  end;

  select count(*)::int
    into v_invite_count
    from public.rfq_invites ri
   where ri.rfq_id = v_rfq_id;

  return query select v_rfq_id, v_invite_count;
end
$$;

revoke all on function public.send_rfq_tx(uuid, uuid, uuid, uuid, jsonb, int, jsonb) from public;
grant execute on function public.send_rfq_tx(uuid, uuid, uuid, uuid, jsonb, int, jsonb) to service_role;
