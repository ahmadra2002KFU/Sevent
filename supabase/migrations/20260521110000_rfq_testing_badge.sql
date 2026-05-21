-- =============================================================================
-- 20260521110000 — Testing badge for marketplace opportunities
--
-- For continuous development we need to seed real-looking opportunities into
-- the live marketplace WITHOUT misleading suppliers. This migration adds a
-- per-RFQ "testing" flag plus a single global switch the admin can flip to hide
-- every testing opportunity from suppliers at once.
--
-- Behaviour contract:
--   • `rfqs.is_testing` — admin-set boolean. A testing opportunity is still a
--     real, applyable RFQ; suppliers can apply to it exactly as normal. The UI
--     just labels it and sorts it to the bottom of the marketplace.
--   • `app_settings.hide_testing_opportunities` — global kill switch. When ON,
--     testing opportunities vanish from the supplier marketplace (list AND
--     detail) entirely. When OFF, they show (badged, last).
--
-- Enforcement lives in two coordinated places, both keyed off
-- `public.testing_opportunities_hidden()`:
--   1. `marketplace_opportunities_for_supplier()` — drops testing candidates
--      when the switch is on, and always orders testing rows last so the
--      bounded LIMIT prefers real opportunities.
--   2. The `rfqs: marketplace supplier read` RLS policy — the hard gate. Even a
--      direct id lookup (the opportunity detail page) returns nothing for a
--      testing RFQ while the switch is on.
--
-- Single migration is safe here: `is_testing` is a plain boolean column (no new
-- enum value), so referencing it in the same transaction that adds it is fine
-- — unlike the marketplace enum split in 20260504050000 / 20260504051000.
-- =============================================================================

set search_path = public;

-- 1. rfqs.is_testing ----------------------------------------------------------
-- Defaults FALSE: every existing and future RFQ is a real opportunity unless an
-- admin explicitly marks it.
alter table public.rfqs
  add column if not exists is_testing boolean not null default false;

-- Browse-path index: the marketplace query filters on published+sent and now
-- orders by (is_testing, sent_at desc). Mirror the existing
-- `rfqs_marketplace_browse_idx` but lead the ordering column set with
-- is_testing so the planner can satisfy the ORDER BY from the index.
create index if not exists rfqs_marketplace_testing_browse_idx
  on public.rfqs (is_published_to_marketplace, status, is_testing, sent_at desc)
  where is_published_to_marketplace;

-- 2. app_settings singleton ---------------------------------------------------
-- One-row settings table. The `id boolean primary key default true` +
-- `check (id)` pattern forces exactly one row: any second insert collides on
-- the PK, and the check rejects an `id = false` row. Holds platform-wide
-- switches; today just the testing kill switch.
create table if not exists public.app_settings (
  id boolean primary key default true,
  hide_testing_opportunities boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint app_settings_singleton check (id)
);

insert into public.app_settings (id) values (true)
  on conflict (id) do nothing;

-- 3. testing_opportunities_hidden() -------------------------------------------
-- The single source of truth for "is the kill switch on?". SECURITY DEFINER so
-- it can read app_settings regardless of the caller's RLS (suppliers never get
-- direct read on app_settings). Used inside both the marketplace function and
-- the rfqs RLS policy, so it must be callable by authenticated + anon.
create or replace function public.testing_opportunities_hidden()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce(
    (select s.hide_testing_opportunities
       from public.app_settings s
      where s.id = true),
    false
  );
$$;

revoke all on function public.testing_opportunities_hidden() from public;
grant execute on function public.testing_opportunities_hidden()
  to anon, authenticated, service_role;

-- 4. marketplace_opportunities_for_supplier — testing aware -------------------
-- Same signature/return type as 20260505030000 (rfq_id only); body now:
--   • drops testing rows when the global switch is on, and
--   • orders testing rows last so the LIMIT favours real opportunities.
-- The TS hydration layer re-applies the same testing-last ordering after it
-- fetches is_testing, so the supplier list shows testing opportunities at the
-- bottom when they are visible.
create or replace function public.marketplace_opportunities_for_supplier(
  p_supplier_id uuid,
  p_limit integer default 200
) returns table (rfq_id uuid)
  language sql
  stable
  security definer
  set search_path = public
as $$
  select r.id
    from public.rfqs r
   where r.is_published_to_marketplace = true
     and r.status = 'sent'
     and (r.expires_at is null or r.expires_at > now())
     and (r.is_testing = false or not public.testing_opportunities_hidden())
     and not exists (
       select 1
         from public.rfq_invites i
        where i.rfq_id = r.id
          and i.supplier_id = p_supplier_id
     )
   order by r.is_testing asc, r.sent_at desc nulls last
   limit greatest(p_limit, 1);
$$;

revoke all on function public.marketplace_opportunities_for_supplier(uuid, integer) from public;
grant execute on function public.marketplace_opportunities_for_supplier(uuid, integer)
  to authenticated, service_role;

-- 5. rfqs marketplace read RLS — honour the kill switch -----------------------
-- Re-create the policy from 20260504051000 with one added clause: a testing RFQ
-- is only readable while the switch is off. This is the hard gate that makes
-- the opportunity detail page 404 for a hidden testing RFQ, not just the list.
drop policy if exists "rfqs: marketplace supplier read" on public.rfqs;
create policy "rfqs: marketplace supplier read" on public.rfqs
  for select using (
    is_published_to_marketplace
    and status = 'sent'
    and (is_testing = false or not public.testing_opportunities_hidden())
    and exists (
      select 1 from public.suppliers s
       where s.profile_id = auth.uid()
         and s.verification_status = 'approved'
         and s.is_published
    )
  );

-- 6. app_settings RLS ---------------------------------------------------------
-- Admin server actions mutate this via the service-role client (bypasses RLS),
-- but lock the table down as defence-in-depth: only admins may read/update it
-- from a user session; suppliers/organizers get nothing.
alter table public.app_settings enable row level security;

drop policy if exists "app_settings: admin read" on public.app_settings;
create policy "app_settings: admin read" on public.app_settings
  for select using (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "app_settings: admin update" on public.app_settings;
create policy "app_settings: admin update" on public.app_settings
  for update using (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
    )
  );
