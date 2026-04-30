-- =============================================================================
-- 20260505040000 — suppliers.website_url
--
-- Adds an optional outbound profile link the supplier collects during the
-- onboarding wizard. Surfaced on the public supplier profile as a "visit
-- website" link. The format check rejects anything that doesn't start with
-- http(s):// so we don't accidentally render `javascript:` or relative paths.
-- =============================================================================

alter table public.suppliers
  add column if not exists website_url text null;

alter table public.suppliers
  drop constraint if exists suppliers_website_url_format;

alter table public.suppliers
  add constraint suppliers_website_url_format
    check (website_url is null or website_url ~* '^https?://');
