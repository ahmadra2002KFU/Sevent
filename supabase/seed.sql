-- Sevent · seed data for local dev.
-- Runs automatically after `supabase db reset`. Idempotent; re-running is safe.
-- Sprint 1 · task S1-5.

begin;

-- =============================================================================
-- Categories (2-level tree)
-- =============================================================================

with parents as (
  insert into public.categories (slug, name_en, name_ar, sort_order) values
    ('venues',          'Venues & halls',        'قاعات ومواقع',         10),
    ('catering',        'Catering & F&B',        'ضيافة وأطعمة',         20),
    ('photography',     'Photography & video',   'تصوير فوتوغرافي وفيديو', 30),
    ('decor',           'Decor, flowers & stage','ديكور وأزهار ومسرح',     40),
    ('entertainment',   'Entertainment',         'ترفيه',                 50),
    ('av',              'AV & production',       'صوتيات وإنتاج',         60),
    ('transportation',  'Transportation',        'نقل ومواصلات',          70),
    ('staffing',        'Staffing & hosting',    'طاقم وضيافة',           80)
  on conflict (slug) do update set name_en = excluded.name_en
  returning id, slug
)
insert into public.categories (parent_id, slug, name_en, name_ar, sort_order)
select p.id, child.slug, child.name_en, child.name_ar, child.sort_order from parents p
join (values
  ('venues',        'venue-ballroom',      'Ballroom',              'قاعة فخمة',            1),
  ('venues',        'venue-outdoor',       'Outdoor venue',         'موقع خارجي',            2),
  ('venues',        'venue-conference',    'Conference hall',       'قاعة مؤتمرات',          3),
  ('catering',      'catering-buffet',     'Full-service buffet',   'بوفيه متكامل',          1),
  ('catering',      'catering-plated',     'Plated dinner',         'عشاء بالطبق',            2),
  ('catering',      'catering-coffee',     'Coffee / dessert cart', 'عربة قهوة وحلويات',     3),
  ('photography',   'photo-wedding',       'Wedding photography',   'تصوير أعراس',            1),
  ('photography',   'photo-corporate',     'Corporate photography', 'تصوير فعاليات الشركات',  2),
  ('photography',   'video-cinematic',     'Cinematic videography', 'تصوير سينمائي',          3),
  ('photography',   'photo-drone',         'Drone / aerial',        'تصوير جوي',              4),
  ('decor',         'decor-kosha',         'Kosha & stage design',  'كوشة وتصميم مسرح',       1),
  ('decor',         'decor-florals',       'Florals',               'ورود وأزهار',            2),
  ('decor',         'decor-lighting',      'Event lighting',        'إضاءة فعاليات',          3),
  ('entertainment', 'dj',                  'DJ / music',            'موسيقى/دي جي',           1),
  ('entertainment', 'performer',           'Live performer',        'فنان حي',                2),
  ('av',            'av-sound',            'Sound system',          'أنظمة صوتية',            1),
  ('av',            'av-staging',          'Staging & trussing',    'مسارح وهياكل',           2),
  ('transportation','transport-passenger', 'Passenger transport',   'نقل ركاب',                1),
  ('staffing',      'staff-hostess',       'Hosts & hostesses',     'مضيفين ومضيفات',         1)
) as child(parent_slug, slug, name_en, name_ar, sort_order)
  on p.slug = child.parent_slug
on conflict (slug) do nothing;

commit;

-- =============================================================================
-- Demo users.
-- Auth users are created via the auth.admin API in real life; seeding them via
-- the `auth.users` table requires encrypted passwords. To keep local dev
-- friction low we create the minimum fixtures and let the dev sign up manually
-- through /sign-up. A helper to create full fixtures via the service-role API
-- will land in a `scripts/seed-users.ts` file (Sprint 2) once we need to demo
-- the matching flow end-to-end.
-- =============================================================================

-- Leaving profile / supplier / package seeds empty for Sprint 1. They are
-- added in Sprint 2 once the onboarding flow exists and can populate demo
-- suppliers realistically. If you need a placeholder dataset right now, run:
--
--   pnpm dlx tsx scripts/seed-users.ts   (created in Sprint 2)
--
-- That script uses the service-role key to create auth users and then seeds
-- their corresponding profile + supplier rows.
