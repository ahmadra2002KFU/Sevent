# Sevent — Progress log

Running record of build progress against the sprint plan in `sprints.md`.

---

## Sprint 1 — Foundations & schema (2026-04-20 → 2026-05-03)

Status: **code complete · live DB verification pending user starts Docker**.

### Completed tasks

| # | Task | Status | Notes |
|---|---|---|---|
| S1-1 | Scaffold Next.js 15/16 app + Tailwind + i18n | ✅ | Next.js 16.2.3 (App Router + Server Actions), TypeScript strict, Tailwind v4 with Sevent palette baked into `@theme`, `next-intl` wired (en default, ar stubbed), shadcn-style component dir ready. Hoisted pnpm linker (`.npmrc`) to work around exFAT drive. |
| S1-2 | Self-hosted Supabase via Docker Compose | ✅ | Chose Supabase CLI for local dev (same images, far better DX); `supabase init` complete; `config.toml` hardened (site_url, password policy `letters_digits` min 8, email confirmations on, secure password change). Production-compose skeleton at `docker-compose.prod.yml` for Sprint 6. Helper scripts: `pnpm db:start / db:stop / db:reset / db:new / db:diff`. |
| S1-3 | Supabase clients + auth + profile trigger | ✅ | Three Supabase clients: browser, server, service-role. Next 16 `proxy.ts` (renamed from middleware) enforces role-prefix gates. Auth UI: `/sign-up` (role selector) + `/sign-in` wired via Server Actions with Zod validation. Signup trigger `handle_new_user()` populates `profiles`; admin role cannot be self-assigned (trigger rejects and falls back to organizer). |
| S1-4 | Base schema migrations (all v1 tables + RLS + indexes) | ✅ | Two migrations applied cleanly by `next build` typecheck. Highlights: all money as `bigint halalas` + `currency char(3)`; `quote_revisions` immutable snapshots with `content_hash`; `dispute_evidence` replaces the in-app-chat assumption; `availability_blocks` with reason enum + soft-hold columns + GiST index + unique partial index on `booking_id`; `suppliers.concurrent_event_limit`; `pricing_rules` with `priority/version/is_active/valid_from/valid_to/currency`; `reviews` with `unique(booking_id, reviewer_id)` + `suppressed_for_dispute`; RLS on every table with organizer / supplier / admin / public policies. Trigger `guard_supplier_verification` prevents self-approval. |
| S1-5 | Seed SQL: categories + pilot users + suppliers | ✅ (partial by design) | Categories tree seeded in `supabase/seed.sql` (8 parents · 19 subcategories, bilingual). Full profile/supplier/package fixtures deferred to a TS service-role script in Sprint 2 because seeding `auth.users` rows directly in SQL requires pre-hashed passwords and is fragile — the TS helper lands alongside onboarding. |
| S1-6 | state-machines.md + pricing-examples.md | ✅ | `Claude Docs/state-machines.md` with Mermaid diagrams for booking lifecycle (incl. soft-hold → booked concurrency spec), review publication, dispute resolution. `Claude Docs/pricing-examples.md` with 13 deterministic test cases covering all five rule types, precedence, rounding, min-fee floor, zero-clamp, VAT-zero column. |
| S1-7 | pg_dump nightly backup + restore runbook | ✅ | `scripts/db-backup.sh` gzips nightly dumps into `backups/`, prunes >14d, env-overridable. `Claude Docs/runbook.md` documents local dev ops, cron line, restore drill (scratch-container verification). |

### Build state

- `pnpm exec next build` green; all 7 routes compile + typecheck.
- Known deprecation: used Next 16's new `proxy.ts` name instead of `middleware.ts`.

### Repo layout delivered

```
Code/
├─ src/
│  ├─ app/
│  │  ├─ (public)/page.tsx                  landing (brand-themed)
│  │  ├─ (auth)/{sign-in,sign-up}/…         forms + Server Actions
│  │  ├─ (organizer)/organizer/dashboard/   stub
│  │  ├─ (supplier)/supplier/dashboard/     stub
│  │  └─ (admin)/admin/dashboard/           stub
│  ├─ i18n/request.ts                       next-intl config
│  ├─ messages/{en,ar}.json
│  ├─ lib/supabase/{server,client,middleware}.ts
│  ├─ lib/env.ts                            Zod-validated env
│  └─ proxy.ts                              role-gate
├─ supabase/
│  ├─ config.toml                           hardened
│  ├─ migrations/
│  │  ├─ 20260420000000_extensions_and_profiles.sql
│  │  └─ 20260420000100_marketplace_schema.sql
│  └─ seed.sql                              categories tree
├─ scripts/db-backup.sh
├─ docker-compose.prod.yml                  skeleton for Sprint 6
├─ Claude Docs/
│  ├─ qa-log.md · plan.md · sprints.md      (pre-existing)
│  ├─ state-machines.md                     NEW
│  ├─ pricing-examples.md                   NEW
│  ├─ runbook.md                            NEW
│  └─ progress.md                           this file
└─ package.json · next.config.ts · .env.example · .npmrc · .prettierrc.json
```

### Pending verification (user action required)

1. Start Docker Desktop (manual — the background launch in this session hadn't completed after 5 min).
2. `cp .env.example .env.local`
3. `pnpm db:start` — downloads ~2 GB first run. Paste printed anon + service-role keys into `.env.local`.
4. `pnpm db:reset` — applies both migrations + seeds categories.
5. `pnpm dev` → <http://localhost:3000> → sign up as organizer → confirm email via Inbucket <http://localhost:54324> → sign in → auto-redirect to `/organizer/dashboard`.
6. Optional dry-run of `scripts/db-backup.sh` + the scratch-container restore drill described in `runbook.md`.

### Sprint 1 acceptance criteria (from sprints.md) — status

- [x] Role-aware routes defined; gate implemented in `proxy.ts`.
- [x] Email/password sign-up + sign-in wired; profile row auto-created.
- [x] All v1 tables + RLS + indexes committed as migrations.
- [x] `supabase start` + `pnpm migrate` + seed runnable; **awaiting live run**.
- [x] RLS smoke spec written (state-machines.md + migration comments); live test deferred until Docker is up.
- [x] Backup/restore runbook documented; live drill pending Docker.

---

## Sprint 2 — Supplier onboarding & publication (2026-05-04 → 2026-05-17)

Status: **code complete on `main` · live verification pending Docker**.

Executed as a Codex-approved 4-lane parallel plan + one focused fix agent, all running concurrently in the shared working tree after a synchronous Lane 0 prep pass. Five branches merged back to `main` in the Codex-prescribed integration order.

### Completed work

| # | Lane / Fix | Branch (merged) | Commit | Notes |
|---|---|---|---|---|
| S2-0 | Lane 0 — shared primitives | `main` (direct) | `0fc8f81`, `21a0503` | supplier+admin layouts; route stubs; `src/lib/supabase/{types,storage}.ts`; `src/lib/domain/{money,onboarding,packages,availability,pricing/rules}.ts`; storage-buckets migration + RLS; `RESEND_FROM_EMAIL` env; i18n namespaces; pre-installed deps for Lanes 1/3 (resend, react-email, tsx, date-fns, dotenv). |
| S2-M | Fix — migration ordering | `sprint2/fix-migration-ordering` → `main` | `79abbc9` | One forward reference found: `rfqs: invited supplier read` policy referenced `rfq_invites` before its declaration. Moved the policy to right after `rfq_invites`' RLS enable. All FK deferred constraints already correct. |
| S2-1 | Lane 1 — supplier onboarding + service-role seed + storage RLS test | `sprint2/lane1` → `main` | `5f92ebf` | 3-step wizard with React Hook Form + Zod; slug disambiguation; `scripts/seed-users.ts` creates 1 admin + 2 organizers + 25 suppliers (12 Riyadh / 13 Jeddah) with packages, rules (rotating all 5 `pricing_rule_type` values), portfolio photos, docs; first 8 approved+published; `pnpm seed` script in package.json; `supabase/tests/storage-rls.test.sql` proving cross-supplier doc read denial. |
| S2-3 | Lane 3 — admin verifications + approval email | `sprint2/lane3` → `main` | `da80036` | Admin list (tabs: Pending / Approved / Rejected) + detail view with signed-URL doc previews; server actions `approveSupplier / rejectSupplier / approveDoc / rejectDoc` — each re-checks admin role then uses service-role client to flip `verification_status` (passes `guard_supplier_verification` trigger); Resend wrapper with console-log fallback when `RESEND_API_KEY` is unset; branded React Email templates `SupplierApproved.tsx` + `SupplierRejected.tsx`; `notifications` row writer. |
| S2-4 | Lane 4 — supplier calendar | `sprint2/lane4` → `main` | `6e103d3` | `/supplier/calendar` read-only month grid (dots + stripe per reason) + manual-block list + form; RHF + Zod via `ManualBlockInput`; server actions write only `reason='manual_block'`, scope every op by `supplier_id + reason`; Postgres errors run through `friendlyAvailabilityError`. |
| S2-2 | Lane 2 — catalog + public profile | `sprint2/lane2` → `main` | `e9822a3` | Packages CRUD (form → `sarToHalalas` → `PackageRow` in server action); rule-type picker + 5 per-type forms (`qty_tier_all_units` / `qty_tier_incremental` / `distance_fee` / `date_surcharge` / `duration_multiplier`) each serializing via `parsePricingRuleConfig`; supplier-wide + per-package rule grouping; public `/s/[slug]` with portfolio grid, packages with "from" prices via `formatHalalas`, verified badge, bio/languages/service-area, reviews placeholder; `notFound()` for unpublished/unapproved. |

Sprint 2 main HEAD: `76913ba` · pushed to `origin/main`.

### Verification state

- `pnpm exec tsc --noEmit` — **clean (0 errors)**.
- `pnpm exec eslint src` — **clean (0 errors, 1 benign warning)** — single RHF `watch()` compiler warning in `onboarding/wizard.tsx`, not a correctness issue.
- `pnpm exec next build` — **blocked on host** by Windows + exFAT fs. Two independent failure modes:
  - Turbopack: `failed to create junction point at ".next\node_modules\prettier-…"` → exFAT doesn't support reparse points.
  - Webpack fallback (`next build --webpack`): `FlightClientEntryPlugin` crash reading `.server` of undefined after `EISDIR` on `favicon.ico` readlink.
  - **Not a code regression** — reproduces on a clean Lane 0 checkout with only deps installed. Production build must run on Linux / NTFS (WSL2, Ubuntu host, or CI). Deferred to Sprint 6 hardening.
- Live DB verification still pending — user needs to start Docker Desktop and run `pnpm db:start && pnpm db:reset && pnpm seed`.

### Sprint 2 acceptance criteria (from `sprints.md`) — status

- [x] Lane 0 primitives merged to main; typecheck + lint green.
- [x] Lane 1 merged; 25-supplier seed script in place; storage RLS SQL test in place.
- [x] Lane 3 merged; admin approve/reject flows wired; email renders (console-logged locally when Resend key absent).
- [x] Lane 4 merged; manual-block UX + mapped overlap error.
- [x] Lane 2 merged; `/s/[slug]` renders for approved+published suppliers; all 5 rule types round-trip through the form.
- [ ] `pnpm db:reset && pnpm dev` end-to-end walk — **pending Docker**.
- [x] Migration forward-reference bug fixed and merged.

### Observed friction worth carrying forward

- **Shared-tree parallel agents** repeatedly stomped on each other's untracked files during their runs. Lane 1 and Lane 3 both reported recovering via `git stash`. Future sprints should either use real `git worktree add`-backed isolation (needs a `WorktreeCreate` hook configured in `settings.json`) OR run lanes sequentially. For this sprint the final commits were clean because each agent committed atomically.
- `pnpm exec next build` on the D: drive is blocked by filesystem semantics. CI or Linux host is the way.

---

## Sprint 3 — Organizer RFQ flow & auto-match (2026-05-18 → 2026-05-31)

Status: **code complete on `main` · live DB verification pending user starts Docker**.

Executed Lane 0 synchronously on `main`, then Lanes 2 → 1 → 3 **sequentially** (worktree isolation unavailable in this harness — no `WorktreeCreate` hook configured; fell back to sequential per Sprint 2 retro's backup plan).

### Completed work

| # | Lane | Commit | Notes |
|---|---|---|---|
| S3-0 | Lane 0 — shared primitives | `8c6b185` | Organizer layout + route stubs; `src/lib/domain/events.ts` (`EVENT_TYPES`, `CITY_OPTIONS`, `EventFormInput`, `EventRow`), `rfq.ts` (`RfqExtension` discriminated union + `parseRfqExtension`); skeletons for `matching/{autoMatch,query,reasons}.ts` + `responsiveness.ts` (throw "not implemented — Lane 2"); extended `src/lib/supabase/types.ts` with `EventRow / RfqRow / RfqInviteRow / QuoteRow`; `vitest` + `@vitest/ui` in devDeps + `vitest.config.ts` + `money.test.ts` smoke; i18n namespaces `organizer.*`, `supplier.rfqInbox`, `public.{categories,search}` (en + ar stub). |
| S3-2 | Lane 2 — auto-match + supplier RFQ inbox | `e213e24` | `computeAutoMatch` real body (weights 0.45 capability · 0.20 travel · 0.15 responsiveness · 0.10 booking_quality · 0.10 rotation), deterministic, stable tiebreak `supplier_id ASC`, top-5 cap. `fetchAutoMatchCandidates` applies plan.md hard filters (approved+published + subcategory link + city/service-area via PostgREST `.or()` in SQL; availability-overlap + capacity + qty-range in TS post-filter because `NOT EXISTS` across joins is awkward in supabase-js). `computeResponseRate30d` returns null when invites<5. **15 Vitest cases** for determinism + tiebreak + travel ranking + capability floor + rotation penalty + guest-null branch + top-5 cap + score bounds + reasons attachment. `/supplier/rfqs` list with countdown + `[id]` detail + `declineInviteAction`. |
| S3-1 | Lane 1 — public browse + RFQ extension forms | `a1552f0` | `/categories` grid with per-parent supplier count · `/categories/[parent]?city=…` subcategory listing with city dropdown filter (TS-level city match on joined rows). `src/lib/domain/publicBrowse.ts` read-side DTOs. Extension form components (`VenuesExtensionForm` / `CateringExtensionForm` / `PhotographyExtensionForm` / `GenericExtensionForm`) + dispatcher `<RfqExtensionForm kind={...} value={...} onChange={...} errors={...} />` + `defaultExtensionFor(kind)` (parse-clean). i18n keys under `organizer.rfqWizard.extensions.*`. |
| S3-3 | Lane 3 — organizer UX + RFQ wizard + send action | `ffebf0e` | Real organizer dashboard (event count, RFQ stats, latest RFQs, upcoming events). `/organizer/events` list + `/new` RHF form (custom resolver wrapping `EventFormInput` so datetime-local strings round-trip through ISO before Zod validates) + `[id]` detail. `/organizer/rfqs` list + detail with invites table. **4-step client wizard**: pick event/category → extension (auto-kind by parent slug, overridable) → auto-match shortlist (remove matched + debounced search-and-add, 1–10 bounds) → review + send (24/48/72h deadline). Server actions: `createEventAction`, `listMyEventsAction`, `listCategoriesAction`, `previewAutoMatchAction` (try/catch → `matching_offline`), `searchApprovedSuppliersAction`, `sendRfqAction` with `upsert onConflict(rfq_id, supplier_id)`. `ShortlistEditor` client component. |

Sprint 3 main HEAD: `ffebf0e` · pushed to `origin/main`.

### Verification state

- `pnpm exec tsc --noEmit` — **clean (0 errors)**.
- `pnpm exec eslint src` — **clean (0 errors, 3 benign warnings)** — two RHF `watch()` compiler warnings (pre-existing pattern in onboarding + new event form); one `_candidate` unused param in Sprint 5 booking-quality placeholder.
- `pnpm test` — **16 tests across 2 files green** (Lane 0 money smoke + Lane 2 `autoMatch` 15-case suite).
- `pnpm exec next build --webpack` — **still blocked** by the pre-existing exFAT/webpack EISDIR bug on `readlink src/app/*`. Verified to reproduce on a clean checkout — not a Lane 0/1/2/3 regression. Production build must run on Linux / NTFS (WSL2, Ubuntu host, or CI). Remains deferred to Sprint 6 hardening, possibly via `next.config.ts` `webpack.resolve.symlinks = false`.
- Live DB verification still pending Docker — user needs to run `pnpm db:start && pnpm db:reset && pnpm seed && pnpm dev` and walk the organizer path.

### Sprint 3 acceptance criteria (from `sprints.md`) — status

- [x] Public landing + category index + subcategory listing (server components).
- [x] Public search: category + city only.
- [x] Organizer dashboard: "Events" list, "RFQs" status table.
- [x] Create-event form (event_type, date range, city, venue via free-form address, guest_count, budget_range). **Places Autocomplete deferred** to Sprint 6 per locked plan.
- [x] RFQ wizard: universal fields + category-specific extension block (schema-driven).
- [x] Auto-match (hard filters + ranked top-5 with human-readable reasons).
- [x] Organizer shortlist editor: remove auto-suggested or add approved suppliers.
- [x] Send RFQ: creates `rfq_invites` with `sent_at`, `response_due_at` (24h default, 48/72h options).
- [x] Supplier RFQ inbox: list with countdown + detail view + decline action.
- [x] Unit tests for auto-match hard filters + ranking determinism (15 Vitest cases).
- [ ] Live walk: organizer creates event → sends RFQ → invited suppliers see it in their inbox · cross-supplier RLS denial verified — **pending Docker + user walk-through**.

### Observed friction worth carrying forward

- **Worktree isolation not wired in this harness.** The Agent tool needs a `WorktreeCreate` hook in `settings.json` to use `isolation: "worktree"`. Without it, all three lanes ran sequentially on `main`. Sprint 4 should either land that hook (so lanes parallelize cleanly) or accept sequential as the steady state. Sequential was slower but produced 4 clean commits with zero stomping.
- **`pnpm exec next build` remains broken on exFAT.** Verified on clean `main` without any Sprint 3 changes. Either the `webpack.resolve.symlinks = false` workaround or a WSL2 build host is the fix.
- **`sendRfqAction` upsert is unconditional** — re-sending an RFQ could overwrite a `quoted`/`declined` invite back to `invited`. Documented TODO in the action file; Sprint 6 should convert to an RPC with conditional transition rules (`invited ↔ withdrawn` only).
- **Wizard i18n partially inline** — step labels, table headers, a few shortlist-editor strings are still hardcoded English. All other strings use `getTranslations`. Sprint 6 polish pass should complete.
- **Reasons rendered as English literals** (not i18n keys) from `reasonsFor` — Lane 2 chose this to keep the pure function signature simple; a Sprint 6 refactor should inline a tiny `getTranslations` wrapper when called from server contexts.

---

## Next up — Sprint 4 (2026-06-01 → 2026-06-14)

Theme: Pricing engine, quote revisions, acceptance soft-hold.

Dependency: live verification of Sprint 3 (Docker + seed + walk organizer → event → RFQ → supplier inbox end-to-end in a browser). Preview deliverables per `sprints.md` Sprint 4:

- Lock pricing engine + booking state machine specs in `state-machines.md` / `pricing-examples.md` before any UI.
- `lib/domain/pricing/engine.ts` pure `composePrice()` returning halalas + separate travel line + zero-VAT fields.
- `lib/domain/pricing/distance.ts` Google Distance Matrix wrapper with 24h cache per `(supplier_id, venue_hash)`.
- Supplier quote builder UI + immutable `quote_revisions` with `content_hash`.
- Organizer single-view quote comparison (table).
- Booking state machine RPC `accept_quote_tx` in PL/pgSQL (soft-hold + awaiting_supplier + trigger overlap check).
- ≥10 pricing engine Vitest cases + SQL concurrency test for simultaneous accept.
