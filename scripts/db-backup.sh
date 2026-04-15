#!/usr/bin/env bash
# Sevent nightly Postgres backup.
# Dumps the local/prod Supabase Postgres into ./backups/ as gzipped SQL and
# prunes files older than $RETAIN_DAYS (default 14).
#
# Intended to run under cron:
#   0 3 * * * cd /srv/sevent && bash scripts/db-backup.sh >> backups/backup.log 2>&1

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-54322}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
export PGPASSWORD

mkdir -p "$BACKUP_DIR"

stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
target="$BACKUP_DIR/sevent-$stamp.sql.gz"

echo "[$(date -Iseconds)] pg_dump → $target"
pg_dump \
  --host="$PG_HOST" \
  --port="$PG_PORT" \
  --username="$PG_USER" \
  --dbname="$PG_DB" \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip -9 > "$target"

bytes="$(stat -c '%s' "$target" 2>/dev/null || stat -f '%z' "$target")"
echo "[$(date -Iseconds)] wrote $bytes bytes"

# Prune old dumps.
find "$BACKUP_DIR" -name 'sevent-*.sql.gz' -type f -mtime +"$RETAIN_DAYS" -print -delete
