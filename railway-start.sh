#!/bin/sh
# Railway start script for Kept: database logins, migrations, then the server.
# Every failure exits non-zero, so Railway's ON_FAILURE restart policy brings it back.
set -eu

log() { echo "railway-start: $*"; }
fail() { log "ERROR: $*"; exit 1; }

# Port: Railway's PORT wins, Kept reads KEPT_PORT.
export KEPT_PORT="${PORT:-${KEPT_PORT:-8080}}"

# Kept's own default for the data dir is /data (a Docker volume upstream). Here the files live
# in the Railway Bucket (KEPT_STORAGE=s3), so /data only holds scratch space and restic's cache.
export KEPT_DATA_DIR="${KEPT_DATA_DIR:-/data}"
export KEPT_CONFIG_DIR="${KEPT_CONFIG_DIR:-/data/config}"
mkdir -p "$KEPT_DATA_DIR" "$KEPT_CONFIG_DIR" 2>/dev/null || true

: "${KEPT_DB_HOST:?KEPT_DB_HOST is unset (the Postgres service private domain)}"
: "${KEPT_DB_SUPERUSER_PASSWORD:?KEPT_DB_SUPERUSER_PASSWORD is unset}"
for v in KEPT_DB_OWNER_PASSWORD KEPT_DB_APP_PASSWORD KEPT_DB_AUTH_PASSWORD KEPT_DB_SYSTEM_PASSWORD \
         KEPT_SECRET_KEY KEPT_AUTH_SECRET KEPT_PUBLIC_URL; do
  eval "val=\${$v:-}"
  [ -n "$val" ] || fail "$v is unset"
done
case "$KEPT_PUBLIC_URL" in
  https://|http://) fail "KEPT_PUBLIC_URL has no host: give the Kept service a public domain" ;;
esac

DB_PORT="${KEPT_DB_PORT:-5432}"
DB_NAME="${KEPT_DB_NAME:-kept}"
DB_SUPERUSER="${KEPT_DB_SUPERUSER:-postgres}"
url() { echo "postgres://$1:$2@${KEPT_DB_HOST}:${DB_PORT}/${DB_NAME}"; }
export KEPT_DATABASE_URL="${KEPT_DATABASE_URL:-$(url kept_app "$KEPT_DB_APP_PASSWORD")}"
export KEPT_AUTH_DATABASE_URL="${KEPT_AUTH_DATABASE_URL:-$(url kept_auth "$KEPT_DB_AUTH_PASSWORD")}"
export KEPT_SYSTEM_DATABASE_URL="${KEPT_SYSTEM_DATABASE_URL:-$(url kept_system "$KEPT_DB_SYSTEM_PASSWORD")}"
export KEPT_OWNER_DATABASE_URL="${KEPT_OWNER_DATABASE_URL:-$(url kept_owner "$KEPT_DB_OWNER_PASSWORD")}"

# 1. Database logins and extensions (upstream's `kept bootstrap`, as Compose runs it on every
#    start). Idempotent; it also re-applies the four passwords, so they can be rotated here.
#    Waits up to 5 minutes for Postgres: its private DNS name can take a minute on first deploy.
tries=0
until PGHOST="$KEPT_DB_HOST" PGPORT="$DB_PORT" PGUSER="$DB_SUPERUSER" \
      PGPASSWORD="$KEPT_DB_SUPERUSER_PASSWORD" PGDATABASE="$DB_NAME" kept bootstrap; do
  tries=$((tries + 1))
  [ "$tries" -lt 60 ] || fail "Postgres at ${KEPT_DB_HOST}:${DB_PORT} did not accept the bootstrap after 5 minutes"
  log "Postgres not ready yet (try $tries/60), retrying in 5 s"
  sleep 5
done

# The superuser password is needed only for the bootstrap: keep it out of the server.
unset KEPT_DB_SUPERUSER_PASSWORD PGPASSWORD 2>/dev/null || true

# 2. Migrations (upstream's `kept migrate`; it takes its own advisory lock, so overlapping
#    deploys wait for each other instead of migrating twice).
tries=0
until kept migrate; do
  tries=$((tries + 1))
  [ "$tries" -lt 5 ] || fail "kept migrate failed 5 times"
  log "kept migrate failed (try $tries/5), retrying in 10 s"
  sleep 10
done

# 3. The server (upstream's ENTRYPOINT). exec: its exit code is the container's.
log "starting Kept on port ${KEPT_PORT}"
exec node --import /app/apps/server/dist/observability/tracing.js /app/apps/server/dist/main.js
