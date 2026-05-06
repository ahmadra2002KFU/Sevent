-- messaging: app_feedback RLS additions + read-state RPCs + bump trigger.
--
-- 1) Add an "owner read" SELECT policy to app_feedback so users can see their
--    own threads (previously admin-only). Multiple SELECT policies OR
--    together: admin keeps full read.
--
-- 2) Add an "admin insert" INSERT policy so admin-initiated threads (where
--    user_id ≠ auth.uid()) pass the with-check. The existing "insert own"
--    policy still covers user-initiated rows. Postgres OR's INSERT policies.
--
-- 3) Read-state RPCs. We deliberately do NOT broaden the existing
--    admin-only UPDATE policy to let users mutate read_at_user — that would
--    repeat the round-1 F-1 smell (broad UPDATE access). Instead, expose two
--    SECURITY DEFINER RPCs that mutate exactly read_at_user / read_at_admin
--    after validating the caller in-function:
--      • mark_feedback_thread_read(thread_id) — caller must be the thread's
--        user_id; sets read_at_user = now().
--      • mark_feedback_thread_read_admin(thread_id) — caller must be admin;
--        sets read_at_admin = now().
--    Both EXECUTE-grant only `authenticated`; PUBLIC is revoked.
--
-- 4) Bump trigger on feedback_messages keeps app_feedback.last_message_at
--    fresh on every insert (powers list ordering and the unread index).
--
-- All auth.uid() / is_admin() in policies wrapped as (SELECT …).

set search_path = public;

-- ─── 1. Owner read on app_feedback ───────────────────────────────────────────

drop policy if exists "app_feedback: owner read" on public.app_feedback;
create policy "app_feedback: owner read"
  on public.app_feedback
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ─── 2. Admin insert on app_feedback ─────────────────────────────────────────

drop policy if exists "app_feedback: admin insert" on public.app_feedback;
create policy "app_feedback: admin insert"
  on public.app_feedback
  for insert to authenticated
  with check (
    (select public.is_admin())
    and initiator = 'admin'
  );

-- ─── 3. Read-state RPCs ──────────────────────────────────────────────────────

create or replace function public.mark_feedback_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_feedback
  set read_at_user = now()
  where id = p_thread_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.mark_feedback_thread_read_admin(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.app_feedback
  set read_at_admin = now()
  where id = p_thread_id;
end;
$$;

revoke all on function public.mark_feedback_thread_read(uuid) from public;
revoke all on function public.mark_feedback_thread_read_admin(uuid) from public;
grant execute on function public.mark_feedback_thread_read(uuid)       to authenticated;
grant execute on function public.mark_feedback_thread_read_admin(uuid) to authenticated;

-- ─── 4. Bump trigger ─────────────────────────────────────────────────────────

create or replace function public.bump_feedback_thread_last_message()
returns trigger
language plpgsql
as $$
begin
  update public.app_feedback
  set last_message_at = NEW.created_at
  where id = NEW.thread_id
    and last_message_at < NEW.created_at;
  return NEW;
end;
$$;

drop trigger if exists feedback_messages_bump_thread on public.feedback_messages;
create trigger feedback_messages_bump_thread
  after insert on public.feedback_messages
  for each row execute function public.bump_feedback_thread_last_message();
