-- P0-2: Missing FK indexes will sequentially scan on cascade / lookup.
--
-- Each FK column gets a btree index. Nullable FKs get a partial index
-- WHERE col IS NOT NULL — the NULL rows are uninteresting for cascade /
-- joins and partial indexes stay leaner. Non-nullable FKs get full
-- btree indexes.
--
-- IF NOT EXISTS makes the migration replay-safe. CONCURRENTLY would be
-- safer at scale but cannot run inside a transaction; on the local DB
-- (smallest table is empty, largest is 67 rows) the brief lock is fine.

-- bookings (3 non-null FKs + 1 nullable)
create index if not exists bookings_accepted_quote_revision_idx
  on public.bookings(accepted_quote_revision_id);
create index if not exists bookings_quote_id_idx
  on public.bookings(quote_id);
create index if not exists bookings_rfq_id_idx
  on public.bookings(rfq_id);
create index if not exists bookings_cancelled_by_idx
  on public.bookings(cancelled_by) where cancelled_by is not null;

-- disputes (1 non-null + 1 nullable)
create index if not exists disputes_raised_by_idx
  on public.disputes(raised_by);
create index if not exists disputes_resolved_by_idx
  on public.disputes(resolved_by) where resolved_by is not null;

-- quote_revisions
create index if not exists quote_revisions_author_id_idx
  on public.quote_revisions(author_id);

-- rfqs
create index if not exists rfqs_cancelled_by_idx
  on public.rfqs(cancelled_by) where cancelled_by is not null;

-- suppliers
create index if not exists suppliers_verified_by_idx
  on public.suppliers(verified_by) where verified_by is not null;

-- availability_blocks
create index if not exists availability_blocks_created_by_idx
  on public.availability_blocks(created_by) where created_by is not null;

-- supplier_docs
create index if not exists supplier_docs_reviewed_by_idx
  on public.supplier_docs(reviewed_by) where reviewed_by is not null;

-- quote_proposal_requests
create index if not exists quote_proposal_requests_requested_by_idx
  on public.quote_proposal_requests(requested_by);
