-- messaging: feedback_campaigns — admin bulk-send audit log.
--
-- One row per "compose to role" or "compose to all" admin action. Single-user
-- composes don't create a campaign row (campaign_id stays null on the thread).
-- Immutable once created (no UPDATE / DELETE policies).
--
-- This migration also wires app_feedback.campaign_id (added empty in
-- 20260505050000) to its FK + the unique partial index that prevents duplicate
-- threads in the same campaign on retry.

set search_path = public;

-- ─── 1. Table ────────────────────────────────────────────────────────────────

create table if not exists public.feedback_campaigns (
  id uuid primary key default gen_random_uuid(),
  -- on delete set null: campaign survives if the admin account is removed,
  -- so the audit row is preserved.
  sender_admin_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('user','role','all')),
  -- {user_id} | {role: 'supplier'|'organizer'|'admin'|'agency'} | {} for 'all'
  target_spec jsonb not null,
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 10000),
  recipient_count int not null default 0 check (recipient_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists feedback_campaigns_sender_idx
  on public.feedback_campaigns (sender_admin_id, created_at desc);

create index if not exists feedback_campaigns_created_at_idx
  on public.feedback_campaigns (created_at desc);

-- ─── 2. app_feedback.campaign_id FK + idempotency index ──────────────────────

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'app_feedback_campaign_fk'
      and conrelid = 'public.app_feedback'::regclass
  ) then
    alter table public.app_feedback
      add constraint app_feedback_campaign_fk
      foreign key (campaign_id) references public.feedback_campaigns(id)
      on delete set null;
  end if;
end $$;

-- Idempotency on bulk sends: a re-run of composeToRole / composeToAll with
-- the same campaign_id and the same recipient cannot duplicate threads.
create unique index if not exists app_feedback_campaign_user_uidx
  on public.app_feedback (campaign_id, user_id) where campaign_id is not null;

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────

alter table public.feedback_campaigns enable row level security;

drop policy if exists "feedback_campaigns: admin read" on public.feedback_campaigns;
create policy "feedback_campaigns: admin read"
  on public.feedback_campaigns
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "feedback_campaigns: admin insert" on public.feedback_campaigns;
create policy "feedback_campaigns: admin insert"
  on public.feedback_campaigns
  for insert to authenticated
  with check ((select public.is_admin()));

-- No UPDATE policy: campaign rows are immutable audit log.
-- No DELETE policy: same.
