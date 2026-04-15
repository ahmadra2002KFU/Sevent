-- Sevent · migration 0003: storage buckets + RLS.
-- Sprint 2 · Lane 0. Prepares the three buckets that Sprint 2 lanes upload to:
--   * supplier-portfolio — portfolio media, readable publicly once supplier is
--     approved + published; writable by owning supplier only.
--   * supplier-docs       — verification documents, strictly owner + admin.
--   * contracts           — booking contracts, readable only by the two parties
--     (organizer + supplier) + admin; writable only by service-role (server).
--
-- RLS on storage.objects is evaluated as SELECT on auth.uid() vs metadata in the
-- object row. We enforce ownership via the locked path prefix `{supplier_id}/…`
-- per src/lib/supabase/storage.ts.

set search_path = public;

-- Buckets ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('supplier-portfolio', 'supplier-portfolio', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('supplier-docs', 'supplier-docs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

-- Helpers ---------------------------------------------------------------------
create or replace function public.storage_supplier_id_from_path(path text)
returns uuid
language plpgsql
immutable
as $$
declare
  head text;
  id uuid;
begin
  head := split_part(path, '/', 1);
  begin
    id := head::uuid;
  exception when others then
    return null;
  end;
  return id;
end;
$$;

create or replace function public.storage_path_owner_profile(path text)
returns uuid
language sql
stable
as $$
  select s.profile_id
    from public.suppliers s
   where s.id = public.storage_supplier_id_from_path(path)
$$;

-- supplier-portfolio ----------------------------------------------------------
drop policy if exists "portfolio: public read when published" on storage.objects;
create policy "portfolio: public read when published"
  on storage.objects for select
  using (
    bucket_id = 'supplier-portfolio'
    and exists (
      select 1 from public.suppliers s
      where s.id = public.storage_supplier_id_from_path(name)
        and s.is_published and s.verification_status = 'approved'
    )
  );

drop policy if exists "portfolio: owner write" on storage.objects;
create policy "portfolio: owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'supplier-portfolio'
    and auth.uid() = public.storage_path_owner_profile(name)
  );

drop policy if exists "portfolio: owner update" on storage.objects;
create policy "portfolio: owner update"
  on storage.objects for update
  using (
    bucket_id = 'supplier-portfolio'
    and auth.uid() = public.storage_path_owner_profile(name)
  )
  with check (
    bucket_id = 'supplier-portfolio'
    and auth.uid() = public.storage_path_owner_profile(name)
  );

drop policy if exists "portfolio: owner delete" on storage.objects;
create policy "portfolio: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'supplier-portfolio'
    and auth.uid() = public.storage_path_owner_profile(name)
  );

drop policy if exists "portfolio: admin all" on storage.objects;
create policy "portfolio: admin all"
  on storage.objects for all
  using (bucket_id = 'supplier-portfolio' and public.is_admin())
  with check (bucket_id = 'supplier-portfolio' and public.is_admin());

-- supplier-docs ---------------------------------------------------------------
drop policy if exists "docs: owner read" on storage.objects;
create policy "docs: owner read"
  on storage.objects for select
  using (
    bucket_id = 'supplier-docs'
    and auth.uid() = public.storage_path_owner_profile(name)
  );

drop policy if exists "docs: owner write" on storage.objects;
create policy "docs: owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'supplier-docs'
    and auth.uid() = public.storage_path_owner_profile(name)
  );

drop policy if exists "docs: owner update" on storage.objects;
create policy "docs: owner update"
  on storage.objects for update
  using (
    bucket_id = 'supplier-docs'
    and auth.uid() = public.storage_path_owner_profile(name)
  )
  with check (
    bucket_id = 'supplier-docs'
    and auth.uid() = public.storage_path_owner_profile(name)
  );

drop policy if exists "docs: owner delete" on storage.objects;
create policy "docs: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'supplier-docs'
    and auth.uid() = public.storage_path_owner_profile(name)
  );

drop policy if exists "docs: admin read" on storage.objects;
create policy "docs: admin read"
  on storage.objects for select
  using (bucket_id = 'supplier-docs' and public.is_admin());

drop policy if exists "docs: admin write" on storage.objects;
create policy "docs: admin write"
  on storage.objects for all
  using (bucket_id = 'supplier-docs' and public.is_admin())
  with check (bucket_id = 'supplier-docs' and public.is_admin());

-- contracts -------------------------------------------------------------------
-- Contracts are written by service-role only (server-side after booking
-- confirmation). Readable by the organizer + supplier of the booking + admin.
-- Booking-party read check is deferred to Sprint 5 (when contracts are first
-- generated); for now only admin reads + service-role writes.

drop policy if exists "contracts: admin read" on storage.objects;
create policy "contracts: admin read"
  on storage.objects for select
  using (bucket_id = 'contracts' and public.is_admin());

drop policy if exists "contracts: admin all" on storage.objects;
create policy "contracts: admin all"
  on storage.objects for all
  using (bucket_id = 'contracts' and public.is_admin())
  with check (bucket_id = 'contracts' and public.is_admin());
