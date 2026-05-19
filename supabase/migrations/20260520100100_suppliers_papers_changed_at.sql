-- =============================================================================
-- 20260520100100 — suppliers.papers_changed_at + trigger.
--
-- After initial approval, a supplier may re-upload or replace documents. Today
-- there is no signal to the admin that anything changed. This migration adds
-- `papers_changed_at` to `suppliers` and a trigger that keeps it in sync with
-- *supplier-initiated* edits on `supplier_docs` (insert, file_path update,
-- delete). Status changes are NOT in the trigger because they come from the
-- admin reviewing the doc and would otherwise immediately re-dirty the flag
-- the moment the admin clicks approve.
--
-- The inbox badge logic ("papers updated since last review") compares
-- `papers_changed_at` against `verified_at` and lights up when the former is
-- newer. Backfill below seeds existing rows so the comparison is well-defined
-- from the moment this migration lands.
-- =============================================================================

set search_path = public;

alter table public.suppliers
  add column papers_changed_at timestamptz;

-- Backfill: most-recent doc upload (or supplier creation, when no docs).
-- Suppliers approved before any doc churn will end up with
-- `papers_changed_at <= verified_at` and so won't false-positive the badge.
update public.suppliers s
   set papers_changed_at = coalesce(
         (select max(created_at) from public.supplier_docs d where d.supplier_id = s.id),
         s.created_at
       );

create or replace function public.bump_supplier_papers_changed_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.supplier_id, old.supplier_id);
  update public.suppliers
     set papers_changed_at = now()
   where id = target_id;
  return coalesce(new, old);
end
$$;

-- Fire on insert (new doc uploaded by supplier).
drop trigger if exists supplier_docs_bump_changed_at_insert on public.supplier_docs;
create trigger supplier_docs_bump_changed_at_insert
  after insert on public.supplier_docs
  for each row
  execute function public.bump_supplier_papers_changed_at();

-- Fire on file_path change (supplier replaced the underlying file).
-- Deliberately scoped to file_path only: status changes are admin-driven and
-- must not bump the flag.
drop trigger if exists supplier_docs_bump_changed_at_update on public.supplier_docs;
create trigger supplier_docs_bump_changed_at_update
  after update of file_path on public.supplier_docs
  for each row
  when (old.file_path is distinct from new.file_path)
  execute function public.bump_supplier_papers_changed_at();

-- Fire on delete (a doc disappearing is a change too).
drop trigger if exists supplier_docs_bump_changed_at_delete on public.supplier_docs;
create trigger supplier_docs_bump_changed_at_delete
  after delete on public.supplier_docs
  for each row
  execute function public.bump_supplier_papers_changed_at();

notify pgrst, 'reload schema';
