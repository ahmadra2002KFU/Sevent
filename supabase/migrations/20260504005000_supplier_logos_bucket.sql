-- Sevent · 2026-04-21 · supplier-logos storage bucket + RLS.
--
-- Companion to 20260421000000_taxonomy_profile_polish.sql. Adds a dedicated
-- bucket for supplier logos. Policy shape mirrors `supplier-portfolio` exactly
-- per Codex review — public read when supplier is approved+published, owner
-- insert/update/delete, admin all — so the logo appears on public profiles but
-- is hidden until verification clears.

set search_path = public;

-- Bucket ----------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('supplier-logos', 'supplier-logos', false)
on conflict (id) do nothing;

-- Policies --------------------------------------------------------------------
-- Ownership is resolved via the locked `{supplier_id}/…` path prefix, reusing
-- the `storage_path_owner_profile` helper declared in the Sprint 2 storage
-- migration (20260504000000_storage_buckets.sql).

drop policy if exists "logos: public read when published" on storage.objects;
create policy "logos: public read when published"
  on storage.objects for select
  using (
    bucket_id = 'supplier-logos'
    and exists (
      select 1 from public.suppliers s
      where s.id = public.storage_supplier_id_from_path(name)
        and s.is_published and s.verification_status = 'approved'
    )
  );

drop policy if exists "logos: owner write" on storage.objects;
create policy "logos: owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'supplier-logos'
    and auth.uid() = public.storage_path_owner_profile(name)
  );

drop policy if exists "logos: owner update" on storage.objects;
create policy "logos: owner update"
  on storage.objects for update
  using (
    bucket_id = 'supplier-logos'
    and auth.uid() = public.storage_path_owner_profile(name)
  )
  with check (
    bucket_id = 'supplier-logos'
    and auth.uid() = public.storage_path_owner_profile(name)
  );

drop policy if exists "logos: owner delete" on storage.objects;
create policy "logos: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'supplier-logos'
    and auth.uid() = public.storage_path_owner_profile(name)
  );

drop policy if exists "logos: admin all" on storage.objects;
create policy "logos: admin all"
  on storage.objects for all
  using (bucket_id = 'supplier-logos' and public.is_admin())
  with check (bucket_id = 'supplier-logos' and public.is_admin());
