# Taxonomy — legacy snapshot (pre 2026-04-21)

This document captures the placeholder taxonomy that shipped with Sprints 1–3. It was replaced on **2026-04-21** by the canonical Saudi events taxonomy (5 market segments + 12 service categories with sub-items) defined in `src/lib/domain/taxonomy.ts`.

Reason for replacement: the legacy taxonomy was a quick stub for local dev. It conflated "venue" with "service" and did not match the structure the boss wants the platform to publish against. See `Claude Docs/plan.md` and the approved plan at `~/.claude/plans/hidden-cuddling-hopcroft.md` for full context.

Legacy taxonomy is **not** referenced anywhere in runtime code as of the replacement migration `supabase/migrations/20260421000000_taxonomy_profile_polish.sql`. This snapshot exists only so future readers can understand what shipped before.

## Parents (8)

| slug | name_en | name_ar | sort_order |
|---|---|---|---|
| `venues` | Venues & halls | قاعات ومواقع | 10 |
| `catering` | Catering & F&B | ضيافة وأطعمة | 20 |
| `photography` | Photography & video | تصوير فوتوغرافي وفيديو | 30 |
| `decor` | Decor, flowers & stage | ديكور وأزهار ومسرح | 40 |
| `entertainment` | Entertainment | ترفيه | 50 |
| `av` | AV & production | صوتيات وإنتاج | 60 |
| `transportation` | Transportation | نقل ومواصلات | 70 |
| `staffing` | Staffing & hosting | طاقم وضيافة | 80 |

## Sub-items (19)

| parent | slug | name_en | name_ar |
|---|---|---|---|
| venues | `venue-ballroom` | Ballroom | قاعة فخمة |
| venues | `venue-outdoor` | Outdoor venue | موقع خارجي |
| venues | `venue-conference` | Conference hall | قاعة مؤتمرات |
| catering | `catering-buffet` | Full-service buffet | بوفيه متكامل |
| catering | `catering-plated` | Plated dinner | عشاء بالطبق |
| catering | `catering-coffee` | Coffee / dessert cart | عربة قهوة وحلويات |
| photography | `photo-wedding` | Wedding photography | تصوير أعراس |
| photography | `photo-corporate` | Corporate photography | تصوير فعاليات الشركات |
| photography | `video-cinematic` | Cinematic videography | تصوير سينمائي |
| photography | `photo-drone` | Drone / aerial | تصوير جوي |
| decor | `decor-kosha` | Kosha & stage design | كوشة وتصميم مسرح |
| decor | `decor-florals` | Florals | ورود وأزهار |
| decor | `decor-lighting` | Event lighting | إضاءة فعاليات |
| entertainment | `dj` | DJ / music | موسيقى/دي جي |
| entertainment | `performer` | Live performer | فنان حي |
| av | `av-sound` | Sound system | أنظمة صوتية |
| av | `av-staging` | Staging & trussing | مسارح وهياكل |
| transportation | `transport-passenger` | Passenger transport | نقل ركاب |
| staffing | `staff-hostess` | Hosts & hostesses | مضيفين ومضيفات |

## Legacy `event_type` enum (7 values)

`wedding`, `corporate`, `government`, `exhibition`, `birthday`, `private`, `other`.

Replaced by the 5-value enum matching the new market segments: `private_occasions`, `business_events`, `entertainment_culture`, `sports_exhibitions`, `others`.

Coarse mapping if historical data ever needs to be reinterpreted (none in pilot):

| old | new |
|---|---|
| `wedding`, `birthday`, `private` | `private_occasions` |
| `corporate`, `government` | `business_events` |
| `exhibition` | `sports_exhibitions` |
| `other` | `others` |
| (no old value maps here) | `entertainment_culture` |

## Source

Seed lived at `supabase/seed.sql` lines 11–48, committed in the Sprint 1 foundation migration. That seed block is replaced by the new taxonomy insert inside `supabase/migrations/20260421000000_taxonomy_profile_polish.sql`.
