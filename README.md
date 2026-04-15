# Sevent

The Saudi event marketplace — Next.js 16 + self-hosted Supabase.

Plans, sprints, and business research live in `Claude Docs/` and `Docs/`.

## Prerequisites

- Node 22+, pnpm 10+
- Docker Desktop (or any Docker engine) running locally. The Supabase CLI uses it.

## Local development

```bash
# 1. Install deps
pnpm install

# 2. Copy env template and fill in values
cp .env.example .env.local

# 3. Start the Supabase stack (Postgres, GoTrue, PostgREST, Storage, Studio)
pnpm db:start

# 4. Run the Next.js dev server in another terminal
pnpm dev
```

App: <http://localhost:3000>
Studio (database UI): <http://localhost:54323>
Inbucket (captured dev emails): <http://localhost:54324>
Postgres: `postgresql://postgres:postgres@localhost:54322/postgres`

### Useful scripts

| Script          | What it does                                                                |
| --------------- | --------------------------------------------------------------------------- |
| `pnpm dev`      | Next.js dev server (App Router + Server Actions)                            |
| `pnpm build`    | Production Next.js build                                                    |
| `pnpm lint`     | ESLint                                                                      |
| `pnpm typecheck`| `tsc --noEmit`                                                              |
| `pnpm db:start` | Boot local Supabase stack                                                   |
| `pnpm db:stop`  | Stop local Supabase stack                                                   |
| `pnpm db:reset` | Drop the local DB and re-apply all migrations + seed.sql                    |
| `pnpm db:new`   | Create a new migration (`pnpm db:new add_suppliers`)                        |
| `pnpm db:diff`  | Diff current DB against migrations and write a new migration file           |

### First-time Supabase setup

1. Make sure Docker Desktop is running.
2. `pnpm db:start` — the first run pulls images (~2 GB) and prints the API URL, anon key, and service-role key. Paste these into `.env.local`:

   ```text
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # from `pnpm db:start` output
   SUPABASE_SERVICE_ROLE_KEY=...       # from same output
   ```

3. `pnpm db:reset` applies migrations + seed data from `supabase/migrations/*.sql` and `supabase/seed.sql`.

### Project layout

```
src/
├─ app/
│  ├─ (public)/       — landing, category, supplier-profile (SEO-indexable)
│  ├─ (auth)/         — sign-in, sign-up
│  ├─ (organizer)/    — /organizer/*
│  ├─ (supplier)/     — /supplier/*
│  └─ (admin)/        — /admin/*
├─ lib/
│  ├─ supabase/       — server + browser clients, RLS helpers
│  ├─ domain/         — booking, quote, pricing, matching, reviews, disputes
│  └─ env.ts          — validated process.env via Zod
├─ messages/          — next-intl (en default, ar stubbed)
└─ i18n/request.ts    — next-intl config

supabase/
├─ config.toml        — local Supabase CLI config
├─ migrations/        — SQL schema (Sprint 1 task S1-4)
└─ seed.sql           — seed data (Sprint 1 task S1-5)

Claude Docs/
├─ plan.md            — authoritative Sevent plan (v2, Codex-reviewed)
├─ sprints.md         — 6-sprint breakdown with dates
├─ qa-log.md          — planning Q&A record
├─ state-machines.md  — booking / dispute / review flows (S1-6)
├─ pricing-examples.md — deterministic pricing test cases (S1-6)
└─ runbook.md         — deploy / backup / restore / cron health (Sprint 6)

Docs/                 — upstream business research (Claude, ChatGPT, Gemini)
```

## Production deployment

Sprint 6 ships the production deploy on the Ubuntu host using the upstream
Supabase self-hosting compose at
<https://github.com/supabase/supabase/tree/master/docker> + nginx + Let's Encrypt
+ nightly `pg_dump` to an S3-compatible bucket. The skeleton lives at
`docker-compose.prod.yml`; see `Claude Docs/runbook.md` for the full runbook
once Sprint 6 lands.
