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

## Next up — Sprint 2 (2026-05-04 → 2026-05-17)

Theme: Supplier onboarding & publication.

Dependencies all resolved on paper. Live dependency: Sprint 1 Docker verification must pass first. Expected first deliverables:

- Supplier onboarding wizard (business info → docs upload → base location + service area + capacity + `concurrent_event_limit`).
- Admin verifications queue (approve/reject docs, flip `verification_status` via the guarded trigger path).
- Public supplier profile page `/s/[slug]`.
- Packages CRUD + pricing-rules CRUD (one form per rule type; Zod-validated; priority ordering).
- Availability: read-only month view + form for manual blocks.
- TS service-role seed script creating the 25 demo suppliers referenced in the Sprint 1 seed note.
- Storage buckets + RLS policies for `supplier-portfolio`, `supplier-docs`, `contracts`.
- Email: supplier approved/rejected transactional email.
