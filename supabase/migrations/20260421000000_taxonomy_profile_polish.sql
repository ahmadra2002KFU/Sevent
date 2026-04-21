-- Sevent · 2026-04-21 · taxonomy replacement + supplier profile polish.
--
-- Boss-approved pass (see Claude Docs/plan.md + ~/.claude/plans/hidden-cuddling-hopcroft.md):
--   * Replace placeholder taxonomy with the 12 service parents + sub-items.
--   * Replace 7-value event_type enum with the 5 market-segment slugs.
--   * Extend supplier_doc_type enum with iban_certificate + company_profile.
--   * Extend public.suppliers with logo_path, accent_color, profile_sections_order,
--     works_with_segments.
--
-- Pre-pilot: this migration WIPES all marketplace data (events, rfqs, quotes,
-- bookings, reviews, disputes, availability_blocks, packages, pricing_rules,
-- supplier_categories, supplier_docs, categories). Seeded suppliers and
-- admin/organizer accounts are preserved — re-run `pnpm seed` afterwards to
-- repopulate against the new taxonomy.
--
-- Codex review 2026-04-21 flagged three real blockers we address here:
--   1. events.event_type cast-back would fail because old enum values don't
--      exist in the new enum — mitigated by TRUNCATE events before the cast.
--   2. `delete from categories` is blocked by on-delete-restrict FKs from
--      supplier_categories, packages, rfqs — mitigated by TRUNCATE CASCADE.
--   3. supplier-logos bucket policy needs to mirror supplier-portfolio shape —
--      handled in the companion 20260421010000_supplier_logos_bucket.sql.

set search_path = public;

-- =============================================================================
-- 1. Wipe dependent marketplace data (order matters — children before parents).
-- =============================================================================
-- TRUNCATE CASCADE transitively wipes every table with a FK chain back to the
-- truncated table, regardless of ON DELETE clauses on those FKs.

-- categories -> supplier_categories, packages, rfqs (all direct).
-- packages  -> pricing_rules, quotes (via quoted_package_id).
-- quotes    -> quote_revisions, bookings.
-- bookings  -> reviews, disputes, dispute_evidence, availability_blocks.
-- rfqs      -> rfq_invites.
truncate public.categories cascade;

-- events is not reachable from categories transitively (rfqs.event_id points
-- FROM rfqs TO events). Clear events + any stragglers.
truncate public.events cascade;

-- supplier_docs is independent of categories; clear it so the doc_type enum
-- can be dropped and recreated with the two new values.
truncate public.supplier_docs cascade;

-- =============================================================================
-- 2. Replace public.event_type enum with the 5 market-segment slugs.
-- =============================================================================
-- Old: wedding, corporate, government, exhibition, birthday, private, other.
-- New: private_occasions, business_events, entertainment_culture,
--      sports_exhibitions, others.
-- events.event_type is the only column referencing this enum. events was
-- truncated above so the cast-to-text → drop-enum → cast-back dance is safe.

alter table public.events alter column event_type type text using event_type::text;

drop type public.event_type;

create type public.event_type as enum (
  'private_occasions',
  'business_events',
  'entertainment_culture',
  'sports_exhibitions',
  'others'
);

alter table public.events
  alter column event_type type public.event_type using event_type::public.event_type;

-- =============================================================================
-- 3. Replace public.supplier_doc_type with the extended 8-value set.
-- =============================================================================
-- We use drop+recreate (not ALTER TYPE ... ADD VALUE) because supplier_docs
-- was truncated above and the transaction semantics for ADD VALUE are fussy.

alter table public.supplier_docs alter column doc_type type text using doc_type::text;

drop type public.supplier_doc_type;

create type public.supplier_doc_type as enum (
  'cr',
  'vat',
  'id',
  'gea_permit',
  'certification',
  'iban_certificate',
  'company_profile',
  'other'
);

alter table public.supplier_docs
  alter column doc_type type public.supplier_doc_type using doc_type::public.supplier_doc_type;

-- =============================================================================
-- 4. Extend public.suppliers with profile-customization columns.
-- =============================================================================

alter table public.suppliers
  add column logo_path text,
  add column accent_color text not null default '#1E7BD8'
    check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  add column profile_sections_order jsonb not null
    default '["bio","packages","portfolio","reviews"]'::jsonb,
  add column works_with_segments public.event_type[] not null default '{}';

-- =============================================================================
-- 5. Seed new taxonomy — 12 parents + ~35 sub-items.
-- =============================================================================
-- Single source of truth for this block lives in src/lib/domain/taxonomy.ts.
-- If you edit slugs/names here, update that file to match, and run the TS
-- test suite to catch drift.

with parents as (
  insert into public.categories (slug, name_en, name_ar, sort_order) values
    ('sound_lighting',          'Sound and Lighting',          'صوت وإضاءة',          10),
    ('photo_video',             'Photography and Video',       'تصوير وفيديو',         20),
    ('catering_hospitality',    'Catering and Hospitality',    'كاترينج وضيافة',       30),
    ('tents_structures',        'Tents and Structures',        'خيام وستراكتشر',       40),
    ('furniture_equipment',     'Furniture and Equipment',     'أثاث ومعدات',          50),
    ('entertainment_arts',      'Entertainment and Arts',      'ترفيه وفنون',          60),
    ('transport_logistics',     'Transportation and Logistics','نقل ولوجستيات',        70),
    ('stands_exhibitions',      'Stands and Exhibitions',      'استاندات ومعارض',      80),
    ('coordination_management', 'Coordination and Management', 'تنسيق وإدارة',         90),
    ('flowers_decor',           'Flowers and Decor',           'زهور وديكور',         100),
    ('makeup_beauty',           'Makeup and Beauty',           'مكياج وتجميل',        110),
    ('electricity_power',       'Electricity and Power',       'كهرباء وطاقة',        120)
  returning id, slug
)
insert into public.categories (parent_id, slug, name_en, name_ar, sort_order)
select p.id, child.slug, child.name_en, child.name_ar, child.sort_order from parents p
join (values
  -- Sound and Lighting
  ('sound_lighting',          'sl_speakers',            'Speakers',                     'مكبرات',               1),
  ('sound_lighting',          'sl_laser',               'Laser',                        'ليزر',                 2),
  ('sound_lighting',          'sl_dj',                  'DJ',                           'دي جي',                3),
  ('sound_lighting',          'sl_led_screens',         'LED screens',                  'شاشات LED',            4),
  -- Photography and Video
  ('photo_video',             'pv_photographers',       'Photographers',                'مصورون',               1),
  ('photo_video',             'pv_film',                'Film',                         'فيلم',                 2),
  ('photo_video',             'pv_live_streaming',      'Live streaming',               'بث مباشر',             3),
  -- Catering and Hospitality
  ('catering_hospitality',    'cat_buffet',             'Buffet',                       'بوفيه',                1),
  ('catering_hospitality',    'cat_kitchens',           'Kitchens',                     'مطابخ',                2),
  ('catering_hospitality',    'cat_vip_services',       'VIP services',                 'خدمات VIP',            3),
  -- Tents and Structures
  ('tents_structures',        'ts_tents',               'Tents',                        'خيام',                 1),
  ('tents_structures',        'ts_domes',               'Domes',                        'قباب',                 2),
  ('tents_structures',        'ts_temporary_hangars',   'Temporary hangars',            'هناجر مؤقتة',          3),
  -- Furniture and Equipment
  ('furniture_equipment',     'fe_chairs',              'Chairs',                       'كراسي',                1),
  ('furniture_equipment',     'fe_tables',              'Tables',                       'طاولات',                2),
  ('furniture_equipment',     'fe_decor',               'Decor',                        'ديكور',                3),
  -- Entertainment and Arts
  ('entertainment_arts',      'ea_folkloric_groups',    'Folkloric groups',             'فرق فلكلورية',         1),
  ('entertainment_arts',      'ea_theatrical_performances', 'Theatrical performances',  'عروض مسرحية',          2),
  -- Transportation and Logistics
  ('transport_logistics',     'tl_vip_cars',            'VIP cars',                     'سيارات VIP',           1),
  ('transport_logistics',     'tl_loading_trucks',      'Loading trucks',               'شاحنات تحميل',         2),
  -- Stands and Exhibitions
  ('stands_exhibitions',      'se_stand_design_install','Stand design and installation','تصميم وتركيب استاندات', 1),
  -- Coordination and Management
  ('coordination_management', 'cm_certified_event_managers','Certified event managers', 'مديرو فعاليات معتمدون', 1),
  -- Flowers and Decor
  ('flowers_decor',           'fd_flower_arrangement',  'Flower arrangement',           'تنسيق ورود',            1),
  ('flowers_decor',           'fd_bouquets',            'Bouquets',                     'باقات',                 2),
  ('flowers_decor',           'fd_decoration',          'Decoration',                   'تزيين',                 3),
  -- Makeup and Beauty
  ('makeup_beauty',           'mb_hairstylists',        'Hairstylists',                 'مصففو شعر',             1),
  ('makeup_beauty',           'mb_bridal_makeup',       'Bridal makeup',                'مكياج عرائس',           2),
  -- Electricity and Power
  ('electricity_power',       'ep_generators',          'Generators',                   'مولدات',                1),
  ('electricity_power',       'ep_electrical_panels',   'Electrical panels',            'لوحات كهربائية',        2)
) as child(parent_slug, slug, name_en, name_ar, sort_order)
  on p.slug = child.parent_slug;

-- =============================================================================
-- 6. Indexes that benefit from the new suppliers columns.
-- =============================================================================
-- works_with_segments is frequently queried via array-contains for auto-match
-- and public segment browse (roadmap v2). GIN index supports @> operator.
create index if not exists suppliers_works_with_segments_idx
  on public.suppliers using gin (works_with_segments);
