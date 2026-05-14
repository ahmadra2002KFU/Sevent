-- Sevent · admin users surface: profiles_with_email view + list-with-stats RPC.
--
-- Powers the new /admin/users page and replaces two unscalable patterns:
--   1. compose's resolveUserIdByEmail() paging auth.admin.listUsers up to 50
--      pages to turn a typed email into a user id.
--   2. /admin/messages doing one auth.admin.getUserById() per visible thread
--      row to resolve recipient emails.
--
-- Access model: both objects are granted to service_role ONLY. The app
-- authenticates the caller with requireAccess(...) and then reads through the
-- RLS-bypassing service-role client (see src/lib/auth/access.ts and the note
-- in src/lib/messaging/threads.ts). An in-function is_admin() check would not
-- work here — under the service-role client auth.uid() is null.

-- =============================================================================
-- profiles_with_email — profiles joined with auth.users.email
-- =============================================================================
-- security_invoker stays at its default (false) on purpose: the view runs with
-- the owner's rights so the auth.users read succeeds. Do NOT flip it to true.

create or replace view public.profiles_with_email as
  select
    p.id,
    p.role,
    p.full_name,
    p.phone,
    p.language,
    p.created_at,
    p.updated_at,
    u.email
  from public.profiles p
  join auth.users u on u.id = p.id;

comment on view public.profiles_with_email is
  'Admin-only: profiles joined with auth.users.email. service_role select only; '
  'callers must already be admin-gated in app code (requireAccess).';

revoke all on public.profiles_with_email from public, anon, authenticated;
grant select on public.profiles_with_email to service_role;

-- =============================================================================
-- admin_list_users_with_stats — one page of users + messaging stats
-- =============================================================================
-- Page first, aggregate second: filter+sort+paginate the user set, then join
-- per-user thread stats only for that page. count(*) over () carries the total
-- so the caller needs a single round-trip. unread_count uses read_at_admin IS
-- NULL (admin-side "needs attention", matching countUnreadThreadsForAdmin).

create or replace function public.admin_list_users_with_stats(
  p_search text default null,
  p_role   public.sevent_role default null,
  p_limit  integer default 25,
  p_offset integer default 0
)
returns table (
  id            uuid,
  email         text,
  full_name     text,
  role          public.sevent_role,
  created_at    timestamptz,
  thread_count  bigint,
  unread_count  bigint,
  last_activity timestamptz,
  total_count   bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select p.id, u.email, p.full_name, p.role, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where (p_role is null or p.role = p_role)
      and (
        p_search is null
        or p.full_name ilike '%' || p_search || '%'
        or u.email     ilike '%' || p_search || '%'
      )
  ),
  page as (
    select f.*, count(*) over () as total_count
    from filtered f
    order by f.created_at desc
    limit greatest(p_limit, 1)
    offset greatest(p_offset, 0)
  )
  select
    pg.id,
    pg.email,
    pg.full_name,
    pg.role,
    pg.created_at,
    coalesce(s.thread_count, 0) as thread_count,
    coalesce(s.unread_count, 0) as unread_count,
    s.last_activity,
    pg.total_count
  from page pg
  left join lateral (
    select
      count(*) as thread_count,
      count(*) filter (where af.read_at_admin is null) as unread_count,
      max(af.last_message_at) as last_activity
    from public.app_feedback af
    where af.user_id = pg.id
  ) s on true
  order by pg.created_at desc;
$$;

comment on function public.admin_list_users_with_stats(text, public.sevent_role, integer, integer) is
  'Admin-only: one page of users (filtered by search/role) with per-user thread '
  'stats. service_role execute only; caller must be admin-gated in app code.';

revoke all on function public.admin_list_users_with_stats(text, public.sevent_role, integer, integer) from public;
grant execute on function public.admin_list_users_with_stats(text, public.sevent_role, integer, integer) to service_role;
