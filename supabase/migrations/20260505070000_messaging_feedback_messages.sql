-- messaging: feedback_messages — per-thread message log.
--
-- Every reply (and the first message of every thread) lives here. Children of
-- public.app_feedback by `thread_id`. Immutable: no UPDATE / DELETE policies.
-- Edits are a v2 add-on via the `edited_at` column.
--
-- RLS enforces:
--   • SELECT: admin OR the thread owner (app_feedback.user_id = auth.uid())
--   • INSERT: admin sending as 'admin' role, OR the thread owner sending as
--             their own role and own user_id.
-- Both check the parent app_feedback row to validate ownership.
--
-- The bump trigger on this table (in 20260505090000) keeps
-- app_feedback.last_message_at fresh.

set search_path = public;

-- ─── 1. Table ────────────────────────────────────────────────────────────────

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.app_feedback(id) on delete cascade,
  -- on delete set null: messages survive even if the sender account is removed,
  -- preserving the conversation history for audit.
  sender_id uuid references auth.users(id) on delete set null,
  -- Snapshot of sender role at send time (denormalized to match the
  -- app_feedback pattern; lets list/thread queries skip a profiles join).
  sender_role public.sevent_role not null,
  body text not null check (char_length(body) between 1 and 10000),
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists feedback_messages_thread_idx
  on public.feedback_messages (thread_id, created_at);

-- ─── 2. RLS ──────────────────────────────────────────────────────────────────

alter table public.feedback_messages enable row level security;

-- SELECT: admin sees everything.
drop policy if exists "feedback_messages: admin read" on public.feedback_messages;
create policy "feedback_messages: admin read"
  on public.feedback_messages
  for select to authenticated
  using ((select public.is_admin()));

-- SELECT: thread owner (the non-admin participant) sees their own thread.
drop policy if exists "feedback_messages: owner read" on public.feedback_messages;
create policy "feedback_messages: owner read"
  on public.feedback_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.app_feedback t
      where t.id = thread_id
        and t.user_id = (select auth.uid())
    )
  );

-- INSERT: admin sending as admin.
drop policy if exists "feedback_messages: admin insert" on public.feedback_messages;
create policy "feedback_messages: admin insert"
  on public.feedback_messages
  for insert to authenticated
  with check (
    (select public.is_admin())
    and sender_role = 'admin'
    and sender_id = (select auth.uid())
  );

-- INSERT: thread owner replying.
drop policy if exists "feedback_messages: owner insert" on public.feedback_messages;
create policy "feedback_messages: owner insert"
  on public.feedback_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.app_feedback t
      where t.id = thread_id
        and t.user_id = (select auth.uid())
    )
  );

-- No UPDATE / DELETE policies: messages are immutable history.
