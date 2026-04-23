-- Align public.supplier_doc_type with the Zod enum in
-- `src/lib/domain/onboarding.ts`. Step 3 of supplier onboarding inserts rows
-- with `doc_type = 'iban_certificate'` or `'company_profile'`, but those
-- values don't exist in the Postgres enum declared in the Sprint-1 schema
-- migration. Step 3 would fail at the DB layer had it been tested end-to-end
-- in the local env.
--
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS is idempotent and forward-only.
-- It cannot be rolled back inside a transaction on older Postgres releases
-- but all current environments are ≥ 12 where this is supported and we do
-- not rely on the absence of either value anywhere in the codebase.

set search_path = public;

alter type public.supplier_doc_type add value if not exists 'iban_certificate';
alter type public.supplier_doc_type add value if not exists 'company_profile';
