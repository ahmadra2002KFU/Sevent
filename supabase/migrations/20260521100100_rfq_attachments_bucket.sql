-- Sevent · migration 20260521100100: rfq-attachments storage bucket + RLS.
--
-- Companion to 20260521100000_rfq_attachments.sql. Adds a private bucket for the
-- per-بند images/documents. Path layout:
--
--   rfq-attachments/{event_id}/{rfq_id}/{timestamp}-{uuid}-{safe_name}
--
-- The same path is stored in rfq_attachments.file_path so the storage RLS
-- policies resolve access by joining storage.objects.name = rfq_attachments
-- .file_path up to the parent rfq/event — the SAME four audiences as the row
-- table (organizer-owns-event, invited supplier, marketplace supplier, admin).
--
-- INSERT/UPDATE/DELETE from authenticated/anon is NOT granted. The Server Action
-- layer resolves access first, then uploads via the service-role client (which
-- bypasses RLS). Mirrors 20260512130000_dispute_evidence_bucket.

set search_path = public;

-- Bucket ----------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('rfq-attachments', 'rfq-attachments', false)
on conflict (id) do nothing;

-- Helpers ---------------------------------------------------------------------
create or replace function public.storage_rfq_attachment_event_id_from_path(path text)
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

comment on function public.storage_rfq_attachment_event_id_from_path(text) is
  'Extracts event_id (UUID) from an rfq-attachments storage object path.';

-- RLS policies ----------------------------------------------------------------

-- Admin can do anything.
drop policy if exists "rfq-attachments: admin all" on storage.objects;
create policy "rfq-attachments: admin all" on storage.objects
  for all to public
  using ((bucket_id = 'rfq-attachments' and (select public.is_admin())))
  with check ((bucket_id = 'rfq-attachments' and (select public.is_admin())));

-- Audience read: the object's rfq_attachments row must be visible to the caller
-- as organizer-owner, invited supplier, or live-marketplace approved supplier.
-- Predicate mirrors the row-table policies in 20260521100000 — keep in lockstep.
drop policy if exists "rfq-attachments: audience read" on storage.objects;
create policy "rfq-attachments: audience read" on storage.objects
  for select to public
  using (
    bucket_id = 'rfq-attachments'
    and exists (
      select 1
        from public.rfq_attachments a
        join public.rfqs r on r.id = a.rfq_id
        join public.events e on e.id = a.event_id
       where a.file_path = name
         and (
           -- organizer owns the parent event
           e.organizer_id = (select auth.uid())
           -- supplier invited to / self-applied on the parent RFQ
           or exists (
             select 1
               from public.rfq_invites inv
               join public.suppliers s on s.id = inv.supplier_id
              where inv.rfq_id = r.id
                and s.profile_id = (select auth.uid())
           )
           -- approved + published supplier viewing a live marketplace RFQ
           or (
             r.is_published_to_marketplace
             and r.status = 'sent'
             and exists (
               select 1 from public.suppliers s
                where s.profile_id = (select auth.uid())
                  and s.verification_status = 'approved'
                  and s.is_published
             )
           )
         )
    )
  );

-- No INSERT/UPDATE/DELETE policy for authenticated. Service-role bypasses RLS.
