-- =============================================================================
-- 20260518150000 — send_rfq_tx_v2: company-aware RFQ creation.
--
-- PR 2 of the multi-user company-organizer refactor.
--
-- WHY A NEW NAME, NOT AN OVERLOAD?
--
-- Migration 20260420060000 (`fix_send_rfq_tx_ambiguity`) and migration
-- 20260517100000 (`send_rfq_tx_marketplace_flag`) both demonstrate that
-- PostgREST + Postgres function overloading by argument-default is a known
-- footgun in this codebase. PostgREST resolves overloads by argument NAMES,
-- and during a transition window (old callers in flight, new callers
-- deployed) two signatures that overlap on name set can resolve
-- ambiguously — exactly the bug that 20260420060000 fixed and that the
-- 8-arg lockdown comment in 20260517100000 warns against. Adding two
-- more args via `default null` would re-introduce that risk class.
--
-- The fix: ship `send_rfq_tx_v2` as a NEW function (10 args, two new:
-- `p_company_id` and `p_actor_profile_id`). The 8-arg `send_rfq_tx` keeps
-- working unchanged. After server actions cut over (this PR) and a bake
-- period, a later migration drops v1.
--
-- ADDITIVE BEHAVIOR
--
-- For individual organizers (p_company_id IS NULL), v2 behaves identically
-- to v1 — same ownership check, same status code (P0024), same return shape.
-- v2 additionally:
--   * stamps the new `rfqs.company_id` and `rfqs.actor_profile_id` columns
--     (NULL for individuals)
--   * accepts a company path: when p_company_id IS NOT NULL, ownership is
--     verified via `events.company_id = p_company_id` AND a current
--     membership for p_actor_profile_id in that company.
--
-- The composite FK `rfqs_actor_is_company_member_fk` (in 20260518112000)
-- is the database-level backstop — even if the ownership check were ever
-- bypassed, an actor who is not a member of the named company cannot have
-- a row inserted.
--
-- Errcodes reused from v1: P0020 / P0021 / P0023 / P0024 / P0025.
-- No new errcodes — a v2 caller passing a stale company + actor pair gets
-- the same P0024 the v1 caller would have got with a stale organizer_id.
-- =============================================================================

set search_path = public;

create or replace function public.send_rfq_tx_v2(
  p_organizer_id uuid,
  p_event_id uuid,
  p_category_id uuid,
  p_subcategory_id uuid,
  p_requirements jsonb,
  p_response_deadline_hours int,
  p_invites jsonb,
  p_is_published_to_marketplace boolean,
  p_company_id uuid,
  p_actor_profile_id uuid
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
  v_actor uuid;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  -- Coalesce the actor: individual flows that don't pass p_actor_profile_id
  -- fall back to p_organizer_id, matching v1's implicit "organizer == actor"
  -- assumption.
  v_actor := coalesce(p_actor_profile_id, p_organizer_id);

  if p_response_deadline_hours is null or p_response_deadline_hours not in (24, 48, 72) then
    raise exception 'invalid_response_deadline:%', p_response_deadline_hours
      using errcode = 'P0020';
  end if;

  if p_invites is null or jsonb_typeof(p_invites) <> 'array' then
    raise exception 'invites_must_be_array' using errcode = 'P0021';
  end if;
  if jsonb_array_length(p_invites) > 20 then
    raise exception 'invites_too_many:%', jsonb_array_length(p_invites)
      using errcode = 'P0023';
  end if;

  -- Ownership check, with the two-branch predicate.
  --   * Individual branch: p_company_id IS NULL → match events.organizer_id.
  --   * Company branch:   p_company_id IS NOT NULL → match events.company_id
  --     AND require an active membership for the actor.
  -- A row that doesn't satisfy either branch returns 0 rows, raising P0024.
  perform 1
    from public.events e
   where e.id = p_event_id
     and (
       (p_company_id is null and e.organizer_id = p_organizer_id)
       or (
         p_company_id is not null
         and e.company_id = p_company_id
         and exists (
           select 1
             from public.organizer_memberships m
            where m.company_id = p_company_id
              and m.profile_id = v_actor
              and m.removed_at is null
         )
       )
     )
     for update;
  if not found then
    raise exception 'event_not_found_or_not_owned' using errcode = 'P0024';
  end if;

  v_response_due_at := v_now + make_interval(hours => p_response_deadline_hours);

  insert into public.rfqs (
    event_id, category_id, subcategory_id, status,
    requirements_jsonb, sent_at, is_published_to_marketplace,
    company_id, actor_profile_id
  ) values (
    p_event_id, p_category_id, p_subcategory_id, 'sent',
    p_requirements, v_now, coalesce(p_is_published_to_marketplace, true),
    p_company_id, p_actor_profile_id
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

-- Privilege lockdown — mirror v1 exactly. service_role only; no anon/auth.
revoke all on function public.send_rfq_tx_v2(
  uuid, uuid, uuid, uuid, jsonb, int, jsonb, boolean, uuid, uuid
) from public;

grant execute on function public.send_rfq_tx_v2(
  uuid, uuid, uuid, uuid, jsonb, int, jsonb, boolean, uuid, uuid
) to service_role;

-- Force PostgREST to pick up the new function immediately. Without this,
-- a fresh function is only visible after the next process restart and the
-- server action that cuts over to v2 in this same deploy would 404.
notify pgrst, 'reload schema';
