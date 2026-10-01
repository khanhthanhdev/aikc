#!/usr/bin/env bash
set -Eeuo pipefail

# PostgreSQL backup for the aikc stack.
#
# Runs pg_dump *inside* the postgres container, so the host needs no
# postgresql-client and there is no client/server version mismatch to worry
# about when the image is upgraded.
#
# Usage:   ./backup-postgres.sh
# Cron:    30 2 * * *  /root/stukit/scripts/backup-postgres.sh >> /var/log/aikc-backup.log 2>&1
#
# Optional environment:
#   STACK_DIR            directory holding docker-compose.yml (default: repo root)
#   BACKUP_DIR           where dumps are written (default: $STACK_DIR/backups/postgres)
#   DAILY_RETENTION      days of daily dumps to keep      (default: 14)
#   MONTHLY_RETENTION    months of 1st-of-month dumps     (default: 12)
#   MIN_FREE_MB          abort if less free disk than this (default: 1024)
#   BACKUP_UPLOAD_CMD    off-site hook, receives the .gz path as $1
#   POSTGRES_USER/_DB    override the user/database (default: read from the container)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_DIR="${STACK_DIR:-$(dirname "$SCRIPT_DIR")}"
BACKUP_DIR="${BACKUP_DIR:-${STACK_DIR}/backups/postgres}"
MONTHLY_DIR="${BACKUP_DIR}/monthly"
# Globals live in their own directory so the daily glob below cannot match them.
GLOBALS_DIR="${BACKUP_DIR}/globals"
DAILY_RETENTION="${DAILY_RETENTION:-14}"
MONTHLY_RETENTION="${MONTHLY_RETENTION:-12}"
MIN_FREE_MB="${MIN_FREE_MB:-1024}"

SERVICE="${POSTGRES_SERVICE:-postgres}"

STAMP="$(date +%Y%m%d_%H%M%S)"
DUMP="${BACKUP_DIR}/aikc_${STAMP}.sql.gz"
GLOBALS="${GLOBALS_DIR}/globals_${STAMP}.sql.gz"

log() { printf '[%s] %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# Never let two runs overlap; a slow dump must not be rotated out from under us.
# mkdir is atomic everywhere, unlike flock which util-linux does not always ship.
LOCK_DIR="${TMPDIR:-/tmp}/aikc-backup.lock"
STALE_LOCK_HOURS="${STALE_LOCK_HOURS:-6}"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  # A run killed outright (OOM, reboot) never reaches its cleanup trap and
  # leaves the lock behind. Left alone that silently blocks every future
  # backup, which is the worst way for this to fail, so treat a lock older
  # than STALE_LOCK_HOURS as abandoned rather than active.
  if [ -n "$(find "$LOCK_DIR" -maxdepth 0 -mmin "+$((STALE_LOCK_HOURS * 60))" 2>/dev/null)" ]; then
    log "WARNING: removing stale lock older than ${STALE_LOCK_HOURS}h ($LOCK_DIR)"
    rmdir "$LOCK_DIR" 2>/dev/null || true
    mkdir "$LOCK_DIR" 2>/dev/null || die "could not claim lock after clearing stale one"
  else
    die "another backup run holds the lock ($LOCK_DIR)"
  fi
fi

PARTIALS=""
cleanup() { rm -f $PARTIALS; rmdir "$LOCK_DIR" 2>/dev/null || true; }
trap cleanup EXIT

command -v docker >/dev/null || die "docker not found"
mkdir -p "$BACKUP_DIR" "$MONTHLY_DIR" "$GLOBALS_DIR"

free_mb=$(df -Pm "$BACKUP_DIR" | awk 'NR==2 {print $4}')
[ "$free_mb" -ge "$MIN_FREE_MB" ] || die "only ${free_mb}MB free, need ${MIN_FREE_MB}MB"

compose() { docker compose --project-directory "$STACK_DIR" "$@"; }

# `ps -q` plus `docker inspect` rather than `ps --status running --format`,
# because the latter's flags vary across Compose v2 point releases.
cid="$(compose ps -q "$SERVICE" 2>/dev/null || true)"
[ -n "$cid" ] || die "service '$SERVICE' has no container in $STACK_DIR"
[ "$(docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null)" = "true" ] \
  || die "service '$SERVICE' is not running"

# Ask the container which user and database it was created with. Cron runs
# with an empty environment and never sees the stack's .env, so reading
# POSTGRES_USER here would fall back to a default that may not exist.
# An explicit POSTGRES_USER / POSTGRES_DB still wins, for one-off runs.
container_env() { compose exec -T "$SERVICE" printenv "$1" 2>/dev/null | tr -d '\r' || true; }
PGUSER_NAME="${POSTGRES_USER:-$(container_env POSTGRES_USER)}"
PGUSER_NAME="${PGUSER_NAME:-postgres}"
PGDB_NAME="${POSTGRES_DB:-$(container_env POSTGRES_DB)}"
PGDB_NAME="${PGDB_NAME:-$PGUSER_NAME}"

log "Dumping ${PGDB_NAME} as ${PGUSER_NAME} from container service '${SERVICE}'"

# Dump to a temporary name first. A half-written file must never be mistaken
# for a good backup, and rotation below only runs once this one is verified.
tmp="${DUMP}.partial"
PARTIALS="$tmp ${GLOBALS}.partial"

compose exec -T "$SERVICE" \
  pg_dump -U "$PGUSER_NAME" -d "$PGDB_NAME" --format=plain --no-owner --no-acl \
  | gzip -9 > "$tmp"

# Verify before trusting it: the archive must decompress, and a complete plain
# dump always ends with pg_dump's own completion marker. Checking only that the
# file is non-empty would happily accept a dump truncated by a full disk.
gzip -t "$tmp" 2>/dev/null || die "dump is not a valid gzip archive"
gzip -dc "$tmp" | tail -5 | grep -q 'PostgreSQL database dump complete' \
  || die "dump is truncated: completion marker missing"

mv "$tmp" "$DUMP"
log "Dump OK: $(du -h "$DUMP" | cut -f1) -> $DUMP"

# Roles and their passwords live outside the database. Without them a restore
# onto a fresh server comes up with no logins.
compose exec -T "$SERVICE" pg_dumpall -U "$PGUSER_NAME" --globals-only \
  | gzip -9 > "${GLOBALS}.partial"
gzip -t "${GLOBALS}.partial" 2>/dev/null || die "globals dump is not valid gzip"
mv "${GLOBALS}.partial" "$GLOBALS"
log "Globals OK: $(du -h "$GLOBALS" | cut -f1)"

PARTIALS=""

# Umami analytics keeps its own database on the same server. Losing it would
# not break the site, so a failure here warns instead of failing the run.
UMAMI_DIR="${BACKUP_DIR}/umami"
if compose exec -T "$SERVICE" psql -U "$PGUSER_NAME" -d "$PGDB_NAME" -tAc   "SELECT 1 FROM pg_database WHERE datname = 'umami'" 2>/dev/null | grep -q 1; then
  mkdir -p "$UMAMI_DIR"
  UMAMI_DUMP="${UMAMI_DIR}/umami_${STAMP}.sql.gz"
  PARTIALS="${UMAMI_DUMP}.partial"

  if compose exec -T "$SERVICE"     pg_dump -U "$PGUSER_NAME" -d umami --format=plain --no-owner --no-acl     | gzip -9 > "${UMAMI_DUMP}.partial"     && gzip -dc "${UMAMI_DUMP}.partial" | tail -5     | grep -q 'PostgreSQL database dump complete'; then
    mv "${UMAMI_DUMP}.partial" "$UMAMI_DUMP"
    log "Umami dump OK: $(du -h "$UMAMI_DUMP" | cut -f1)"

    if [ "$(date +%d)" = "01" ]; then
      cp -p "$UMAMI_DUMP" "${MONTHLY_DIR}/"
    fi
  else
    log "WARNING: umami dump failed; analytics are not in this backup"
  fi

  PARTIALS=""
fi

# Keep the 1st-of-month dump on a longer clock than the dailies.
if [ "$(date +%d)" = "01" ]; then
  cp -p "$DUMP" "${MONTHLY_DIR}/"
  log "Kept monthly copy"
fi

if [ -n "${BACKUP_UPLOAD_CMD:-}" ]; then
  if "$BACKUP_UPLOAD_CMD" "$DUMP"; then
    log "Off-site upload: OK"
  else
    log "WARNING: off-site upload failed; local copy retained"
  fi
else
  log "WARNING: no BACKUP_UPLOAD_CMD set - backups exist only on this server"
fi

find "$BACKUP_DIR" -maxdepth 1 -name 'aikc_*.sql.gz' -type f -mtime "+${DAILY_RETENTION}" -delete
find "$MONTHLY_DIR" -maxdepth 1 -name 'aikc_*.sql.gz' -type f -mtime "+$((MONTHLY_RETENTION * 31))" -delete
find "$GLOBALS_DIR" -maxdepth 1 -name 'globals_*.sql.gz' -type f -mtime "+${DAILY_RETENTION}" -delete
if [ -d "$UMAMI_DIR" ]; then
  find "$UMAMI_DIR" -maxdepth 1 -name 'umami_*.sql.gz' -type f -mtime "+${DAILY_RETENTION}" -delete
fi
find "$MONTHLY_DIR" -maxdepth 1 -name 'umami_*.sql.gz' -type f -mtime "+$((MONTHLY_RETENTION * 31))" -delete

log "Finished. $(find "$BACKUP_DIR" -maxdepth 1 -name 'aikc_*.sql.gz' | wc -l) daily, $(find "$MONTHLY_DIR" -maxdepth 1 -name 'aikc_*.sql.gz' | wc -l) monthly on disk"
