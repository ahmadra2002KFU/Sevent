-- =============================================================================
-- 20260504020000 — suppliers.serves_all_ksa
--
-- Adds a boolean flag so a supplier can declare they operate across every KSA
-- city without having to enumerate cities individually (15-pick cap today).
--
-- Semantics (enforced in the onboarding wizard + Zod):
--   - When `serves_all_ksa = true`, `service_area_cities` MUST be empty — the
--     flag supersedes the city list. We keep the column nullable-free (default
--     false) so existing rows are unaffected.
--   - `base_city` stays required in both modes. It's the supplier's physical
--     HQ and is still used by the auto-match travel-fee scoring.
--
-- Auto-match consequence: the SQL hard filter in
-- src/lib/domain/matching/query.ts treats `serves_all_ksa = true` as matching
-- every requested event city. The travel-score ranker continues to favour
-- `base_city` exact match > service-area/all-KSA > out-of-area.
-- =============================================================================

alter table public.suppliers
  add column if not exists serves_all_ksa boolean not null default false;

-- Partial index — most suppliers pick specific cities; we only need the index
-- for the subset that opts into the nationwide flag, which is the one the
-- marketplace/auto-match city filter will OR into its .or() clause.
create index if not exists suppliers_serves_all_ksa_idx
  on public.suppliers (serves_all_ksa)
  where serves_all_ksa;
