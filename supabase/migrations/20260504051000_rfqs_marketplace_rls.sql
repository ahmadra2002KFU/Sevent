-- =============================================================================
-- 20260504051000 — RFQ marketplace: RLS policies
--
-- Completes the marketplace rollout started in 20260504050000. Lives in its
-- own migration because the self-apply policy references the enum value
-- 'self_applied' which was added by the previous migration — Postgres won't
-- let a new enum value be used in the same transaction as ALTER TYPE
-- (SQLSTATE 55P04 `unsafe use of new value of enum type`).
--
-- Adds two policies:
--   - `rfqs: marketplace supplier read` — approved+published suppliers can
--     SELECT any RFQ with `is_published_to_marketplace=true AND status='sent'`.
--   - `rfq_invites: supplier self-apply` — approved+published suppliers can
--     INSERT an rfq_invites row for their own supplier_id with
--     `source='self_applied'`, targeting a published+sent RFQ.
-- =============================================================================

set search_path = public;

drop policy if exists "rfqs: marketplace supplier read" on public.rfqs;
create policy "rfqs: marketplace supplier read" on public.rfqs
  for select using (
    is_published_to_marketplace
    and status = 'sent'
    and exists (
      select 1 from public.suppliers s
       where s.profile_id = auth.uid()
         and s.verification_status = 'approved'
         and s.is_published
    )
  );

drop policy if exists "rfq_invites: supplier self-apply" on public.rfq_invites;
create policy "rfq_invites: supplier self-apply" on public.rfq_invites
  for insert with check (
    source = 'self_applied'
    and exists (
      select 1 from public.suppliers s
       where s.id = supplier_id
         and s.profile_id = auth.uid()
         and s.verification_status = 'approved'
         and s.is_published
    )
    and exists (
      select 1 from public.rfqs r
       where r.id = rfq_id
         and r.is_published_to_marketplace
         and r.status = 'sent'
    )
  );
