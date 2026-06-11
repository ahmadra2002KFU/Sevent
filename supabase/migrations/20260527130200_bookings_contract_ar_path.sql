-- =============================================================================
-- Separate Arabic contract PDF path
--
-- The booking contract is now generated as TWO standalone files — one English,
-- one Arabic — instead of a single bilingual document. `contract_pdf_path`
-- continues to hold the English (primary) PDF; this adds a sibling column for
-- the Arabic PDF. Both are nullable: existing confirmed bookings keep their
-- single `contract_pdf_path` (Arabic stays null and the UI simply omits the
-- Arabic download button for them).
-- =============================================================================

alter table public.bookings
  add column if not exists contract_pdf_path_ar text;

notify pgrst, 'reload schema';
