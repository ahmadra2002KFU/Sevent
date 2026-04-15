-- Sevent · migration 0002: marketplace schema + RLS.
-- Sprint 1 · task S1-4. Depends on migration 0001 (extensions + profiles).
--
-- Schema conventions:
--   * All money stored as integer halalas (bigint). 100 halalas = 1 SAR.
--   * Every revision-sensitive payload is snapshotted (quote_revisions, contracts).
--   * RLS is enabled on every table with role-aware policies.

set search_path = public;

-- =============================================================================
-- Enums
-- =============================================================================

create type public.supplier_legal_type as enum ('company', 'freelancer', 'foreign');
create type public.supplier_verification_status as enum ('pending', 'approved', 'rejected');
create type public.supplier_doc_type as enum ('cr', 'vat', 'id', 'gea_permit', 'certification', 'other');
create type public.supplier_doc_status as enum ('pending', 'approved', 'rejected');
create type public.supplier_media_kind as enum ('photo', 'video');
create type public.package_unit as enum ('event', 'hour', 'day', 'person', 'unit');
create type public.pricing_rule_type as enum (
  'qty_tier_all_units',
  'qty_tier_incremental',
  'distance_fee',
  'date_surcharge',
  'duration_multiplier'
);
create type public.availability_reason as enum ('manual_block', 'soft_hold', 'booked');
create type public.event_type as enum (
  'wedding',
  'corporate',
  'government',
  'exhibition',
  'birthday',
  'private',
  'other'
);
create type public.rfq_status as enum ('draft', 'sent', 'quoted', 'expired', 'booked', 'cancelled');
create type public.rfq_invite_source as enum ('auto_match', 'organizer_picked');
create type public.rfq_invite_status as enum ('invited', 'declined', 'quoted', 'withdrawn');
create type public.quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired', 'withdrawn');
create type public.quote_source as enum ('rule_engine', 'free_form', 'mixed');
create type public.booking_confirmation_status as enum ('awaiting_supplier', 'confirmed', 'cancelled');
create type public.booking_payment_status as enum ('unpaid', 'deposit_paid', 'balance_paid', 'paid');
create type public.booking_service_status as enum ('scheduled', 'in_progress', 'completed', 'disputed');
create type public.dispute_status as enum ('open', 'investigating', 'resolved', 'closed');
create type public.dispute_evidence_kind as enum ('file', 'note');

-- =============================================================================
-- Helpers
-- =============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- =============================================================================
-- categories (2-level; parent_id NULL for top-level)
-- =============================================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  slug text not null unique,
  name_en text not null,
  name_ar text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index categories_parent_idx on public.categories (parent_id);

alter table public.categories enable row level security;

create policy "categories: public read" on public.categories
  for select using (true);
create policy "categories: admin write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- suppliers
-- =============================================================================

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  business_name text not null,
  slug text not null unique,
  legal_type public.supplier_legal_type not null,
  cr_number text,
  national_id text,
  verification_status public.supplier_verification_status not null default 'pending',
  verification_notes text,
  verified_at timestamptz,
  verified_by uuid references public.profiles (id),
  base_city text not null,
  base_location geography(point, 4326),
  service_area_cities text[] not null default '{}',
  languages text[] not null default '{en}',
  capacity int,
  concurrent_event_limit int not null default 1 check (concurrent_event_limit >= 1),
  bio text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index suppliers_verification_idx on public.suppliers (verification_status);
create index suppliers_published_idx on public.suppliers (is_published) where is_published;
create index suppliers_base_city_idx on public.suppliers (base_city);
create index suppliers_location_idx on public.suppliers using gist (base_location);

create trigger suppliers_set_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

create policy "suppliers: public read published" on public.suppliers
  for select using (is_published and verification_status = 'approved');
create policy "suppliers: owner read" on public.suppliers
  for select using (profile_id = auth.uid());
create policy "suppliers: admin read" on public.suppliers
  for select using (public.is_admin());
create policy "suppliers: owner update" on public.suppliers
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Owners may not self-approve / change verification_status; enforced by trigger.
create or replace function public.guard_supplier_verification()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.verification_status is distinct from old.verification_status
     and not public.is_admin() then
    raise exception 'only admins can change verification_status';
  end if;
  return new;
end;
$$;

drop trigger if exists suppliers_guard_verification on public.suppliers;
create trigger suppliers_guard_verification
  before update on public.suppliers
  for each row execute function public.guard_supplier_verification();
create policy "suppliers: owner insert" on public.suppliers
  for insert with check (profile_id = auth.uid());
create policy "suppliers: admin write" on public.suppliers
  for all using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- supplier_categories (N:N)
-- =============================================================================

create table public.supplier_categories (
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  subcategory_id uuid not null references public.categories (id) on delete restrict,
  primary key (supplier_id, subcategory_id)
);
create index supplier_categories_sub_idx on public.supplier_categories (subcategory_id);

alter table public.supplier_categories enable row level security;

create policy "supplier_categories: public read" on public.supplier_categories
  for select using (
    exists (
      select 1 from public.suppliers s
      where s.id = supplier_id and s.is_published and s.verification_status = 'approved'
    )
    or exists (
      select 1 from public.suppliers s
      where s.id = supplier_id and s.profile_id = auth.uid()
    )
    or public.is_admin()
  );
create policy "supplier_categories: owner write" on public.supplier_categories
  for all using (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  ) with check (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  );

-- =============================================================================
-- supplier_docs
-- =============================================================================

create table public.supplier_docs (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  doc_type public.supplier_doc_type not null,
  file_path text not null,
  status public.supplier_doc_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index supplier_docs_supplier_idx on public.supplier_docs (supplier_id);
create index supplier_docs_status_idx on public.supplier_docs (status);

alter table public.supplier_docs enable row level security;

create policy "supplier_docs: owner read" on public.supplier_docs
  for select using (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  );
create policy "supplier_docs: owner write" on public.supplier_docs
  for all using (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  ) with check (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  );
create policy "supplier_docs: admin read" on public.supplier_docs
  for select using (public.is_admin());
create policy "supplier_docs: admin write" on public.supplier_docs
  for all using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- supplier_media (photos only for v1; kind kept as enum for future video)
-- =============================================================================

create table public.supplier_media (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  kind public.supplier_media_kind not null default 'photo',
  file_path text not null,
  title text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index supplier_media_supplier_idx on public.supplier_media (supplier_id, sort_order);

alter table public.supplier_media enable row level security;

create policy "supplier_media: public read published" on public.supplier_media
  for select using (
    exists (
      select 1 from public.suppliers s
      where s.id = supplier_id and s.is_published and s.verification_status = 'approved'
    )
  );
create policy "supplier_media: owner all" on public.supplier_media
  for all using (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  ) with check (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  );
create policy "supplier_media: admin read" on public.supplier_media
  for select using (public.is_admin());

-- =============================================================================
-- packages
-- =============================================================================

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  subcategory_id uuid not null references public.categories (id) on delete restrict,
  name text not null,
  description text,
  base_price_halalas bigint not null check (base_price_halalas >= 0),
  currency char(3) not null default 'SAR',
  unit public.package_unit not null,
  min_qty int not null default 1 check (min_qty >= 1),
  max_qty int check (max_qty is null or max_qty >= min_qty),
  from_price_visible boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index packages_supplier_idx on public.packages (supplier_id, is_active);
create index packages_subcategory_idx on public.packages (subcategory_id, is_active);

create trigger packages_set_updated_at before update on public.packages
  for each row execute function public.set_updated_at();

alter table public.packages enable row level security;

create policy "packages: public read when published" on public.packages
  for select using (
    is_active and exists (
      select 1 from public.suppliers s
      where s.id = supplier_id and s.is_published and s.verification_status = 'approved'
    )
  );
create policy "packages: owner all" on public.packages
  for all using (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  ) with check (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  );
create policy "packages: admin read" on public.packages
  for select using (public.is_admin());

-- =============================================================================
-- pricing_rules
-- =============================================================================

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  package_id uuid references public.packages (id) on delete cascade,
  rule_type public.pricing_rule_type not null,
  config_jsonb jsonb not null,
  priority int not null default 100,
  version int not null default 1,
  is_active boolean not null default true,
  valid_from date,
  valid_to date,
  currency char(3) not null default 'SAR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pricing_rules_supplier_idx on public.pricing_rules (supplier_id, rule_type);
create index pricing_rules_package_idx on public.pricing_rules (package_id, rule_type);
create index pricing_rules_active_idx on public.pricing_rules (is_active);

create trigger pricing_rules_set_updated_at before update on public.pricing_rules
  for each row execute function public.set_updated_at();

alter table public.pricing_rules enable row level security;

create policy "pricing_rules: owner all" on public.pricing_rules
  for all using (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  ) with check (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  );
-- Invited suppliers and the organizer need to see rules via the pricing engine,
-- but the engine runs server-side with the service role; no public read policy.
create policy "pricing_rules: admin read" on public.pricing_rules
  for select using (public.is_admin());

-- =============================================================================
-- availability_blocks
-- =============================================================================

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  reason public.availability_reason not null,
  booking_id uuid,
  quote_revision_id uuid,
  expires_at timestamptz,
  released_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint availability_blocks_soft_hold_has_expiry
    check (reason <> 'soft_hold' or expires_at is not null)
);
create index availability_blocks_supplier_range_idx
  on public.availability_blocks using gist (supplier_id, tstzrange(starts_at, ends_at));
create index availability_blocks_soft_hold_idx
  on public.availability_blocks (supplier_id, expires_at)
  where reason = 'soft_hold';
create unique index availability_blocks_booking_unique
  on public.availability_blocks (booking_id)
  where booking_id is not null;

alter table public.availability_blocks enable row level security;

create policy "availability_blocks: public read published" on public.availability_blocks
  for select using (
    exists (
      select 1 from public.suppliers s
      where s.id = supplier_id and s.is_published and s.verification_status = 'approved'
    )
  );
create policy "availability_blocks: owner all" on public.availability_blocks
  for all using (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  ) with check (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  );
create policy "availability_blocks: admin read" on public.availability_blocks
  for select using (public.is_admin());

-- =============================================================================
-- events
-- =============================================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  client_name text,
  event_type public.event_type not null,
  city text not null,
  venue_address text,
  venue_location geography(point, 4326),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  guest_count int,
  budget_range_min_halalas bigint,
  budget_range_max_halalas bigint,
  currency char(3) not null default 'SAR',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_organizer_idx on public.events (organizer_id, starts_at);
create index events_city_idx on public.events (city);
create index events_location_idx on public.events using gist (venue_location);

create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;

create policy "events: owner all" on public.events
  for all using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());
create policy "events: admin read" on public.events
  for select using (public.is_admin());

-- =============================================================================
-- rfqs
-- =============================================================================

create table public.rfqs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  subcategory_id uuid not null references public.categories (id) on delete restrict,
  status public.rfq_status not null default 'draft',
  requirements_jsonb jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rfqs_event_idx on public.rfqs (event_id);
create index rfqs_status_idx on public.rfqs (status);

create trigger rfqs_set_updated_at before update on public.rfqs
  for each row execute function public.set_updated_at();

alter table public.rfqs enable row level security;

create policy "rfqs: organizer all" on public.rfqs
  for all using (
    exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  ) with check (
    exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  );
create policy "rfqs: invited supplier read" on public.rfqs
  for select using (
    exists (
      select 1 from public.rfq_invites inv
      join public.suppliers s on s.id = inv.supplier_id
      where inv.rfq_id = rfqs.id and s.profile_id = auth.uid()
    )
  );
create policy "rfqs: admin read" on public.rfqs
  for select using (public.is_admin());

-- =============================================================================
-- rfq_invites
-- =============================================================================

create table public.rfq_invites (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  source public.rfq_invite_source not null,
  status public.rfq_invite_status not null default 'invited',
  sent_at timestamptz not null default now(),
  response_due_at timestamptz not null,
  responded_at timestamptz,
  decline_reason_code text,
  unique (rfq_id, supplier_id)
);
create index rfq_invites_supplier_idx on public.rfq_invites (supplier_id, status);

alter table public.rfq_invites enable row level security;

create policy "rfq_invites: organizer read" on public.rfq_invites
  for select using (
    exists (
      select 1 from public.rfqs r
      join public.events e on e.id = r.event_id
      where r.id = rfq_id and e.organizer_id = auth.uid()
    )
  );
create policy "rfq_invites: organizer write" on public.rfq_invites
  for all using (
    exists (
      select 1 from public.rfqs r
      join public.events e on e.id = r.event_id
      where r.id = rfq_id and e.organizer_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.rfqs r
      join public.events e on e.id = r.event_id
      where r.id = rfq_id and e.organizer_id = auth.uid()
    )
  );
create policy "rfq_invites: supplier read own" on public.rfq_invites
  for select using (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  );
create policy "rfq_invites: supplier respond" on public.rfq_invites
  for update using (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  ) with check (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  );
create policy "rfq_invites: admin read" on public.rfq_invites
  for select using (public.is_admin());

-- =============================================================================
-- quotes + quote_revisions (immutable snapshots)
-- =============================================================================

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  quoted_package_id uuid references public.packages (id),
  source public.quote_source not null default 'rule_engine',
  status public.quote_status not null default 'draft',
  currency char(3) not null default 'SAR',
  current_revision_id uuid, -- set after first revision is inserted
  supplier_response_deadline timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rfq_id, supplier_id)
);
create index quotes_rfq_idx on public.quotes (rfq_id);
create index quotes_supplier_idx on public.quotes (supplier_id, status);

create trigger quotes_set_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();

create table public.quote_revisions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  version int not null,
  author_id uuid not null references public.profiles (id),
  -- Snapshot of the entire quote payload at send time. Shape:
  -- { line_items: [{label, qty, unit, unit_price_halalas, total_halalas}],
  --   subtotal_halalas, travel_fee_halalas, setup_fee_halalas, teardown_fee_halalas,
  --   deposit_pct, payment_schedule, cancellation_terms, inclusions, exclusions,
  --   vat_rate_pct, vat_amount_halalas, total_halalas, expires_at, notes }
  snapshot_jsonb jsonb not null,
  content_hash text not null, -- SHA-256 of canonical snapshot
  created_at timestamptz not null default now(),
  unique (quote_id, version)
);
create index quote_revisions_quote_idx on public.quote_revisions (quote_id, version desc);

alter table public.quotes
  add constraint quotes_current_revision_fk
  foreign key (current_revision_id) references public.quote_revisions (id) deferrable initially deferred;

alter table public.quotes enable row level security;
alter table public.quote_revisions enable row level security;

create policy "quotes: organizer read" on public.quotes
  for select using (
    exists (
      select 1 from public.rfqs r
      join public.events e on e.id = r.event_id
      where r.id = rfq_id and e.organizer_id = auth.uid()
    )
  );
create policy "quotes: organizer accept/reject" on public.quotes
  for update using (
    exists (
      select 1 from public.rfqs r
      join public.events e on e.id = r.event_id
      where r.id = rfq_id and e.organizer_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.rfqs r
      join public.events e on e.id = r.event_id
      where r.id = rfq_id and e.organizer_id = auth.uid()
    )
  );
create policy "quotes: supplier all" on public.quotes
  for all using (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  ) with check (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  );
create policy "quotes: admin read" on public.quotes
  for select using (public.is_admin());

create policy "quote_revisions: organizer read" on public.quote_revisions
  for select using (
    exists (
      select 1 from public.quotes q
      join public.rfqs r on r.id = q.rfq_id
      join public.events e on e.id = r.event_id
      where q.id = quote_id and e.organizer_id = auth.uid()
    )
  );
create policy "quote_revisions: supplier read" on public.quote_revisions
  for select using (
    exists (
      select 1 from public.quotes q
      join public.suppliers s on s.id = q.supplier_id
      where q.id = quote_id and s.profile_id = auth.uid()
    )
  );
create policy "quote_revisions: supplier insert" on public.quote_revisions
  for insert with check (
    exists (
      select 1 from public.quotes q
      join public.suppliers s on s.id = q.supplier_id
      where q.id = quote_id and s.profile_id = auth.uid()
    )
  );
create policy "quote_revisions: admin read" on public.quote_revisions
  for select using (public.is_admin());

-- =============================================================================
-- bookings
-- =============================================================================

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete restrict,
  quote_id uuid not null references public.quotes (id) on delete restrict,
  accepted_quote_revision_id uuid not null references public.quote_revisions (id) on delete restrict,
  organizer_id uuid not null references public.profiles (id) on delete restrict,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  contract_pdf_path text,
  confirmation_status public.booking_confirmation_status not null default 'awaiting_supplier',
  payment_status public.booking_payment_status not null default 'unpaid',
  service_status public.booking_service_status not null default 'scheduled',
  awaiting_since timestamptz,
  confirm_deadline timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_supplier_idx on public.bookings (supplier_id, confirmation_status);
create index bookings_organizer_idx on public.bookings (organizer_id);
create index bookings_confirm_deadline_idx
  on public.bookings (confirm_deadline)
  where confirmation_status = 'awaiting_supplier';

create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;

create policy "bookings: organizer all" on public.bookings
  for all using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());
create policy "bookings: supplier all" on public.bookings
  for all using (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  ) with check (
    exists (select 1 from public.suppliers s where s.id = supplier_id and s.profile_id = auth.uid())
  );
create policy "bookings: admin read" on public.bookings
  for select using (public.is_admin());

alter table public.availability_blocks
  add constraint availability_blocks_booking_fk
  foreign key (booking_id) references public.bookings (id) on delete set null;
alter table public.availability_blocks
  add constraint availability_blocks_quote_revision_fk
  foreign key (quote_revision_id) references public.quote_revisions (id) on delete set null;

-- =============================================================================
-- reviews (double-blind, one per reviewer per booking)
-- =============================================================================

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  ratings_jsonb jsonb not null, -- { overall, value, punctuality, professionalism }
  text text,
  submitted_at timestamptz not null default now(),
  window_closes_at timestamptz not null,
  published_at timestamptz,
  suppressed_for_dispute boolean not null default false,
  unique (booking_id, reviewer_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id) where published_at is not null;
create index reviews_booking_idx on public.reviews (booking_id);

alter table public.reviews enable row level security;

create policy "reviews: reviewer read" on public.reviews
  for select using (reviewer_id = auth.uid());
create policy "reviews: reviewer insert" on public.reviews
  for insert with check (reviewer_id = auth.uid());
create policy "reviews: public read published" on public.reviews
  for select using (published_at is not null);
create policy "reviews: admin read" on public.reviews
  for select using (public.is_admin());

-- =============================================================================
-- disputes + dispute_evidence
-- =============================================================================

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  raised_by uuid not null references public.profiles (id),
  reason_code text not null,
  description text not null,
  status public.dispute_status not null default 'open',
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  resolution_jsonb jsonb,
  created_at timestamptz not null default now()
);
create index disputes_booking_idx on public.disputes (booking_id);
create index disputes_status_idx on public.disputes (status);

alter table public.disputes enable row level security;

create policy "disputes: party read" on public.disputes
  for select using (
    exists (
      select 1 from public.bookings b
      left join public.suppliers s on s.id = b.supplier_id
      where b.id = booking_id
        and (b.organizer_id = auth.uid() or s.profile_id = auth.uid())
    )
  );
create policy "disputes: party open" on public.disputes
  for insert with check (
    exists (
      select 1 from public.bookings b
      left join public.suppliers s on s.id = b.supplier_id
      where b.id = booking_id
        and (b.organizer_id = auth.uid() or s.profile_id = auth.uid())
    )
    and raised_by = auth.uid()
  );
create policy "disputes: admin all" on public.disputes
  for all using (public.is_admin()) with check (public.is_admin());

create table public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id),
  kind public.dispute_evidence_kind not null,
  file_path text,
  text_note text,
  visible_to_other_party boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (kind = 'file' and file_path is not null)
    or (kind = 'note' and text_note is not null)
  )
);
create index dispute_evidence_dispute_idx on public.dispute_evidence (dispute_id, created_at);
create index dispute_evidence_submitter_idx on public.dispute_evidence (submitted_by, created_at);

alter table public.dispute_evidence enable row level security;

create policy "dispute_evidence: party read" on public.dispute_evidence
  for select using (
    exists (
      select 1 from public.disputes d
      join public.bookings b on b.id = d.booking_id
      left join public.suppliers s on s.id = b.supplier_id
      where d.id = dispute_id
        and (b.organizer_id = auth.uid() or s.profile_id = auth.uid())
        and (visible_to_other_party or submitted_by = auth.uid())
    )
  );
create policy "dispute_evidence: party write" on public.dispute_evidence
  for insert with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.disputes d
      join public.bookings b on b.id = d.booking_id
      left join public.suppliers s on s.id = b.supplier_id
      where d.id = dispute_id
        and (b.organizer_id = auth.uid() or s.profile_id = auth.uid())
    )
  );
create policy "dispute_evidence: admin all" on public.dispute_evidence
  for all using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- notifications
-- =============================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  payload_jsonb jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications: owner read" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications: owner mark read" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "notifications: admin read" on public.notifications
  for select using (public.is_admin());
