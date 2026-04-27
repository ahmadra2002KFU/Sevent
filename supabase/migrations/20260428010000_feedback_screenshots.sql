-- feedback-screenshots: optional viewport screenshot attached to app_feedback.
--
-- Companion to 20260428000000_app_feedback.sql. The widget captures the page
-- via html2canvas, downscales + JPEG-compresses, and uploads the blob through
-- the server action; the action then resolves the storage path and stores it
-- in `app_feedback.screenshot_path`.
--
-- Path convention: {user_id}/{uuid}.{ext} — user_id is the auth.users.id of
-- the submitter, derived server-side. RLS lets that user (and only that user)
-- INSERT to their own folder, defends against a forged path that targets
-- another user's folder, and gates SELECT/DELETE to admins.
--
-- All auth.uid() / is_admin() calls are wrapped as (SELECT …) per the recent
-- P1 RLS initplan sweep.

set search_path = public;

-- ─── 1. Column on app_feedback ────────────────────────────────────────────────

alter table public.app_feedback
  add column if not exists screenshot_path text;

-- ─── 2. Bucket ────────────────────────────────────────────────────────────────

-- Private bucket. file_size_limit is a hard ceiling at the storage layer; the
-- server action enforces a tighter cap (~3 MB) and the client compresses to
-- well under that. allowed_mime_types is the storage-level MIME guard.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-screenshots',
  'feedback-screenshots',
  false,
  3145728, -- 3 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ─── 3. Policies ──────────────────────────────────────────────────────────────

-- INSERT: authenticated user, must write into a folder named by their own
-- auth uid. split_part(name, '/', 1) is the first path segment.
drop policy if exists "feedback-screenshots: owner upload" on storage.objects;
create policy "feedback-screenshots: owner upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'feedback-screenshots'
    and (select auth.uid())::text = split_part(name, '/', 1)
  );

-- SELECT: admins only. Admin queue uses service-role anyway, but defense in
-- depth in case anything ever reads with the user's session.
drop policy if exists "feedback-screenshots: admin read" on storage.objects;
create policy "feedback-screenshots: admin read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'feedback-screenshots'
    and (select public.is_admin())
  );

-- DELETE: admins only. Owners cannot delete (audit trail); admins use the
-- service-role console for redactions.
drop policy if exists "feedback-screenshots: admin delete" on storage.objects;
create policy "feedback-screenshots: admin delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'feedback-screenshots'
    and (select public.is_admin())
  );
