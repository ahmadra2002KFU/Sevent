-- =============================================================================
-- 20260504080000 — Quote proposal requests (organizer-initiated RFP).
--
-- Adds the data layer for the new "Request for proposal" flow on the organizer
-- quote-comparison page. After a supplier submits a quote, the organizer can
-- ask that supplier for a technical proposal PDF as an extra step. The
-- supplier uploads it; the organizer can then open it.
--
-- Modeled as a separate row rather than columns on `quotes` so re-requests
-- after a fulfilled or cancelled cycle are natural (history is preserved).
--
-- RLS uses SECURITY DEFINER helpers that bypass cross-table policies on
-- `quotes` / `rfqs` / `events` — the same pattern that broke the marketplace
-- recursion in 20260504071000_fix_marketplace_rls.sql.
-- =============================================================================

set search_path = public;

-- 1. Helpers ------------------------------------------------------------------

create or replace function public.caller_owns_quote_as_organizer(_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
      from public.quotes q
      join public.rfqs   r on r.id = q.rfq_id
      join public.events e on e.id = r.event_id
     where q.id = _quote_id
       and e.organizer_id = auth.uid()
  );
$$;

create or replace function public.caller_is_quote_supplier(_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
      from public.quotes q
      join public.suppliers s on s.id = q.supplier_id
     where q.id = _quote_id
       and s.profile_id = auth.uid()
  );
$$;

revoke all on function public.caller_owns_quote_as_organizer(uuid) from public;
revoke all on function public.caller_is_quote_supplier(uuid)       from public;

grant execute on function public.caller_owns_quote_as_organizer(uuid) to authenticated;
grant execute on function public.caller_is_quote_supplier(uuid)       to authenticated;

-- 2. Table --------------------------------------------------------------------

create table public.quote_proposal_requests (
  id                  uuid primary key default gen_random_uuid(),
  quote_id            uuid not null references public.quotes(id)   on delete cascade,
  requested_by        uuid not null references public.profiles(id) on delete restrict,
  requested_at        timestamptz not null default now(),
  message             text,
  response_file_path  text,
  responded_at        timestamptz,
  status              text not null default 'pending'
                      check (status in ('pending','fulfilled','cancelled')),
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- One open request per quote at a time. Re-requesting after a previous
  -- request was fulfilled or cancelled is allowed.
  constraint quote_proposal_requests_message_len
    check (message is null or char_length(message) <= 1024),
  constraint quote_proposal_requests_response_path_len
    check (response_file_path is null or char_length(response_file_path) <= 512),
  constraint quote_proposal_requests_fulfilled_shape
    check (
      (status <> 'fulfilled')
      or (response_file_path is not null and responded_at is not null)
    )
);

create unique index quote_proposal_requests_one_pending
  on public.quote_proposal_requests(quote_id)
  where status = 'pending';

create index quote_proposal_requests_quote_idx
  on public.quote_proposal_requests(quote_id);

create trigger quote_proposal_requests_set_updated_at
  before update on public.quote_proposal_requests
  for each row execute function public.set_updated_at();

-- 3. RLS ----------------------------------------------------------------------

alter table public.quote_proposal_requests enable row level security;

-- Organizer can read every request on quotes they own.
create policy "qpr: organizer read" on public.quote_proposal_requests
  for select using (
    public.caller_owns_quote_as_organizer(quote_id)
  );

-- Organizer can create a request on a quote they own. The check guards
-- against insertions where requested_by isn't the caller.
create policy "qpr: organizer insert" on public.quote_proposal_requests
  for insert with check (
    public.caller_owns_quote_as_organizer(quote_id)
    and requested_by = auth.uid()
  );

-- Organizer can cancel their pending request (status -> cancelled). The
-- with-check guards prevent flipping status to 'fulfilled' or rewriting
-- response_file_path on the organizer's behalf.
create policy "qpr: organizer cancel" on public.quote_proposal_requests
  for update using (
    public.caller_owns_quote_as_organizer(quote_id)
  )
  with check (
    public.caller_owns_quote_as_organizer(quote_id)
  );

-- Supplier can read requests addressed to their quote.
create policy "qpr: supplier read" on public.quote_proposal_requests
  for select using (
    public.caller_is_quote_supplier(quote_id)
  );

-- Supplier can fulfill a pending request (set response_file_path + status).
-- The using clause restricts which rows are visible for update; the check
-- enforces that quote_id is unchanged.
create policy "qpr: supplier fulfill" on public.quote_proposal_requests
  for update using (
    public.caller_is_quote_supplier(quote_id)
  )
  with check (
    public.caller_is_quote_supplier(quote_id)
  );

-- Admin escape hatch (mirrors other tables in this schema).
create policy "qpr: admin all" on public.quote_proposal_requests
  for all using (public.is_admin())
  with check (public.is_admin());
