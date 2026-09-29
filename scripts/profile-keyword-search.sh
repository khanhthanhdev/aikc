#!/bin/sh
set -eu

QUERY=${1:-productivity}
LIMIT=${2:-14}

case "$LIMIT" in
  ''|*[!0-9]*)
    echo "limit must be a positive integer" >&2
    exit 1
    ;;
esac

if [ "$LIMIT" -lt 1 ] || [ "$LIMIT" -gt 48 ]; then
  echo "limit must be between 1 and 48" >&2
  exit 1
fi

docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-aikc}" \
  -d "${POSTGRES_DB:-aikc}" \
  -v ON_ERROR_STOP=1 \
  -v query="$QUERY" \
  -v result_limit="$LIMIT" <<'SQL'
\timing on

SELECT
  count(*) AS tool_count,
  pg_size_pretty(pg_total_relation_size('"Tool"')) AS tool_total_size;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'Tool'
ORDER BY indexname;

\echo 'Result query plan'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT
  id, name, "nameVi", slug, tagline, "taglineVi", description,
  "descriptionVi", "faviconUrl", pricing, "pricingVi", "pricingTier",
  "isFeatured"
FROM "Tool"
WHERE "publishedAt" <= now()
  AND (
    name ILIKE '%' || :'query' || '%'
    OR "nameVi" ILIKE '%' || :'query' || '%'
    OR tagline ILIKE '%' || :'query' || '%'
    OR "taglineVi" ILIKE '%' || :'query' || '%'
    OR description ILIKE '%' || :'query' || '%'
    OR "descriptionVi" ILIKE '%' || :'query' || '%'
  )
ORDER BY "publishedAt" DESC
LIMIT :result_limit;

\echo 'Count query plan'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT count(*)
FROM "Tool"
WHERE "publishedAt" <= now()
  AND (
    name ILIKE '%' || :'query' || '%'
    OR "nameVi" ILIKE '%' || :'query' || '%'
    OR tagline ILIKE '%' || :'query' || '%'
    OR "taglineVi" ILIKE '%' || :'query' || '%'
    OR description ILIKE '%' || :'query' || '%'
    OR "descriptionVi" ILIKE '%' || :'query' || '%'
  );
SQL
