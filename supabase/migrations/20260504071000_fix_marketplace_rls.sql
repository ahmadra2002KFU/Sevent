-- =============================================================================
-- 20260504071000 — Fix marketplace RLS: break rfqs/rfq_invites recursion +
--                  let marketplace browsers read the joined event row.
--
-- Two bugs surfaced from the supplier `/supplier/opportunities` page:
--
--   Bug 1: any authenticated SELECT on `rfqs` failed with
--          "infinite recursion detected in policy for relation rfqs".
--          Cause: `rfqs: invited supplier read` joins `rfq_invites`, and
--          `rfq_invites: organizer read/write` joins `rfqs`. Postgres detects
--          the cycle and aborts. The marketplace loader swallowed the error
--          and returned an empty list, so the page rendered "no opportunities"
--          even when an RFQ was published+sent and the caller was eligible.
--
--   Bug 2: even with bug 1 fixed, the `events` table had no policy that lets
--          marketplace browsers read the event referenced by a published RFQ.
--          The loader's inner-join to `events` returned NULL, and the
--          `r.events !== null` filter in `marketplace.ts` dropped every row.
--
-- Fix strategy: move the cross-table lookups out of policy expressions and
-- into SECURITY DEFINER helpers. The helpers run with the function-owner's
-- privileges so they don't trigger the policies of the tables they query —
-- the recursion is gone by construction, not by clever expression rewrites.
--
-- Helpers added:
--   - `caller_is_marketplace_supplier()` — true iff `auth.uid()` is an
--     `approved` + `is_published` supplier.
--   - `caller_invited_to_rfq(_rfq_id uuid)` — true iff the caller has an
--     `rfq_invites` row for the RFQ. Replaces the inline join in
--     `rfqs: invited supplier read` (breaks bug 1).
--   - `event_has_marketplace_rfq(_event_id uuid)` — true iff the event has at
--     least one `rfqs` row with `is_published_to_marketplace AND status=sent`.
--     Used by the new `events: marketplace supplier read` policy (fixes bug 2).
--
-- Other supplier pages were unaffected because they go through the
-- service-role admin client (`requireAccess` returns `admin`), which bypasses
-- RLS entirely. Only the marketplace browse path uses a user-scoped client.
-- =============================================================================

set search_path = public;

-- 1. Helpers ------------------------------------------------------------------

create or replace function public.caller_is_marketplace_supplier()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
      from public.suppliers s
     where s.profile_id = auth.uid()
       and s.verification_status = 'approved'
       and s.is_published
  );
$$;

create or replace function public.caller_invited_to_rfq(_rfq_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
      from public.rfq_invites inv
      join public.suppliers s on s.id = inv.supplier_id
     where inv.rfq_id = _rfq_id
       and s.profile_id = auth.uid()
  );
$$;

create or replace function public.event_has_marketplace_rfq(_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
      from public.rfqs r
     where r.event_id = _event_id
       and r.is_published_to_marketplace
       and r.status = 'sent'
  );
$$;

revoke all on function public.caller_is_marketplace_supplier()    from public;
revoke all on function public.caller_invited_to_rfq(uuid)         from public;
revoke all on function public.event_has_marketplace_rfq(uuid)     from public;

grant execute on function public.caller_is_marketplace_supplier() to authenticated;
grant execute on function public.caller_invited_to_rfq(uuid)      to authenticated;
grant execute on function public.event_has_marketplace_rfq(uuid)  to authenticated;

-- 2. Rewrite the recursive rfqs policy ---------------------------------------

drop policy if exists "rfqs: invited supplier read" on public.rfqs;
create policy "rfqs: invited supplier read" on public.rfqs
  for select using (
    public.caller_invited_to_rfq(rfqs.id)
  );

-- 3. Add the missing events read policy for marketplace browsers --------------

drop policy if exists "events: marketplace supplier read" on public.events;
create policy "events: marketplace supplier read" on public.events
  for select using (
    public.caller_is_marketplace_supplier()
    and public.event_has_marketplace_rfq(events.id)
  );

-- 4. While we're here: rewrite the marketplace policy on rfqs to use the
--    same helper. Equivalent semantics, fewer copies of the eligibility check.

drop policy if exists "rfqs: marketplace supplier read" on public.rfqs;
create policy "rfqs: marketplace supplier read" on public.rfqs
  for select using (
    is_published_to_marketplace
    and status = 'sent'
    and public.caller_is_marketplace_supplier()
  );
