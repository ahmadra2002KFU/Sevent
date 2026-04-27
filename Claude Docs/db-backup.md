# Sevent DB backups

We back up the local self-hosted Supabase Postgres because we lost data once
when `supabase stop --no-backup` was run by mistake (that flag passes
`--volumes` to `docker compose down`, which deletes the DB volume). The fix
is two scripts and a habit:

- `scripts/db-backup.sh` — gzipped `pg_dump` to `./backups/sevent-<UTC>.sql.gz`
- `scripts/safe-stop.sh` — pre-stop wrapper that backs up first and refuses `--no-backup`

## Usage

| Command | What it does |
|---|---|
| `pnpm db:backup` | One-shot backup. Auto-uses `docker exec` if the container is running, else falls back to host `pg_dump`. |
| `pnpm db:stop` | Backup → then `supabase stop`. Use this instead of `npx supabase stop`. |
| `pnpm db:stop:unsafe` | Bare `supabase stop`. Avoid unless you know what you're doing. |

Backups land in `./backups/`, gzipped, named with UTC timestamp. `.gitignore` already excludes the folder.

## Restoring a backup

```bash
gunzip -c backups/sevent-2026-04-27T03-00-00Z.sql.gz \
  | docker exec -i supabase_db_sevent psql -U postgres -d postgres
```

For a clean restore: `pnpm db:reset` (wipes + re-applies migrations + seed) THEN pipe the backup. Or restore over the existing DB to get the rows back.

## Ubuntu deployment

### Install prerequisite

```bash
sudo apt-get update
sudo apt-get install -y postgresql-client gzip
```

(Only needed if Docker isn't running on the box; in docker mode `pg_dump` runs inside the container and the host doesn't need it.)

### Cron — daily 03:00 UTC

```bash
crontab -e
```

Add:

```cron
# Sevent DB backup, daily at 03:00 server time. Logs to backups/backup.log.
0 3 * * * cd /srv/sevent && /usr/bin/bash scripts/db-backup.sh >> backups/backup.log 2>&1
```

Replace `/srv/sevent` with the actual deploy path. The script:

- Auto-detects `supabase_db_sevent` container; falls back to host `pg_dump`.
- Refuses to write a backup smaller than 1KB (catches silent failures).
- Prunes files older than `RETAIN_DAYS` (default 14).

### Off-site copy (recommended)

The cron above writes to local disk only. For a real deploy, copy the file off-box right after each backup. Two simple options:

**rclone to S3 / object storage** (in the same cron line, after the dump):

```cron
0 3 * * * cd /srv/sevent && /usr/bin/bash scripts/db-backup.sh && rclone copy backups/ remote:sevent-backups/ --include 'sevent-*.sql.gz' >> backups/backup.log 2>&1
```

**rsync to another host**:

```cron
0 3 * * * cd /srv/sevent && /usr/bin/bash scripts/db-backup.sh && rsync -az backups/ backup-host:/srv/sevent-backups/ >> backups/backup.log 2>&1
```

### Environment overrides

All optional. Defaults in parens.

| Var | Default | Notes |
|---|---|---|
| `BACKUP_DIR` | `./backups` | Where dumps go |
| `RETAIN_DAYS` | `14` | Files older than this are deleted |
| `PROJECT_ID` | from `supabase/config.toml` | Drives the container name `supabase_db_<id>` |
| `PG_HOST` | `127.0.0.1` | Native mode only |
| `PG_PORT` | `54322` | Native mode only |
| `PG_USER` | `postgres` | |
| `PG_DB` | `postgres` | |
| `PGPASSWORD` | `postgres` | Native mode only — for prod, set via env or a `.pgpass` file |

### Health check

The script exits non-zero on:
- Neither docker container nor host `pg_dump` available
- Dump file < 1024 bytes (silent failure)
- `pg_dump` itself failing

Pair with cron's MAILTO or pipe to your alerting (Sentry, Slack, etc.):

```cron
MAILTO="ops@sevent.example"
0 3 * * * cd /srv/sevent && /usr/bin/bash scripts/db-backup.sh
```

## Why we don't use `supabase db dump`

Supabase CLI has a `db dump` subcommand, but it talks to the *linked remote project* (cloud Supabase). We're local-only by design (see `Claude Docs/MEMORY.md` / dual-stack notes). Plain `pg_dump` against the local stack is what we want.
