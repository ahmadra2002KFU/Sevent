-- =============================================================================
-- 20260504030000 — supplier_doc_type += 'national_address'
--
-- Step 3 of supplier onboarding now requires 3 company-level PDFs:
--   - commercial registration (cr)        — already in enum
--   - tax/VAT certificate (vat)           — already in enum
--   - national address certificate        — NEW enum value added here
--
-- Mirrors the 20260422020000 pattern: ALTER TYPE ... ADD VALUE IF NOT EXISTS
-- is idempotent and forward-only. We do not rely on the absence of this value
-- anywhere else in the codebase.
-- =============================================================================

set search_path = public;

alter type public.supplier_doc_type add value if not exists 'national_address';
