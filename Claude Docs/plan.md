# Sevent — First-Stage Pilot Implementation Plan (v2, Codex-reviewed)

> This is a repo-local mirror of `C:\Users\Ahmad\.claude\plans\cached-inventing-pine.md`. See that file for the authoritative plan.

## Context

Sevent is a managed marketplace for the Saudi event industry. The goal is to move from the traditional "compete-on-a-tender" pattern to owning the end-to-end workflow between organizers (corporates, gov/semi-gov, event agencies) and suppliers (venues, catering, photography, decor, and more), inspired by Airbnb/Uber economics.

**Pilot purpose:**
- Clickable-demo + supplier-side SaaS MVP that ~20–30 friendly Riyadh/Jeddah suppliers will use for real RFQs.
- **Payments are off-platform** (bank transfer) in v1 — no Tap/escrow/ZATCA yet. The platform records state, generates an immutable-revisioned PDF contract, and fires notifications.
- English-first UI with i18n scaffolding so Arabic/RTL can land in v1.1 without refactor.
- Solo dev, target **10–12 weeks**, self-hosted on the user's Ubuntu box.
- Plan reviewed and refined by Codex; cut list and critical fixes below are locked.

## Locked cut list (v1.0 will NOT ship)

- Drag/drop calendar — replaced by form-based manual block + read-only month view.
- Quote templates library.
- Supplier KPI dashboard widgets (beyond a single summary card).
- Admin metrics dashboard UI (run SQL against the DB for pilot metrics).
- Taxonomy CRUD UI — categories seeded in SQL.
- Web push notifications — email + in-app rows only.
- Dual comparison views (table + card toggle) — **one** view only.
- Date-availability / min-rating / price-range public filters — public search limited to category + city.
- Video uploads (photos only).
- Arabic translation pass (strings wired through `t()` but `ar.json` stays stubbed).
- SEO sitemap generator (`generateMetadata()` only).

## Architecture (locked)

| Area | Decision |
|---|---|
| Framework | Next.js 15 App Router + Server Actions |
| Language | TypeScript strict |
| Data layer | Self-hosted Supabase (Docker Compose on Ubuntu) |
| Domain logic | Pure TS `lib/domain/*` + SQL RPCs for transactional operations |
| Styling | Tailwind + shadcn/ui, Sevent palette |
| i18n | `next-intl` (en default, ar stub) |
| Maps | Google Maps Platform (Places Autocomplete + Distance Matrix, 24h cache) |
| Email | Resend + React Email |
| PDF | `@react-pdf/renderer` |
| Validation | Zod |
| Forms | React Hook Form + Zod |
| Deployment | Docker Compose: nginx + Let's Encrypt, pg_cron, pg_dump → S3-compatible |

## Data model highlights (see authoritative plan for full schema)

Global rules:
- **All money in integer halalas** (`bigint`) + `currency char(3) default 'SAR'`.
- **Every revision-sensitive payload is snapshotted** (quotes, pricing, contracts).
- **Every state transition logs actor + timestamp.**

Key new/refined tables vs v1 draft:
- `quote_revisions` (NEW) — immutable snapshots per quote send, `content_hash` SHA-256, referenced by `bookings.accepted_quote_revision_id`.
- `dispute_evidence` (NEW) — files + text notes per party, replaces the assumption of in-app chat logs.
- `availability_blocks` extended with `reason enum(manual_block|soft_hold|booked)`, `booking_id`, `quote_revision_id`, `expires_at`, `released_at`, `created_by`.
- `suppliers.concurrent_event_limit` (int, default 1) — some suppliers can run parallel jobs.
- `pricing_rules` extended with `priority`, `is_active`, `valid_from`, `valid_to`, `currency`, `version`.
- `reviews` has `unique(booking_id, reviewer_id)` and `suppressed_for_dispute` flag.
- `bookings` has `awaiting_since`, `confirm_deadline`, `cancelled_at/by`, `accepted_quote_revision_id`.
- `rfq_invites` has `sent_at`, `response_due_at`, `decline_reason_code`.
- `quotes` has `currency`, `quoted_package_id`, `supplier_response_deadline`, `accepted_at`, `current_revision_id`.

## Critical logic specs

### Booking state machine (prevents double-book race)
1. Organizer accepts ⇒ transaction writes booking (`awaiting_supplier`, `confirm_deadline=now+48h`) + inserts `availability_blocks(reason='soft_hold', expires_at=now+48h)`.
2. Overlap trigger: count of overlapping `soft_hold|booked` rows must be `< concurrent_event_limit`; any overlapping `manual_block` consumes all capacity.
3. Supplier confirms ⇒ transaction flips row to `reason='booked'`, expires_at NULL, booking → `confirmed`.
4. Decline or expiry ⇒ pg_cron clears soft_hold, booking → `cancelled`, quote → `sent` (reusable).

### Pricing engine (deterministic, halalas, precedence-safe)
Order: service subtotal (base × qty logic) → duration → date surcharge (specific_date > named_period > weekday/weekend, one per date by priority) → percentage discounts → fixed addons → min-fee floor → travel (always separate line) → VAT line (zero in v1). Every send creates an immutable `quote_revisions` row with SHA-256 `content_hash`. Contract PDF renders from the revision only.

### Auto-match (two-stage)
**Hard filters:** approved + published; category + subcategory fit; city/service-area; no conflicting availability; capacity remaining; package qty range.
**Rank:** 0.45 capability · 0.20 travel fit · 0.15 responsiveness · 0.10 booking quality · 0.10 rotation. Return top 5 with human-readable reasons.

### Dispute workspace (no in-app chat)
Evidence submission model: `dispute_evidence` per party (files + notes). Admin context = accepted quote revision + contract + booking timeline + notifications history + evidence. Reviews suppressed while dispute open.

### Reviews
Eligibility: `completed` + not in active dispute. Unique per (booking, reviewer). Window 14d. pg_cron publishes when both submitted OR window closes.

## Sprint breakdown

See [`sprints.md`](./sprints.md) for per-sprint goals, deliverables, acceptance criteria, and dependencies.

## Verification

- ≥10 pricing engine test cases.
- SQL concurrency test on booking state machine.
- RLS test suite.
- 2 Playwright golden paths (happy + dispute).
- Backup/restore proof run once.
- axe-core pass on critical flows.

## Deferred (post-pilot)

Tap + escrow, ZATCA, Wathq API, Nafath, Arabic/RTL, gender-segregation, SMS/WhatsApp, in-app chat, Google Calendar, dynamic platform multipliers, GEA permits, incremental authorizations, instant-book, agency multi-client, PWA, supplier_resources.

## Source docs

- Research: `research/{claude-research.md, chatgpt-report.md, gemini-research.txt}`
- Q&A: [`sessions/qa-log.md`](./sessions/qa-log.md)
- Sprints: [`plans/sprints.md`](./plans/sprints.md)
