#!/usr/bin/env bash
# ============================================================================
#  Smoke test of a running stack, through the public HTTPS entrypoint.
#  Usage:  make smoke      (after `make`)
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

val() { sed -n "s/^$1=//p" .env | tail -n 1; }
DOMAIN="$(val CADDY_DOMAIN)"
APP="https://$DOMAIN:$(val CADDY_HTTPS_PORT)"
HTTP="http://$DOMAIN:$(val CADDY_HTTP_PORT)"
GRAFANA="https://$DOMAIN:$(val GRAFANA_HOST_PORT)"
GF_AUTH="$(val GF_SECURITY_ADMIN_USER):$(val GF_SECURITY_ADMIN_PASSWORD)"

FAILED=0
# check <label> <expected> <actual>
check() {
  if [ "$2" = "$3" ]; then
    printf '\033[1;32m✔\033[0m %s\n' "$1"
  else
    printf '\033[1;31m✗\033[0m %s (expected %s, got %s)\n' "$1" "$2" "$3"
    FAILED=1
  fi
}
code() { curl -sk -m 10 -o /dev/null -w '%{http_code}' "$@"; }
prom() { docker compose exec -T prometheus wget -qO- "http://127.0.0.1:9090/api/v1/$1"; }

# Right after a deploy some targets have not been scraped yet (Caddy starts
# last), so give Prometheus up to a minute before calling a target down.
targets_up() {
  local targets total up
  for _ in $(seq 1 12); do
    targets="$(prom targets)"
    total="$(grep -o '"health":"[a-z]*"' <<<"$targets" | wc -l | tr -d ' ')"
    up="$(grep -o '"health":"up"' <<<"$targets" | wc -l | tr -d ' ')"
    if [ "$total" -gt 0 ] && [ "$total" = "$up" ]; then
      echo "all up"
      return
    fi
    sleep 5
  done
  echo "$up of $total up"
}

# ─── Application over HTTPS ───
check "backend health via proxy"        '"status":"ok"' "$(curl -sk -m 10 "$APP/health" | grep -o '"status":"ok"')"
check "SPA served (client-side route)"  200 "$(code "$APP/login")"
check "API reachable under /api"        401 "$(code "$APP/api/auth/me")"
check "Socket.io handshake"             200 "$(code "$APP/socket.io/?EIO=4&transport=polling")"
check "HTTP redirects to HTTPS"         "$APP/health" "$(curl -s -m 10 -o /dev/null -w '%{redirect_url}' "$HTTP/health")"
check "login with the seeded student"   201 "$(code -X POST -H 'content-type: application/json' \
  -d '{"organizationSlug":"klass","email":"student@demo","password":"demo1234"}' "$APP/api/auth/login")"

# ─── Monitoring ───
check "Grafana refuses anonymous access"      401 "$(code "$GRAFANA/api/dashboards/home")"
check "Grafana refuses the default password"  401 "$(code -u admin:admin "$GRAFANA/api/org")"
check "Grafana accepts the configured admin"  200 "$(code -u "$GF_AUTH" "$GRAFANA/api/org")"
check "dashboards are provisioned"            3 "$(curl -sk -m 10 -u "$GF_AUTH" "$GRAFANA/api/search?type=dash-db" | grep -o '"uid"' | wc -l | tr -d ' ')"
check "every Prometheus target is up"         "all up" "$(targets_up)"
check "alerting rules are loaded"             yes "$(prom rules | grep -q '"type":"alerting"' && echo yes)"

if [ "$FAILED" -eq 0 ]; then
  printf '\n\033[1;32mSmoke test passed ✅\033[0m\n'
else
  printf '\n\033[1;31mSmoke test failed ❌ — make status / make logs\033[0m\n'
fi
exit "$FAILED"
