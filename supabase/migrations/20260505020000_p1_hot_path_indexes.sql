-- P1: Compound indexes on hot read paths.
--
-- These cover query patterns surfaced by the perf audit where the existing
-- single-column / FK indexes still leave a sort or a residual filter to do
-- at query time:
--
--   * organizer RFQ list — orders by created_at after filtering organizer
--   * supplier invite history — orders by sent_at after filtering supplier
--   * quote comparison grid — filters by rfq + status, orders by sent_at
--   * supplier quote history — orders by created_at after filtering supplier
--   * organizer "awaiting confirmation" queue — filters org + status, orders deadline
--   * portfolio media — filters by kind within a supplier, ordered by sort_order
--
-- IF NOT EXISTS keeps the migration replay-safe; CONCURRENTLY would be
-- safer at scale but cannot run in a transaction. Tables are still small
-- enough for the brief lock to be acceptable.
--
-- Skipped (already covered by an existing index/constraint):
--   * rfq_invites(rfq_id, supplier_id) — primary key composite covers it.
--   * events(organizer_id, starts_at) — events_organizer_idx already exists.
--   * rfqs(is_published_to_marketplace) — rfqs_marketplace_browse_idx is the
--     correct partial composite (is_published_to_marketplace, status,
--     sent_at desc) WHERE is_published_to_marketplace.

-- rfqs: organizer dashboard + RFQ list page sort by created_at. The organizer
-- side actually joins through events.organizer_id (covered by the existing
-- events_organizer_idx); this index speeds the post-join sort by allowing an
-- index-ordered walk over the rfqs side keyed on event_id.
create index if not exists rfqs_event_created_idx
  on public.rfqs (event_id, created_at desc);

-- rfq_invites: supplier inbox / dashboard "recent invites" sort by sent_at
-- (existing rfq_invites_supplier_idx is on (supplier_id, status), which
-- doesn't help the sort path)
create index if not exists rfq_invites_supplier_sent_idx
  on public.rfq_invites (supplier_id, sent_at desc);

-- quotes: comparison grid filters by rfq + status, orders by sent_at
create index if not exists quotes_rfq_status_sent_idx
  on public.quotes (rfq_id, status, sent_at);

-- quotes: supplier quote history list (My Quotes) orders by created_at
create index if not exists quotes_supplier_created_idx
  on public.quotes (supplier_id, created_at desc);

-- bookings: organizer "awaiting supplier confirmation" queue
create index if not exists bookings_org_status_deadline_idx
  on public.bookings (organizer_id, confirmation_status, confirm_deadline);

-- supplier_media: portfolio surface filters by kind (photo vs document vs
-- video) within a supplier and orders by sort_order
create index if not exists supplier_media_supplier_kind_sort_idx
  on public.supplier_media (supplier_id, kind, sort_order);
