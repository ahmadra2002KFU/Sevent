-- app_feedback: in-product feedback capture (bugs, feature requests, etc.)
--
-- ┌─ What this migration does ─────────────────────────────────────────────┐
-- │ 1. Creates feedback_category + feedback_status enums.                  │
-- │ 2. Creates public.app_feedback with rich page-context columns          │
-- │    (page_url, locale, viewport, user_agent, console_errors).           │
-- │ 3. RLS:                                                                 │
-- │      INSERT — any authenticated user, must write their own row         │
-- │      SELECT — admins only                                              │
-- │      UPDATE — admins only (status + admin_notes + resolved_at)         │
-- │      DELETE — locked (no policy = no API delete; audit trail).         │
-- │ 4. Indexes: user_id, created_at desc, partial(status='new'), role,     │
-- │    category — sized for the admin queue's filters.                     │
-- │ 5. updated_at trigger reuses public.set_updated_at() (defined in       │
-- │    20260420000000_extensions_and_profiles.sql).                        │
-- │                                                                         │
-- │ All auth.uid() and is_admin() calls are wrapped as (SELECT …) per the  │
-- │ P1 RLS initplan sweep (20260505010000) — bare calls would re-execute   │
-- │ once per row and tank list-page perf.                                  │
-- └────────────────────────────────────────────────────────────────────────┘

set search_path = public;

-- ─── 1. Enums ────────────────────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_type where typname = 'feedback_category') then
    create type public.feedback_category as enum
      ('bug', 'feature', 'confusing', 'praise', 'other');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'feedback_status') then
    create type public.feedback_status as enum
      ('new', 'triaged', 'resolved');
  end if;
end $$;

-- ─── 2. Table ────────────────────────────────────────────────────────────────

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  -- on delete set null: feedback survives even if a user account is removed,
  -- so the admin can still read role + message + context.
  user_id uuid references auth.users(id) on delete set null,
  -- Snapshot of the submitter's role at submit time. Denormalized so the
  -- admin queue can filter by role without a profiles join.
  role public.sevent_role not null,
  category public.feedback_category not null,
  message text not null check (char_length(message) between 1 and 5000),
  page_url text,
  locale text check (locale in ('en','ar')),
  viewport_w integer check (viewport_w is null or viewport_w between 1 and 16384),
  viewport_h integer check (viewport_h is null or viewport_h between 1 and 16384),
  user_agent text,
  -- Capped client-side to last 10 entries × 500 chars each (~5 KB). Server
  -- action also enforces a 10 KB stringified payload limit before insert.
  console_errors jsonb,
  status public.feedback_status not null default 'new',
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── 3. Indexes ──────────────────────────────────────────────────────────────

create index if not exists app_feedback_user_id_idx
  on public.app_feedback(user_id);

create index if not exists app_feedback_created_at_idx
  on public.app_feedback(created_at desc);

-- Partial index for the admin "incoming" queue: most queries filter to
-- status='new', so this stays tiny even as resolved feedback accumulates.
create index if not exists app_feedback_status_new_idx
  on public.app_feedback(created_at desc)
  where status = 'new';

create index if not exists app_feedback_role_idx
  on public.app_feedback(role);

create index if not exists app_feedback_category_idx
  on public.app_feedback(category);

-- ─── 4. updated_at trigger ───────────────────────────────────────────────────

drop trigger if exists app_feedback_set_updated_at on public.app_feedback;
create trigger app_feedback_set_updated_at
  before update on public.app_feedback
  for each row execute function public.set_updated_at();

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────

alter table public.app_feedback enable row level security;

-- INSERT: any authenticated user, must be writing their own row.
-- (Server action also resolves user_id from the auth cookie — this policy
-- is defense in depth against a direct anon-key insert.)
drop policy if exists "app_feedback: insert own" on public.app_feedback;
create policy "app_feedback: insert own"
  on public.app_feedback
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- SELECT: admins only.
drop policy if exists "app_feedback: admin read" on public.app_feedback;
create policy "app_feedback: admin read"
  on public.app_feedback
  for select
  to authenticated
  using ((select public.is_admin()));

-- UPDATE: admins only (status, admin_notes, resolved_at workflow).
drop policy if exists "app_feedback: admin update" on public.app_feedback;
create policy "app_feedback: admin update"
  on public.app_feedback
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- No DELETE policy: feedback is a permanent audit trail. If admins ever
-- need to redact a row, they can do it via a service-role console.
