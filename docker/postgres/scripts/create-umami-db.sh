#!/bin/sh
# Creates the role and database Umami (web analytics) runs on, inside the
# shared postgres. Safe to run again: it only creates what is missing, and
# re-applies the password so changing UMAMI_DB_PASSWORD takes effect.
#
# Runs from the one-shot `umami-db` compose service, connecting as the main
# superuser through the PG* environment variables.
set -eu

: "${UMAMI_DB_PASSWORD:?UMAMI_DB_PASSWORD must be set}"

psql -v ON_ERROR_STOP=1 -v pw="$UMAMI_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE umami LOGIN PASSWORD %L', :'pw')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'umami')
\gexec

SELECT format('ALTER ROLE umami WITH LOGIN PASSWORD %L', :'pw')
\gexec

SELECT 'CREATE DATABASE umami OWNER umami'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'umami')
\gexec

-- Only Umami (and superusers) may connect; PostgREST's roles have no business here
REVOKE ALL ON DATABASE umami FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE umami TO umami;
SQL

echo "umami database ready"
