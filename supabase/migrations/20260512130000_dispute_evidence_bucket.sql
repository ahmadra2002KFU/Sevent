-- Sevent · migration 20260512130000: dispute-evidence storage bucket + RLS.
-- Sprint "Pilot Closure" Slice 4 stream A (DB/storage/state-machine).
--
-- Adds a sixth private storage bucket for dispute evidence files. Path layout:
--
--   dispute-evidence/{dispute_id}/{submitter_profile_id}/{timestamp}-{safe_name}
--
-- The same path is stored in dispute_evidence.file_path so the storage RLS
-- policies can resolve party access by joining storage.objects.name = dispute_
-- evidence.file_path.
--
-- INSERT/UPDATE/DELETE from authenticated/anon is NOT granted. The Server
-- Action layer resolves party access first, then uploads via the service-role
-- client (which bypasses RLS). This is per opencode plan review §3 — storage
-- INSERT policies can't validate a dispute_evidence row before it exists.

set search_path = public;

-- Bucket ----------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('dispute-evidence', 'dispute-evidence', false)
on conflict (id) do nothing;

-- Helpers ---------------------------------------------------------------------
create or replace function public.storage_dispute_id_from_path(path text)
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

comment on function public.storage_dispute_id_from_path(text) is
  'Extracts dispute_id (UUID) from a dispute-evidence storage object path.';

-- RLS policies ----------------------------------------------------------------

-- Admin can do anything.
drop policy if exists "dispute-evidence: admin all" on storage.objects;
create policy "dispute-evidence: admin all" on storage.objects
  for all to public
  using ((bucket_id = 'dispute-evidence' and (select public.is_admin())))
  with check ((bucket_id = 'dispute-evidence' and (select public.is_admin())));

-- Booking parties (organizer + supplier owner profile) can SELECT evidence
-- objects whose dispute_evidence row is visible to them. A submitter can
-- always read their own evidence even when visible_to_other_party=false.
drop policy if exists "dispute-evidence: party read" on storage.objects;
create policy "dispute-evidence: party read" on storage.objects
  for select to public
  using (
    bucket_id = 'dispute-evidence'
    and exists (
      select 1
        from public.dispute_evidence ev
        join public.disputes d on d.id = ev.dispute_id
        join public.bookings b on b.id = d.booking_id
        left join public.suppliers s on s.id = b.supplier_id
       where ev.file_path = name
         and (
              b.organizer_id = (select auth.uid())
           or s.profile_id   = (select auth.uid())
         )
         and (
              ev.visible_to_other_party = true
           or ev.submitted_by           = (select auth.uid())
         )
    )
  );

-- No INSERT/UPDATE/DELETE policy for authenticated. Service-role bypasses RLS.
