# Sevent — v2 Roadmap (deferred features captured during 2026-04-21 plan pass)

These are features the boss mentioned or that surfaced during planning but are explicitly out of scope for the current pass. Capture intent + approach so we don't lose context when we pick them up later.

## 1. Website scraper — supplier auto-populate

**Intent:** A supplier pastes their business website URL during onboarding. The platform extracts brand name, bio, contact info, service categories, and a few portfolio images. The supplier reviews + edits before saving. Reduces onboarding friction — especially valuable for low-literacy suppliers who already have a website but struggle to re-author content.

**Proposed tech:**
- Admin-triggered (not supplier-triggered) in v2.1 — avoids giving suppliers a button to abuse.
- Playwright container on the VPS grabs the page + renders it to both HTML and a screenshot.
- Claude Haiku 4.5 receives the HTML + screenshot and returns a structured JSON matching the onboarding Zod schema.
- Admin reviews the draft in a Sheet, approves, and the platform writes it against the supplier's row.

**Risks to design around:**
- Arabic-only sites render differently — need `accept-language: ar,en;q=0.8` and RTL-aware screenshot dimensions.
- Copy-right: we only extract plain text + public images; no PDFs/downloads.
- Rate-limit: one URL per supplier per 24h to prevent scraper misuse.

## 2. Dual-role accounts (planner + supplier in one account)

**Intent:** A single user can both plan events and supply services. Today's model enforces mutually exclusive roles per account.

**Proposed tech:**
- Replace `profiles.role` enum with `profiles.role_flags jsonb` holding `{ organizer: bool, supplier: bool, admin: bool, agency: bool }`.
- Top nav gains a role switcher (Planner view / Supplier view) when >1 flag is set.
- RLS policies widen from `role = 'x'` to `(role_flags->>'x')::boolean`.
- Requires a migration with a `check (role_flags != '{}'::jsonb)` constraint so users must have at least one role.

**Revisit after:** 4–6 weeks of pilot usage. If we see suppliers manually creating a second account to plan their own events, that's the signal.

## 3. Full drag-drop page builder for supplier profiles

**Intent:** Today suppliers reorder 4 fixed sections and set one accent color. v2 gives them a rich block editor: custom Hero, Services grid, Testimonials, Contact form, FAQ, Gallery — each configurable.

**Proposed tech:**
- Library: GrapesJS or Puck (React-native).
- Storage: `supplier_page_blocks` table with ordered `block_kind + config_jsonb` rows.
- Public `/s/[slug]` renders blocks from the DB. Preview + draft state mirrors the editor.

**Risk:** Significant scope. Only build if pilot suppliers ask for it.

## 4. Voice input for long-text fields (Arabic dictation)

**Intent:** Low-literacy suppliers fill bio / RFQ requirements by talking to their phone.

**Proposed tech:**
- Web Speech API with `lang="ar-SA"` — shipped in Chrome + Edge; Safari has patchy Arabic support.
- Fallback: small button that uploads an audio clip which the admin transcribes manually.
- Add a "🎤 record" button to every Textarea that opts in via a prop.

**Risk:** iOS Safari Arabic transcription is unreliable. Test on the actual devices the pilot cohort uses before building.

## 5. Public `/segments/[slug]` browse pages

**Intent:** Organizers exploring the marketplace by occasion, not by service category. `/segments/private-occasions` lands on a page showing "all suppliers who work on private occasions" with cross-links to relevant service categories (venues, catering, photography, florals, DJ).

**Proposed tech:**
- Extend the existing `/categories` browse with a sibling `/segments` route.
- Server query joins on `suppliers.works_with_segments @> array[$1]::event_type[]`.
- Needs a hero + segment-specific editorial copy — something a designer should draft, not this codebase.

## 6. Full `market_segments` lookup table

**Intent:** If segments need metadata (hero image, description, related-category hint list), the current `event_type` enum is too thin. Promote to a real table.

**Schema sketch:**
```sql
create table public.market_segments (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  hero_image_path text,
  sort_order int not null default 100
);
```

Then `events.segment_id` FK + `suppliers.segments uuid[]` references. Requires a migration path off the enum — doable, not free.

**Signal:** Only build when marketing wants segment-specific landing copy.

## 7. Data extraction from existing supplier portfolios

**Intent:** Related to #1 but narrower — suppliers often have Instagram / TikTok grids. Pull the last 12 images + captions into their portfolio upload staging area.

**Risk:** Platform ToS (Instagram especially) forbid automated scraping without API access. Treat as "Instagram Graph API via supplier's own OAuth" rather than scraping.

---

**Who to ask before implementing any of these:** the boss. None of these should ship without a product sign-off.
