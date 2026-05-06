-- messaging: extend app_feedback into a thread container.
--
-- Round-2 of the notification-system review redirected the work into a
-- two-way threaded admin↔user messaging system. Per the approved plan, we
-- extend the existing public.app_feedback table (one-way feedback) into a
-- thread parent rather than build a parallel chat schema.
--
-- This migration only TOUCHES the app_feedback table:
--   • adds the feedback_initiator enum and `initiator` column
--   • adds `subject`, `campaign_id`, `read_at_user`, `read_at_admin`,
--     `last_message_at`, `closed_at`, `request_id`
--   • drops NOT NULL from `category` (admin-initiated threads have none)
--   • loosens `message` length check from 5000 to 10000 to match the new
--     feedback_messages.body cap (so a long admin first-message can also be
--     stored as the denormalized first-message snapshot)
--   • adds the request_id unique partial index (per-row idempotency for
--     user submissions and admin single-user composes)
--   • adds the last_message_at desc index (powers list ordering)
--   • adds an unread-for-user partial index (powers the user inbox badge)
--
-- The campaign_id FK is added in the next migration (20260505060000) once
-- public.feedback_campaigns exists.
--
-- All auth.uid() / is_admin() calls in policies are wrapped as (SELECT …) per
-- the P1 RLS initplan sweep (20260505010000).

set search_path = public;

-- ─── 1. Enum ─────────────────────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_type where typname = 'feedback_initiator') then
    create type public.feedback_initiator as enum ('user','admin');
  end if;
end $$;

-- ─── 2. Columns ──────────────────────────────────────────────────────────────

alter table public.app_feedback
  add column if not exists initiator public.feedback_initiator not null default 'user',
  add column if not exists subject text,
  add column if not exists campaign_id uuid,
  add column if not exists read_at_user timestamptz,
  add column if not exists read_at_admin timestamptz,
  add column if not exists last_message_at timestamptz not null default now(),
  add column if not exists closed_at timestamptz,
  add column if not exists request_id uuid;

-- Admin-initiated threads have no category — drop the NOT NULL.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_feedback'
      and column_name = 'category' and is_nullable = 'NO'
  ) then
    alter table public.app_feedback alter column category drop not null;
  end if;
end $$;

-- Replace the message-length check to match feedback_messages.body cap (10k).
-- The original constraint name is auto-generated: app_feedback_message_check.
alter table public.app_feedback
  drop constraint if exists app_feedback_message_check;
alter table public.app_feedback
  add constraint app_feedback_message_check
  check (char_length(message) between 1 and 10000);

-- ─── 3. Indexes ──────────────────────────────────────────────────────────────

create unique index if not exists app_feedback_request_id_uidx
  on public.app_feedback (request_id) where request_id is not null;

create index if not exists app_feedback_last_message_at_idx
  on public.app_feedback (last_message_at desc);

-- Sized for the user inbox unread query: only carries threads where the user
-- still has unseen activity. Stays tiny because most threads are read.
create index if not exists app_feedback_unread_user_idx
  on public.app_feedback (user_id, last_message_at desc)
  where read_at_user is null or read_at_user < last_message_at;
