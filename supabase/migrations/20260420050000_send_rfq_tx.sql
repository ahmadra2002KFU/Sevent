-- =============================================================================
-- send_rfq_tx — atomic RFQ create + invite fan-out
-- =============================================================================
--
-- Sprint 3 Codex audit flagged `sendRfqAction` as a blocker: the RFQ insert
-- and the rfq_invites upsert were two separate statements, so an invite
-- failure left a sent RFQ with zero invites — inconsistent state surfaced
-- on the organizer's RFQ list as an empty row that nobody could respond to.
--
-- This function moves both writes into one transaction. The caller's
-- identity is passed as `p_organizer_id`; the server action authenticates
-- first, then invokes this RPC via service-role. Ownership is re-verified
-- inside the function so a bug in the calling code cannot bypass the
-- events.organizer_id check.
--
-- Raise codes (map in UI):
--   P0020 invalid_response_deadline:<n>          -- deadline not in (24,48,72)
--   P0021 invites_must_be_array                  -- p_invites not a JSON array
--   P0022 invites_empty                          -- zero invites
--   P0023 invites_too_many:<n>                   -- over 20 invites
--   P0024 event_not_found_or_not_owned           -- ownership/existence
--   P0025 invalid_invite_source:<value>          -- bad enum value in array
-- =============================================================================

create or replace function public.send_rfq_tx(
  p_organizer_id uuid,
  p_event_id uuid,
  p_category_id uuid,
  p_subcategory_id uuid,
  p_requirements jsonb,
  p_response_deadline_hours int,
  p_invites jsonb  -- [{ supplier_id: uuid, source: 'auto_match'|'organizer_picked' }, ...]
)
returns table(rfq_id uuid, invite_count int)
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

  -- 1. Validate deadline.
  if p_response_deadline_hours is null or p_response_deadline_hours not in (24, 48, 72) then
    raise exception 'invalid_response_deadline:%', p_response_deadline_hours
      using errcode = 'P0020';
  end if;

  -- 2. Validate invites payload shape (cheaper to check before locking).
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

  -- 3. Verify event exists + belongs to caller. Lock the event row so two
  --    concurrent sendRfq calls for the same event see consistent state.
  perform 1
    from public.events
   where id = p_event_id
     and organizer_id = p_organizer_id
     for update;
  if not found then
    raise exception 'event_not_found_or_not_owned' using errcode = 'P0024';
  end if;

  v_response_due_at := v_now + make_interval(hours => p_response_deadline_hours);

  -- 4. Insert the RFQ row.
  insert into public.rfqs (
    event_id, category_id, subcategory_id, status,
    requirements_jsonb, sent_at
  ) values (
    p_event_id, p_category_id, p_subcategory_id, 'sent',
    p_requirements, v_now
  ) returning id into v_rfq_id;

  -- 5. Fan out the invites. UPSERT so a re-submit of the same wizard is
  --    idempotent for (rfq_id, supplier_id). `source` casts enforce the
  --    allowed values — bad payload → P0025 via the cast exception handler.
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
    from public.rfq_invites
   where rfq_invites.rfq_id = v_rfq_id;

  return query select v_rfq_id, v_invite_count;
end
$$;

revoke all on function public.send_rfq_tx(uuid, uuid, uuid, uuid, jsonb, int, jsonb) from public;
grant execute on function public.send_rfq_tx(uuid, uuid, uuid, uuid, jsonb, int, jsonb) to service_role;
