#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker_local() {
  env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"
}
container="ons-huis-sql-test-$$"
logfile="$(mktemp /tmp/ons-huis-sql-test.XXXXXX)"
cleanup() { docker_local rm --force "$container" >/dev/null 2>&1 || true; rm -f "$logfile"; }
trap cleanup EXIT
# Disposable fixture password, never a production credential.
docker_local run --name "$container" -e POSTGRES_PASSWORD=local-test-only --detach postgres:17-alpine >/dev/null
ready=false
for attempt in {1..30}; do
  if docker_local exec "$container" pg_isready -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then echo 'Temporary PostgreSQL did not become ready.' >&2; exit 1; fi
apply() { docker_local exec -i "$container" psql -q -U postgres -v ON_ERROR_STOP=1; }
apply < tests/database/bootstrap.sql > "$logfile" 2>&1 || { cat "$logfile"; exit 1; }
for migration in supabase/migrations/*.sql; do
  apply < "$migration" >> "$logfile" 2>&1 || { cat "$logfile"; exit 1; }
done
apply < tests/database/integration.sql > "$logfile" 2>&1 || { cat "$logfile"; exit 1; }
tail -n 7 "$logfile"
