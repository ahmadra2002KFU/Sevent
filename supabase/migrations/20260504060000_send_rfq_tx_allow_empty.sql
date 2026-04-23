-- =============================================================================
-- 20260504060000 — send_rfq_tx: allow empty shortlists when published to marketplace
--
-- Before this migration, the RPC raised P0022 `invites_empty` if p_invites
-- was a zero-length array. That made sense when every RFQ was invite-only —
-- a zero-invite RFQ was unreachable by any supplier.
--
-- With the marketplace in place (`rfqs.is_published_to_marketplace`), an RFQ
-- can be distributed two ways: a curated shortlist OR the public marketplace.
-- "Publish to marketplace with no curated shortlist" is a legitimate case —
-- the organizer is outsourcing discovery to the marketplace self-apply path.
--
-- The application layer (`sendRfqAction`) still enforces the consistency
-- rule "must have at least one invite OR publish_to_marketplace=true";
-- relaxing the RPC simply stops blocking the marketplace-only case.
--
-- The P0022 code itself stays reserved — we drop the check from the function
-- body but leave the docblock comment intact so historical logs can be
-- interpreted. We keep P0021 (invites_must_be_array) and P0023 (invites_too_many)
-- as-is: a non-array p_invites is still a bug, and >20 invites is still a guardrail.
-- =============================================================================

create or replace function public.send_rfq_tx(
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
  -- Empty array is now allowed; the server action enforces
  -- "marketplace OR shortlist" before calling. See sendRfqAction.
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
