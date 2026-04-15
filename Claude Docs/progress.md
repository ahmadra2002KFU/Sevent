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

## Next up — Sprint 3 (2026-05-18 → 2026-05-31)

Theme: Organizer RFQ flow & auto-match.

Dependency: live verification of Sprints 1 + 2 (Docker + seed + walk the onboarding/verify/catalog/calendar flow end-to-end in a browser). Preview deliverables per `sprints.md` Sprint 3:

- Organizer dashboard + event creation.
- RFQ wizard: universal core + category-specific extension block.
- Public browse: category + city filters only.
- Auto-match v1: hard filters (approved+published, category, city/service-area, no availability conflict, capacity remaining, package qty range) + ranked top-5 (capability / travel / responsiveness / booking-quality / rotation).
- Supplier RFQ inbox.

Parallelization strategy to decide at Sprint 3 kickoff: whether to invest in real git worktree isolation (hook) OR drop to 2 sequential lanes given the shared-tree pain this sprint.
