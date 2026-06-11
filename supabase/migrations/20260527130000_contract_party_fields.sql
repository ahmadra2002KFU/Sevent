-- =============================================================================
-- Contract party / tax fields
--
-- The booking contract is being upgraded to a formal Saudi PO/agreement that
-- names both parties with their tax/commercial identity. These columns supply
-- the data the contract PDF renders for the First Party (organizer company)
-- and Second Party (supplier).
--
-- All columns are additive and NULLABLE so existing rows are untouched and the
-- contract template degrades gracefully (it omits any line whose value is
-- null). No column-level grants are changed: every read surface in the app
-- uses an explicit column list (never `select *`), and the contract pipeline
-- reads via the service-role client, so these columns are not exposed on the
-- public marketplace API unless a caller explicitly selects them.
-- =============================================================================

-- Supplier (Second Party) ----------------------------------------------------
alter table public.suppliers
  add column if not exists vat_number text,
  -- The human signatory / point of contact named on the contract. Distinct
  -- from profiles.full_name (which onboarding also writes) so the supplier can
  -- name a representative without it being their login identity.
  add column if not exists representative_name text,
  add column if not exists address_line1 text,
  add column if not exists address_city text,
  add column if not exists address_region text,
  add column if not exists address_postal_code text;

-- Saudi VAT numbers are 15 digits starting with 3. Enforce the shape but allow
-- NULL (a freelancer below the registration threshold may not have one). A NULL
-- value satisfies the CHECK (unknown), so existing rows pass without backfill.
alter table public.suppliers
  drop constraint if exists suppliers_vat_number_format;
alter table public.suppliers
  add constraint suppliers_vat_number_format
  check (vat_number is null or vat_number ~ '^3[0-9]{14}$');

-- Organizer company (First Party) --------------------------------------------
alter table public.organizer_companies
  add column if not exists address_line1 text,
  add column if not exists address_city text,
  add column if not exists address_region text,
  add column if not exists address_postal_code text;

notify pgrst, 'reload schema';
