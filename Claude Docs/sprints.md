# Sevent — Sprint Breakdown (6 × 2 weeks, solo dev)

Start date: **2026-04-20 (Monday)**. Target pilot-ready: **~2026-07-13**. Each sprint is 10 working days.

Legend:
- 🏗 Build | 🧪 Test | 📜 Spec/doc | 🧯 Infra
- **AC** = acceptance criteria (all must pass to close the sprint)

---

## Sprint 1 — Foundations & schema (2026-04-20 → 2026-05-03)

**Goal:** get the stack running on the Ubuntu box with auth, role model, halalas-correct base schema, and seeded data. Nothing customer-facing yet.

Deliverables:
- 🧯 `docker-compose.yml` with self-hosted Supabase (Postgres 15 + GoTrue + PostgREST + Storage + Studio), nginx, Let's Encrypt via caddy or nginx, pg_cron enabled.
- 🏗 Next.js 15 app skeleton (App Router + Server Actions), TypeScript strict, Tailwind + shadcn themed with Sevent palette, `next-intl` scaffolding (`en` default, `ar.json` stubbed).
- 🏗 Supabase Auth: email + password sign-up / sign-in, password reset.
- 🏗 `profiles` table + `role` enum + `auth.users` trigger to create profile row on sign-up.
- 🏗 Role-aware route groups: `(public)`, `(auth)`, `(organizer)`, `(supplier)`, `(admin)`.
- 🏗 Base schema migrations: `categories`, `suppliers` (incl. `concurrent_event_limit`), `supplier_categories`, `supplier_docs`, `supplier_media`, `packages` (halalas), `pricing_rules` (incl. priority/version/valid_from-to), `availability_blocks` (full reason enum + new columns + indexes), `events`, `rfqs`, `rfq_invites`, `quotes`, `quote_revisions`, `bookings`, `reviews`, `disputes`, `dispute_evidence`, `notifications`.
- 🏗 RLS policies for every table (baseline: owner-only reads/writes; admin full read; published supplier pages publicly readable).
- 🏗 Seed SQL: 2-level category tree, 1 admin, 2 organizers, 25 suppliers across Riyadh + Jeddah.
- 🧯 `pg_dump` nightly cron to local path + README for restore.
- 📜 `Claude Docs/state-machines.md` — booking + dispute + review flow diagrams (Mermaid).
- 📜 `Claude Docs/pricing-examples.md` — ≥10 pricing test cases written as tables (will become unit tests in Sprint 4).

AC:
- All 4 roles can sign up + sign in on `http://localhost:3000` or the Ubuntu domain.
- `supabase start` + `pnpm migrate` + `pnpm seed` produces a usable DB in <3 min.
- RLS smoke: admin-only query from organizer context returns empty; supplier cannot read another supplier's `packages`.
- `pg_dump` + restore into a clean container matches row counts.

Dependencies: none.

Parallel tasks inside sprint: app shell + auth routes while Supabase containers stabilize.

---

## Sprint 2 — Supplier onboarding & publication (2026-05-04 → 2026-05-17)

**Goal:** a verified supplier can publish a profile, catalog, and manage manual availability blocks.

Deliverables:
- 🏗 Supplier onboarding wizard (3 steps): business info → docs upload → base location + service area + languages + capacity + `concurrent_event_limit`.
- 🏗 Supabase Storage buckets (`supplier-portfolio`, `supplier-docs`, `contracts`) with RLS policies using signed URLs.
- 🏗 Admin verifications queue: view uploaded docs, approve/reject with note, mark `verification_status`.
- 🏗 Supplier profile editor + public `/s/[slug]` page (portfolio photos, packages with "from" prices, verified badge, bio, languages).
- 🏗 Packages CRUD UI (name, subcategory, unit, base_price in halalas input, min/max qty, from_price_visible).
- 🏗 Pricing rules CRUD UI — one form per `rule_type`, with Zod validation, priority ordering, active toggle, valid_from/to.
- 🏗 Availability calendar: read-only month view + "Add manual block" form (start, end, reason text).
- 🏗 Email notifications: supplier approved/rejected.
- 🧪 SQL unit tests for RLS on storage (non-owners cannot read a supplier's docs).

AC:
- Admin can approve a freshly signed-up supplier; upon approval, `/s/[slug]` becomes publicly visible with listed packages.
- Supplier can add a package + one of each rule_type and see serialized config round-trip correctly.
- Manual block saves; conflicting block overlap returns a readable error.

Dependencies: Sprint 1 schema + auth + roles.

Parallel tasks: admin verification screens ↔ storage policy refinement.

---

## Sprint 3 — Organizer RFQ flow & auto-match (2026-05-18 → 2026-05-31)

**Goal:** an organizer can find suppliers, create an event with one RFQ, and the platform routes it to the best 3-5 approved suppliers.

Deliverables:
- 🏗 Public landing + category index + subcategory listing (server components).
- 🏗 Public search: category + city only.
- 🏗 Organizer dashboard: "Events" list, "RFQs" status table.
- 🏗 Create-event form (universal fields: event_type, date range, city, venue via Places Autocomplete, guest_count, budget_range).
- 🏗 RFQ wizard: universal fields + category-specific extension block (schema-driven).
- 🏗 Auto-match service (`lib/domain/matching/autoMatch.ts`):
  - Hard filters first (SQL): approved + published, category match, city/service-area, `availability_blocks` non-conflict, capacity remaining, package qty range.
  - Rank top 5 (TS): 0.45 capability + 0.20 travel + 0.15 responsiveness + 0.10 booking quality + 0.10 rotation.
  - Return reason strings.
- 🏗 Organizer shortlist editor: remove an auto-suggested supplier or add one from category (must be approved).
- 🏗 Send RFQ: creates `rfq_invites` with `sent_at`, `response_due_at` (default 24h).
- 🏗 Supplier RFQ inbox: list of invites with due_at countdown, RFQ detail view.
- 🧪 Unit tests for auto-match hard filters + ranking determinism.

AC:
- Organizer creates event → sends RFQ → exactly the matched (+ manually added) suppliers see it in their inbox.
- Cross-supplier RLS test: supplier B cannot read an RFQ invited only to supplier A.
- Auto-match never returns unapproved, unpublished, or availability-conflicting suppliers.

Dependencies: Sprint 2 (approved suppliers + packages + availability).

Parallel tasks: public pages + organizer dashboard ↔ auto-match logic.

---

## Sprint 4 — Pricing engine, quote revisions, acceptance soft-hold (2026-06-01 → 2026-06-14)

**Goal:** supplier responds with a computed-or-edited quote; organizer accepts; booking enters awaiting_supplier with a transactional soft-hold.

Deliverables:
- 📜 Lock pricing-engine + booking-state-machine specs in `state-machines.md` and `pricing-examples.md` before any UI work.
- 🏗 `lib/domain/pricing/engine.ts` — pure `composePrice(ctx, rules)` returning halalas + separate travel line + zero-VAT fields. Deterministic ordering per plan.
- 🏗 `lib/domain/pricing/distance.ts` — Google Distance Matrix wrapper with 24h cache keyed by `(supplier_id, venue_hash)`.
- 🏗 Supplier quote builder UI: engine auto-generates draft → supplier edits line items, can toggle free-form override → preview → send. Each send writes a new `quote_revisions` row with SHA-256 `content_hash`.
- 🏗 Organizer single-view quote comparison (table layout): line items collapsed per supplier, key totals highlighted, "Accept" button.
- 🏗 Booking state machine RPC (`accept_quote_tx`) in PL/pgSQL:
  - Insert `bookings` row (`awaiting_supplier`, `confirm_deadline`).
  - Insert `availability_blocks` (`soft_hold`, `expires_at`, `booking_id`, `quote_revision_id`).
  - Trigger re-checks overlap + capacity; ABORT if conflict.
- 🧪 ≥10 pricing engine unit tests (Vitest) — stacking, min-fee, rounding, zero-clamp, distance separation.
- 🧪 SQL concurrency test: two organizers accept overlapping slots simultaneously; exactly one booking ends `awaiting_supplier`.

AC:
- Engine tests all green.
- `quote_revisions.content_hash` stable for identical inputs, differs on any field change.
- Simultaneous-accept SQL test passes.
- Organizer can accept → booking row exists with `accepted_quote_revision_id` set.

Dependencies: Sprint 3 (RFQs + suppliers).

Parallel tasks: engine unit tests + state-machine SQL tests locked before writing any UI.

---

## Sprint 5 — Confirm, contract PDF, reviews, disputes (2026-06-15 → 2026-06-28)

**Goal:** close the loop — supplier confirms, contract is generated from the accepted revision, post-event reviews publish correctly, disputes can be opened and resolved with evidence.

Deliverables:
- 🏗 Supplier confirm/decline UI for `awaiting_supplier` bookings.
- 🏗 `confirm_booking_tx` RPC: re-check overlap, flip `availability_blocks` to `booked`, `bookings.confirmation_status='confirmed'`.
- 🏗 `pg_cron` job every 5 min: expire `soft_hold` past `expires_at`, cancel bookings still `awaiting_supplier` past `confirm_deadline`, return quote to `sent`.
- 🏗 React-PDF contract template; generated on confirmation from `bookings.accepted_quote_revision_id`; saved to `contracts` bucket; signed URL delivered via email + in-app.
- 🏗 Notifications pipeline: transactional emails (Resend) + `notifications` rows for every state transition (RFQ sent, quote received, accepted, awaiting_supplier, confirmed, cancelled, completed, dispute opened/resolved).
- 🏗 Manual booking completion trigger (admin or scheduled based on `ends_at`): sets `service_status='completed'`, `completed_at=now()`, opens review window (`window_closes_at=now+14d`).
- 🏗 Review submission UI (both sides): ratings + text. Unique per `(booking_id, reviewer_id)`.
- 🏗 `publish_reviews_job` pg_cron hourly: publish when both reviews submitted OR window closed AND no active dispute.
- 🏗 Dispute open UI (organizer + supplier) with `reason_code` + description, within 7d of completion.
- 🏗 `dispute_evidence` submission (files + notes) by both parties.
- 🏗 Admin dispute workspace: accepted `quote_revision` + contract + booking timeline + notifications history + evidence panel; resolution form writes `resolution_jsonb` and flips status.
- 🏗 On dispute open/close: flip `reviews.suppressed_for_dispute` appropriately.

AC:
- Supplier confirms → contract PDF downloadable by both parties; PDF content matches `quote_revisions` exactly (hash stays valid).
- Simulated 48h timeout on a test booking expires the soft-hold and releases the slot.
- Two submitted reviews auto-publish when window closes; a dispute opened before window close keeps them unpublished until resolution.
- Admin resolution is recorded with actor + timestamp; audit chain intact.

Dependencies: Sprint 4 (booking + quote revisions).

Parallel tasks: contract PDF template + email templates can be drafted during Sprint 4 spec work.

---

## Sprint 6 — Hardening & pilot readiness (2026-06-29 → 2026-07-12)

**Goal:** ship-ready. Tests, deploy, backups, dry-run with a real supplier.

Deliverables:
- 🧪 RLS test suite (TS harness): every role × every table × read/write matrix for allowed + denied paths.
- 🧪 Playwright golden paths (2):
  - Happy path: organizer sign-up → event → RFQ → supplier quote → accept → supplier confirm → contract download → mark complete → both review → publish.
  - Dispute path: open dispute on a completed booking → both submit evidence → admin resolves → reviews publish.
- 🧪 axe-core accessibility pass on landing, sign-up, RFQ wizard, quote comparison, supplier dashboard; fix **critical** violations only.
- 🧯 Production deploy on Ubuntu: nginx + TLS, docker-compose.prod.yml, secrets via env files, pg_dump to S3-compatible storage (e.g., Cloudflare R2), basic log rotation.
- 🧯 Backup/restore drill: restore last night's dump into a second container; row counts + contract PDF integrity verified.
- 🏗 Final seed refresh: the 20-30 pilot suppliers pre-seeded with real profile stubs that they can claim on first login.
- 🏗 Pilot onboarding dry-run with 2-3 friendly suppliers: record friction; fix blockers only.
- 📜 `Claude Docs/admin-queries.md` — SQL snippets for all pilot metrics (onboarded suppliers, active suppliers, RFQs sent, response rate, quote-to-booking conversion).
- 📜 `Claude Docs/runbook.md` — deploy / rollback / backup-restore / pg_cron health / Supabase upgrade notes.

AC:
- Both Playwright golden paths green in CI (GitHub Actions or local runner).
- RLS test suite green.
- Restore-from-backup produces a working app.
- 2 friendly suppliers complete onboarding → profile → catalog → pricing rules → manual block without manual DB edits.

Dependencies: Sprint 5 (full loop).

Parallel tasks: Playwright golden-path tests should have been running since Sprint 4 on every schema change; Sprint 6 only widens coverage.

---

## Sprint-crossing disciplines

- **Every PR** runs: typecheck, Vitest, existing Playwright golden-paths, RLS smoke.
- **No feature work in Sprint 6** — buffer for bug fixes + hardening only.
- **Claude Docs updates mandatory per sprint:** `state-machines.md`, `pricing-examples.md`, `admin-queries.md`, `runbook.md`.
- **Deferred items are only added** if they block a locked v1 feature (they shouldn't — cut list is enforced).

## Risks to watch (from Codex review)

1. Self-hosted Supabase ops eating Sprint 1 buffer → keep an eye; if upgrade/backup story looks brittle by end of S1, reassess managed Supabase Cloud for pilot.
2. Pricing engine edge cases surfacing in S4 unit tests → if ≥3 tests must rewrite the model, pause UI and refactor.
3. RLS gotchas showing up late → write RLS denial tests from Sprint 1, not Sprint 6.
4. Supplier dry-run in Sprint 6 revealing UX blockers → reserve 3 days of Sprint 6 buffer for emergency fixes only.
