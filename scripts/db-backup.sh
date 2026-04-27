#!/usr/bin/env bash
# Sevent · Postgres backup
#
# Dumps the local self-hosted Supabase Postgres into ./backups/ as gzipped SQL
# and prunes files older than $RETAIN_DAYS (default 14).
#
# Two execution modes, auto-selected:
#   1. Docker mode   — when the supabase_db container is running, we run
#                      pg_dump INSIDE the container. No host-side pg_dump
#                      required. Works the same on Windows dev and Ubuntu prod.
#   2. Native mode   — fallback to host-installed pg_dump (Ubuntu prod with
#                      bare-metal Postgres, or anywhere the docker socket
#                      isn't reachable).
#
# Configuration via environment variables (with defaults):
#   BACKUP_DIR    ./backups
#   RETAIN_DAYS   14
#   PROJECT_ID    auto-detected from supabase/config.toml
#   PG_DB         postgres
#   PG_USER       postgres
#   PG_HOST       127.0.0.1                (native mode only)
#   PG_PORT       54322                    (native mode only)
#   PGPASSWORD    postgres                 (native mode only)
#
# Cron example (Ubuntu, daily 03:00):
#   0 3 * * * cd /srv/sevent && bash scripts/db-backup.sh >> backups/backup.log 2>&1
#
# Manual run (any platform):
#   bash scripts/db-backup.sh
#   pnpm db:backup        # via package.json wrapper

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"

PG_DB="${PG_DB:-postgres}"
PG_USER="${PG_USER:-postgres}"
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-54322}"
PGPASSWORD="${PGPASSWORD:-postgres}"

# ---- Resolve project_id from supabase/config.toml ---------------------------
PROJECT_ID="${PROJECT_ID:-}"
if [ -z "$PROJECT_ID" ] && [ -f "$PROJECT_ROOT/supabase/config.toml" ]; then
  PROJECT_ID="$(grep -E '^project_id[[:space:]]*=' "$PROJECT_ROOT/supabase/config.toml" \
    | head -n1 | sed -E 's/.*=[[:space:]]*"([^"]+)".*/\1/')"
fi
PROJECT_ID="${PROJECT_ID:-sevent}"
DB_CONTAINER="supabase_db_${PROJECT_ID}"

# ---- Pick mode ---------------------------------------------------------------
USE_DOCKER=0
if command -v docker >/dev/null 2>&1 \
   && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$DB_CONTAINER"; then
  USE_DOCKER=1
fi

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
target="$BACKUP_DIR/sevent-$stamp.sql.gz"

if [ "$USE_DOCKER" = "1" ]; then
  echo "[$(date -Iseconds)] mode=docker container=$DB_CONTAINER → $target"
  # pg_dump runs inside the container; stdout is plain SQL; gzip on the host.
  docker exec -i "$DB_CONTAINER" \
    pg_dump \
      --username="$PG_USER" \
      --dbname="$PG_DB" \
      --format=plain \
      --no-owner \
      --no-privileges \
    | gzip -9 > "$target"
else
  if ! command -v pg_dump >/dev/null 2>&1; then
    echo "[$(date -Iseconds)] ERROR: pg_dump not found and supabase docker container not running" >&2
    echo "  Install postgresql-client (Ubuntu: 'sudo apt-get install -y postgresql-client')" >&2
    echo "  OR start the supabase stack ('npx supabase start')" >&2
    exit 1
  fi
  echo "[$(date -Iseconds)] mode=native host=$PG_HOST:$PG_PORT → $target"
  export PGPASSWORD
  pg_dump \
    --host="$PG_HOST" \
    --port="$PG_PORT" \
    --username="$PG_USER" \
    --dbname="$PG_DB" \
    --format=plain \
    --no-owner \
    --no-privileges \
    | gzip -9 > "$target"
fi

# Verify the dump is non-trivial — gzip-only an empty stream is ~20 bytes.
bytes="$(wc -c < "$target")"
if [ "$bytes" -lt 1024 ]; then
  echo "[$(date -Iseconds)] ERROR: backup is suspiciously small ($bytes bytes) — removing" >&2
  rm -f "$target"
  exit 1
fi
echo "[$(date -Iseconds)] wrote $bytes bytes"

# ---- Prune old dumps ---------------------------------------------------------
find "$BACKUP_DIR" -name 'sevent-*.sql.gz' -type f -mtime +"$RETAIN_DAYS" -print -delete \
  2>/dev/null || true

echo "[$(date -Iseconds)] done"
