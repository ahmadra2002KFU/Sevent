-- =============================================================================
-- 20260517100000 — send_rfq_tx: accept p_is_published_to_marketplace
--
-- Before this migration, `sendRfqAction` called `send_rfq_tx` (which always
-- inserted the RFQ with the column default `true`), then issued a separate
-- UPDATE on `public.rfqs` to flip `is_published_to_marketplace = false`
-- when the organizer had unticked the toggle. If the UPDATE failed for any
-- reason (transient network, RLS regression, lock timeout) AFTER the RPC
-- succeeded, the RFQ existed in the wrong visibility state — published to
-- the marketplace when the organizer explicitly opted out, with no atomic
-- recovery path.
--
-- This migration adds an optional `p_is_published_to_marketplace boolean`
-- argument so the RPC sets the value atomically with the row insert.
-- Existing callers that don't pass the argument keep the previous
-- behaviour (defaults to `true`, matching the column default), so the
-- migration is forward- and backward-compatible.
--
-- Errcode reservations remain unchanged:
--   P0020 invalid_response_deadline
--   P0021 invites_must_be_array
--   P0022 invites_empty (reserved, no longer raised; see 20260504060000)
--   P0023 invites_too_many
--   P0024 event_not_found_or_not_owned
--   P0025 invalid_invite_source
-- =============================================================================

create or replace function public.send_rfq_tx(
  p_organizer_id uuid,
  p_event_id uuid,
  p_category_id uuid,
  p_subcategory_id uuid,
  p_requirements jsonb,
  p_response_deadline_hours int,
  p_invites jsonb,
  p_is_published_to_marketplace boolean default true
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
  -- Empty array is allowed (marketplace-only RFQs). The server action
  -- enforces "marketplace OR shortlist" before calling. See sendRfqAction.
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

  -- Atomic insert with the marketplace visibility flag baked in. Callers
  -- that omit the argument get `true` (matches the column default), so
  -- legacy fan-out flows are unaffected.
  insert into public.rfqs (
    event_id, category_id, subcategory_id, status,
    requirements_jsonb, sent_at, is_published_to_marketplace
  ) values (
    p_event_id, p_category_id, p_subcategory_id, 'sent',
    p_requirements, v_now, coalesce(p_is_published_to_marketplace, true)
  ) returning id into v_rfq_id;

  -- Fan-out: with an empty p_invites array this INSERT inserts 0 rows.
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
