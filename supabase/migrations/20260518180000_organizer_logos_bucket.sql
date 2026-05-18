-- =============================================================================
-- 20260518180000 — organizer-logos storage bucket + RLS.
--
-- PR 2 of the multi-user company-organizer refactor.
--
-- Mirror of the supplier-logos bucket (20260504005000) but keyed on company
-- membership rather than supplier ownership.
--
-- Path convention: `{company_id}/<filename>` — the leading UUID segment is
-- the company id, matching the supplier-logos `{supplier_id}/…` shape so
-- the same `split_part(name, '/', 1)::uuid` helper pattern works.
--
-- RLS shape:
--   * Public SELECT — logos appear on RFQ emails to suppliers, marketing
--     surfaces, and admin views; treating them as private would require
--     signed URLs everywhere with little security benefit. (The logo itself
--     is not sensitive; the company name is already on every RFQ.)
--   * INSERT / UPDATE / DELETE — must be a current owner OR admin of the
--     company. is_company_admin is the helper from PR 1.
--   * Admin override — global admin role can do anything (consistent with
--     supplier-logos pattern via public.is_admin()).
-- =============================================================================

set search_path = public;

-- Bucket ----------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('organizer-logos', 'organizer-logos', false)
on conflict (id) do nothing;

-- Helper — extract company_id from a storage object path. Mirrors the
-- supplier_id_from_path pattern in 20260504000000. IMMUTABLE so it can be
-- inlined into policies and indexes.
create or replace function public.storage_company_id_from_path(path text)
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

-- Policies --------------------------------------------------------------------

drop policy if exists "organizer-logos: public read" on storage.objects;
create policy "organizer-logos: public read"
  on storage.objects for select
  using (
    bucket_id = 'organizer-logos'
  );

drop policy if exists "organizer-logos: admin/owner write" on storage.objects;
create policy "organizer-logos: admin/owner write"
  on storage.objects for insert
  with check (
    bucket_id = 'organizer-logos'
    and public.is_company_admin(public.storage_company_id_from_path(name))
  );

drop policy if exists "organizer-logos: admin/owner update" on storage.objects;
create policy "organizer-logos: admin/owner update"
  on storage.objects for update
  using (
    bucket_id = 'organizer-logos'
    and public.is_company_admin(public.storage_company_id_from_path(name))
  )
  with check (
    bucket_id = 'organizer-logos'
    and public.is_company_admin(public.storage_company_id_from_path(name))
  );

drop policy if exists "organizer-logos: admin/owner delete" on storage.objects;
create policy "organizer-logos: admin/owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'organizer-logos'
    and public.is_company_admin(public.storage_company_id_from_path(name))
  );

drop policy if exists "organizer-logos: site admin all" on storage.objects;
create policy "organizer-logos: site admin all"
  on storage.objects for all
  using (bucket_id = 'organizer-logos' and public.is_admin())
  with check (bucket_id = 'organizer-logos' and public.is_admin());

notify pgrst, 'reload schema';
