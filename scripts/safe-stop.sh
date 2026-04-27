#!/usr/bin/env bash
# Sevent · pre-supabase-stop hook
#
# Wraps `supabase stop` so we always take a backup first AND we refuse the
# destructive `--no-backup` flag. This exists because once data was lost when
# `supabase stop --no-backup` was run by mistake — that flag passes
# `--volumes` to `docker compose down`, which deletes the DB volume.
#
# Always use this instead of `supabase stop` directly:
#   pnpm supabase:stop      # via package.json wrapper
#   bash scripts/safe-stop.sh
#
# Pass-through args allowed (anything except `--no-backup`):
#   bash scripts/safe-stop.sh --debug

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Refuse the dangerous flag.
for arg in "$@"; do
  if [ "$arg" = "--no-backup" ]; then
    cat >&2 <<'EOF'
[safe-stop] REFUSED: --no-backup deletes the database volume.
[safe-stop] If you genuinely want to wipe local data, run:
  npx supabase stop --no-backup
[safe-stop] (and accept that all rows will be lost on next 'supabase start').
EOF
    exit 2
  fi
done

# 1. Take a backup first. If the DB container isn't running, db-backup.sh
#    will report that and exit non-zero; we still let the stop proceed in
#    that case (nothing to back up anyway).
echo "[safe-stop] Step 1/2 — pre-stop backup"
if bash "$PROJECT_ROOT/scripts/db-backup.sh"; then
  echo "[safe-stop] backup OK"
else
  status=$?
  # Distinguish "no DB to back up" from real failure.
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^supabase_db_'; then
    echo "[safe-stop] no supabase_db container running — nothing to back up, continuing"
  else
    echo "[safe-stop] ABORT: backup failed (exit $status). Refusing to stop." >&2
    echo "[safe-stop] Fix the backup error first, or pass FORCE_STOP=1 to override." >&2
    if [ "${FORCE_STOP:-0}" != "1" ]; then
      exit "$status"
    fi
    echo "[safe-stop] FORCE_STOP=1 — proceeding despite backup failure"
  fi
fi

# 2. Stop the stack. NEVER pass --no-backup. Forward any other args.
echo "[safe-stop] Step 2/2 — supabase stop"
exec npx supabase stop "$@"
