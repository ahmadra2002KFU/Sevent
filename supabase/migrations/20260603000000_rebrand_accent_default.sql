-- Rebrand: shift the DEFAULT supplier accent color from the old brand cobalt
-- (#1E7BD8) to the new brand blue (#4975DD).
--
-- Only affects rows inserted WITHOUT an explicit accent_color from here on.
-- Existing suppliers keep whatever accent they previously chose (no data
-- mutation). Kept in sync with:
--   * src/lib/domain/taxonomy.ts  → DEFAULT_ACCENT_HEX + ACCENT_PALETTE
--   * src/app/globals.css         → @theme brand-cobalt-500
alter table public.suppliers
  alter column accent_color set default '#4975DD';
