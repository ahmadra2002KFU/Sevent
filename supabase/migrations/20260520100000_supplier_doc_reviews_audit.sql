-- =============================================================================
-- 20260520100000 — supplier_doc_reviews audit log.
--
-- Captures every per-document review action (approve / reject) so the admin
-- can re-review a supplier's papers after initial approval and we keep a
-- durable history of "who decided what, when, why."
--
-- Append-only: there is no UPDATE / DELETE policy. Inserts come from the
-- service-role action layer (src/app/(admin)/admin/verifications/actions.ts).
-- `supplier_id` is denormalized so per-supplier history queries don't need to
-- re-join through `supplier_docs` (which may have been cascade-deleted).
-- =============================================================================

set search_path = public;

create table public.supplier_doc_reviews (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.supplier_docs (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  prior_status text not null check (prior_status in ('pending', 'approved', 'rejected')),
  new_status text not null check (new_status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now()
);

create index supplier_doc_reviews_doc_idx
  on public.supplier_doc_reviews (doc_id, created_at desc);
create index supplier_doc_reviews_supplier_idx
  on public.supplier_doc_reviews (supplier_id, created_at desc);

alter table public.supplier_doc_reviews enable row level security;

-- Read: admin only.
create policy "supplier_doc_reviews: admin read" on public.supplier_doc_reviews
  for select using (public.is_admin());

-- Insert: admin only. No UPDATE / DELETE policy is defined intentionally —
-- the table is append-only by design.
create policy "supplier_doc_reviews: admin insert" on public.supplier_doc_reviews
  for insert with check (public.is_admin());

notify pgrst, 'reload schema';
