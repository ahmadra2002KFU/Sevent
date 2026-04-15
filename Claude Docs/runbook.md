# Sevent — Runbook (early version)

Operational procedures for the Ubuntu pilot host. Sprint 1 ships the local-dev
section + backup/restore drill; deploy/harden sections fill in during Sprint 6.

## 1. Starting / stopping local Supabase

```bash
pnpm db:start   # boots Supabase containers, prints keys
pnpm db:stop    # stops all containers but preserves data
pnpm db:reset   # drops the local DB and re-applies migrations + seed.sql
```

Default ports:

| Service   | URL                                |
| --------- | ---------------------------------- |
| API (Kong)| <http://localhost:54321>           |
| Postgres  | `localhost:54322`, user `postgres` |
| Studio    | <http://localhost:54323>           |
| Inbucket  | <http://localhost:54324>           |

After the first `pnpm db:start` run, copy the printed `anon key` and
`service_role key` into `.env.local`.

## 2. Creating a new migration

```bash
pnpm db:new add_something
# edits supabase/migrations/<timestamp>_add_something.sql
pnpm db:reset      # rebuild local DB with the new migration applied
```

or auto-generate a diff from schema changes made in Studio:

```bash
pnpm db:diff add_something
```

## 3. Nightly backups (local dev pilot)

A single cron script dumps the local Postgres into `backups/` each night and
rotates files older than 14 days. The file `backups/` is git-ignored.

### One-time setup

```bash
mkdir -p backups
chmod +x scripts/db-backup.sh
# Add to crontab (runs at 03:00 every day):
# 0 3 * * * cd /srv/sevent && bash scripts/db-backup.sh >> backups/backup.log 2>&1
```

### What the script does

- Calls `pg_dump` against the local Supabase Postgres container (port 54322).
- Writes `backups/sevent-YYYY-MM-DD.sql.gz` with gzip compression.
- Deletes dumps older than 14 days.
- Non-zero exit if `pg_dump` fails (cron mail will surface the failure).

### Restore drill (prove it works before Sprint 6)

```bash
# Pick any nightly dump:
gunzip -c backups/sevent-2026-04-30.sql.gz > /tmp/sevent-restore.sql

# In a separate scratch container:
docker run --rm --name sevent-restore -e POSTGRES_PASSWORD=postgres \
  -p 54399:5432 -d supabase/postgres:15.6.1.146

psql -h localhost -p 54399 -U postgres -d postgres -f /tmp/sevent-restore.sql

# Sanity check row counts:
psql -h localhost -p 54399 -U postgres -d postgres -c \
  "select
     (select count(*) from public.suppliers)     as suppliers,
     (select count(*) from public.categories)    as categories,
     (select count(*) from public.profiles)      as profiles;"

docker stop sevent-restore
```

Row counts should match the source DB. Drill at least once at the end of
Sprint 1 (task S1-7 AC) and again in Sprint 6 before pilot launch.

## 4. Production deploy (draft — filled in Sprint 6)

Planned topology on the Ubuntu host:

```
  internet
     │
     ▼
  nginx + Let's Encrypt
     │
     ├──► sevent-web  (Next.js container)
     │
     └──► supabase stack (Kong, GoTrue, PostgREST, Storage, Postgres)
                                             │
                                             └──► /var/lib/sevent/postgres
                                             └──► /var/lib/sevent/storage
```

- `docker-compose.prod.yml` is a placeholder in Sprint 1; Sprint 6 adapts the
  upstream Supabase self-hosting compose.
- Nightly `pg_dump` + storage bucket backup to an S3-compatible target
  (Cloudflare R2 is the planned default).
- Secrets loaded via systemd-managed env files; never committed.
- Health check: systemd timer pings `/api/healthz` on the Next.js container.

## 5. pg_cron jobs (added Sprint 5)

| Job                        | Schedule   | Purpose |
| -------------------------- | ---------- | ------- |
| `expire_soft_holds`        | */5 min    | Release soft-holds past `expires_at`; cancel stale bookings |
| `publish_reviews`          | hourly     | Publish reviews when both submitted or window closes |
| `close_dispute_windows`    | hourly     | Mark disputes older than 30d as `closed` if not resolved |

## 6. Emergency procedures

- **DB wedged / corrupt**: stop containers, `gunzip` latest dump, restore into a
  fresh Postgres volume, bring the stack back up. Entire process should be
  under 15 minutes with the above commands.
- **Mass supplier data issue**: use Studio (<http://localhost:54323>) under the
  service-role key; RLS does not apply to service role.
- **Auth user compromise**: `update auth.users set banned_until = 'infinity'
  where id = '…'` as service role. All existing sessions stay until token
  refresh (default 1h).
