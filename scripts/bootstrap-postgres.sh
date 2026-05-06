#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:-}"

if [[ -z "${MODE}" ]]; then
  echo "Usage: bash ./scripts/bootstrap-postgres.sh <dev|vps|verify>" >&2
  exit 1
fi

if [[ "${MODE}" != "dev" && "${MODE}" != "vps" && "${MODE}" != "verify" ]]; then
  echo "Unsupported mode: ${MODE}" >&2
  echo "Expected one of: dev, vps, verify" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_ENV_FILE="${COMPOSE_ENV_FILE:-${REPO_ROOT}/.env}"

if [[ -f "${DEFAULT_ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "${DEFAULT_ENV_FILE}"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-aikc}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-aikc}"
POSTGRES_DB="${POSTGRES_DB:-aikc}"
DUMP_FILE="/tmp/source-dump.custom"
TARGET_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"

compose_args=()
if [[ -n "${COMPOSE_ENV_FILE:-}" ]]; then
  compose_args+=(--env-file "${COMPOSE_ENV_FILE}")
fi

compose() {
  docker compose "${compose_args[@]}" "$@"
}

compose_ops() {
  docker compose "${compose_args[@]}" --profile ops "$@"
}

require_source_database_url() {
  if [[ -z "${SYNC_SOURCE_DATABASE_URL:-}" ]]; then
    echo "SYNC_SOURCE_DATABASE_URL is required for ${MODE} mode." >&2
    exit 1
  fi
}

start_postgres() {
  compose up -d postgres
}

stop_database_consumers() {
  compose stop app postgrest caddy migrate >/dev/null 2>&1 || true
}

recreate_target_database() {
  compose exec -T postgres sh -ec "
    export PGPASSWORD='${POSTGRES_PASSWORD}'
    dropdb --if-exists --force --username '${POSTGRES_USER}' '${POSTGRES_DB}'
    createdb --username '${POSTGRES_USER}' '${POSTGRES_DB}'
  "
}

run_pg_dump_restore() {
  compose_ops run --rm --no-deps \
    -e SYNC_SOURCE_DATABASE_URL="${SYNC_SOURCE_DATABASE_URL}" \
    -e TARGET_DATABASE_URL="${TARGET_DATABASE_URL}" \
    -e DUMP_FILE="${DUMP_FILE}" \
    pg-tools "
      echo '--- pg_dump: exporting from source ---'
      pg_dump -Fc -v --no-owner --no-acl \
        --extension=citext --extension=pg_trgm \
        -d \"\${SYNC_SOURCE_DATABASE_URL}\" \
        -f \"\${DUMP_FILE}\"

      echo '--- pg_restore: importing into target ---'
      pg_restore -v --no-owner --no-acl \
        --single-transaction \
        -d \"\${TARGET_DATABASE_URL}\" \
        \"\${DUMP_FILE}\"

      rm -f \"\${DUMP_FILE}\"
    "
}

verify_row_counts() {
  echo "--- Verifying row counts ---"
  compose_ops run --rm --no-deps \
    -e SYNC_SOURCE_DATABASE_URL="${SYNC_SOURCE_DATABASE_URL}" \
    -e TARGET_DATABASE_URL="${TARGET_DATABASE_URL}" \
    pg-tools '
      echo "Source table counts:"
      psql -d "${SYNC_SOURCE_DATABASE_URL}" -t -A -c "
        SELECT schemaname || '\''.'\'' || relname || '\'': '\'' || n_live_tup
        FROM pg_stat_user_tables
        ORDER BY schemaname, relname;
      "

      echo ""
      echo "Target table counts:"
      psql -d "${TARGET_DATABASE_URL}" -t -A -c "
        SELECT schemaname || '\''.'\'' || relname || '\'': '\'' || n_live_tup
        FROM pg_stat_user_tables
        ORDER BY schemaname, relname;
      "
    '
}

apply_postgrest_grants() {
  compose exec -T postgres sh /opt/postgres/scripts/apply-postgrest-grants.sh
}

redact_developer_data() {
  compose exec -T postgres sh -ec "
    export PGPASSWORD='${POSTGRES_PASSWORD}'
    psql -v ON_ERROR_STOP=1 --username '${POSTGRES_USER}' --dbname '${POSTGRES_DB}' \
      -f /opt/postgres/scripts/redact-dev-data.sql
  "
}

run_prisma_sync() {
  compose run --rm --no-deps migrate sh -ec "bunx prisma db push --skip-generate"
}

rebuild_local_search() {
  compose up -d qdrant infinity
  compose run --rm --no-deps migrate sh -ec "bun run qdrant:reset"
}

start_stack() {
  compose up -d app postgrest caddy
}

verify_sync() {
  require_source_database_url
  start_postgres
  verify_row_counts
}

bootstrap_database() {
  require_source_database_url
  start_postgres
  stop_database_consumers
  recreate_target_database
  run_pg_dump_restore
  verify_row_counts
  apply_postgrest_grants

  if [[ "${MODE}" == "dev" ]]; then
    redact_developer_data
  fi

  run_prisma_sync
  rebuild_local_search
  start_stack
}

case "${MODE}" in
  verify)
    verify_sync
    ;;
  dev | vps)
    bootstrap_database
    ;;
esac

echo "PostgreSQL bootstrap workflow finished for mode: ${MODE}"
