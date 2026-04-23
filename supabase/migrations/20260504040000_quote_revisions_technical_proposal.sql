-- =============================================================================
-- 20260504040000 — quote_revisions.technical_proposal_path
--
-- Suppliers can now attach an optional "technical proposal" (ملف فني) PDF when
-- submitting a quote. Lives at the revision level (not on the quote parent) so
-- each resubmit carries its own technical file snapshot alongside the pricing
-- snapshot.
--
-- Storage: we reuse the existing `supplier-docs` bucket under a per-supplier
-- path convention `{supplier_id}/quote-attachments/…`. The bucket's RLS
-- policies already scope SELECT/INSERT/UPDATE/DELETE to `storage_path_owner_profile`
-- (see 20260504000000_storage_buckets.sql lines 105–151), so suppliers can
-- read their own uploads, admins can read any, and organizers never touch
-- storage directly — the server mints a short-lived signed URL when rendering
-- the quote detail.
--
-- Column is nullable + no default; absence means "no technical proposal attached".
-- =============================================================================

alter table public.quote_revisions
  add column if not exists technical_proposal_path text;
