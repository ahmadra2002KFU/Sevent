-- =============================================================================
-- 20260520100200 — admin_thread_recipient_changes RPC.
--
-- The admin messages inbox renders 25 threads per page. For each page we need
-- to know which of those threads' recipients (suppliers) have re-uploaded
-- papers since the last full sign-off, so the row can show a "Papers updated"
-- badge. A single batched RPC keeps this O(1) round-trips per page.
--
-- Consumer: src/lib/messaging/threads.ts → listThreadsForAdmin.
-- Only service-role can call this — the admin client used by server actions
-- runs with service-role.
-- =============================================================================

set search_path = public;

create or replace function public.admin_thread_recipient_changes(p_user_ids uuid[])
returns table (
  user_id uuid,
  papers_changed_at timestamptz,
  verified_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.profile_id, s.papers_changed_at, s.verified_at
    from public.suppliers s
   where s.profile_id = any (p_user_ids)
     and s.papers_changed_at is not null
     and s.verified_at is not null
     and s.papers_changed_at > s.verified_at;
$$;

revoke all on function public.admin_thread_recipient_changes(uuid[]) from public, authenticated, anon;
grant execute on function public.admin_thread_recipient_changes(uuid[]) to service_role;

notify pgrst, 'reload schema';
