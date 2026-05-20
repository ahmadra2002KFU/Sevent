-- Sevent · migration 20260521100000: per-بند RFQ attachments (images + documents).
--
-- Organizers add manual line items (بنود) on the event-creation form; each بند
-- auto-publishes one RFQ (requirements_jsonb.kind='generic'). This table lets an
-- organizer attach images/documents to a بند so they travel with that بند's RFQ
-- and are visible to the responding/marketplace suppliers (+ admin) while quoting.
--
-- Files are NOT stored in rfqs.requirements_jsonb (it is a strict discriminated
-- union — see src/lib/domain/rfq.ts). This is the separate, normalized home,
-- mirroring supplier_docs / dispute_evidence.
--
-- The companion migration (..._rfq_attachments_bucket.sql) adds the private
-- storage bucket + storage.objects RLS. Path layout:
--   rfq-attachments/{event_id}/{rfq_id}/{timestamp}-{uuid}-{safe_name}
--
-- The Server Action layer uploads via the service-role client AFTER the RFQ row
-- exists (rfq_id is generated server-side), so there is no authenticated INSERT
-- policy here — same pattern as dispute_evidence/contracts.

set search_path = public;

-- Enum ------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'rfq_attachment_kind') then
    create type public.rfq_attachment_kind as enum ('image', 'document');
  end if;
end
$$;

-- Table -----------------------------------------------------------------------
create table if not exists public.rfq_attachments (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  -- Denormalized for the storage path prefix + cheap event-scoped queries.
  -- NOT a trust boundary: RLS still resolves access through rfq_id → events.
  event_id uuid not null references public.events (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  kind public.rfq_attachment_kind not null,
  -- Full object path inside the rfq-attachments bucket. UNIQUE so the storage
  -- RLS join (storage.objects.name = rfq_attachments.file_path) is 1:1 and a
  -- path can't be reused/forged across rows.
  file_path text not null unique,
  file_name text not null,        -- sanitized original name, for display
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);

create index if not exists rfq_attachments_rfq_idx
  on public.rfq_attachments (rfq_id, created_at);
create index if not exists rfq_attachments_event_idx
  on public.rfq_attachments (event_id);

alter table public.rfq_attachments enable row level security;

-- RLS -------------------------------------------------------------------------
-- Four read audiences, copy-identical to the existing rfqs policies (see
-- 20260420000100 + 20260504051000_rfqs_marketplace_rls). The `(select ...)`
-- wrapping is intentional — matches the planner-caching form from the initplan
-- sweep (20260505010000). If the rfqs read policies change, change these in
-- lockstep.

-- Admin can do anything.
drop policy if exists "rfq_attachments: admin all" on public.rfq_attachments;
create policy "rfq_attachments: admin all" on public.rfq_attachments
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

-- Organizer who owns the parent event.
drop policy if exists "rfq_attachments: organizer read" on public.rfq_attachments;
create policy "rfq_attachments: organizer read" on public.rfq_attachments
  for select using (
    exists (
      select 1 from public.events e
       where e.id = rfq_attachments.event_id
         and e.organizer_id = (select auth.uid())
    )
  );

-- Supplier invited to (or self-applied on) the parent RFQ.
drop policy if exists "rfq_attachments: invited supplier read" on public.rfq_attachments;
create policy "rfq_attachments: invited supplier read" on public.rfq_attachments
  for select using (
    exists (
      select 1
        from public.rfq_invites inv
        join public.suppliers s on s.id = inv.supplier_id
       where inv.rfq_id = rfq_attachments.rfq_id
         and s.profile_id = (select auth.uid())
    )
  );

-- Approved + published supplier viewing a live marketplace RFQ.
drop policy if exists "rfq_attachments: marketplace supplier read" on public.rfq_attachments;
create policy "rfq_attachments: marketplace supplier read" on public.rfq_attachments
  for select using (
    exists (
      select 1 from public.rfqs r
       where r.id = rfq_attachments.rfq_id
         and r.is_published_to_marketplace
         and r.status = 'sent'
    )
    and exists (
      select 1 from public.suppliers s
       where s.profile_id = (select auth.uid())
         and s.verification_status = 'approved'
         and s.is_published
    )
  );

-- No INSERT/UPDATE/DELETE policy for authenticated. The Server Action layer
-- resolves access first, then writes via the service-role client (bypasses RLS),
-- because the row's access can't be validated before it exists and uploads must
-- happen after the RFQ is created server-side.
