#!/usr/bin/env bash
# ============================================================================
#  ft_trascendence — CI pipeline
#  Run locally with:  make ci   (uses the Nix `ci` devShell)
#  Run in GitHub Actions via .github/workflows/ci.yaml
#
#  Blocking checks (fail CI): infra linters + build + schema validation.
#  Informational checks (never fail CI): semgrep / trivy — they need network
#  or vuln DBs and shouldn't red-gate day-to-day work. Read their output.
# ============================================================================
set -uo pipefail

# --- locate repo root ---------------------------------------------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- pnpm shim (present in the Nix ci shell; fall back to corepack) -----------
if command -v pnpm >/dev/null 2>&1; then
  PNPM="pnpm"
elif command -v corepack >/dev/null 2>&1; then
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  PNPM="corepack pnpm@9.15.0"
else
  echo "FATAL: neither pnpm nor corepack found on PATH" >&2
  exit 1
fi

# --- pretty output ------------------------------------------------------------
BLUE='\033[1;34m'; GREEN='\033[1;32m'; YELLOW='\033[1;33m'; RED='\033[1;31m'; NC='\033[0m'
FAILED=0

section() { printf "\n${BLUE}=== %s ===${NC}\n" "$1"; }

# run <label> <cmd...> : blocking — records failure but keeps going so we see
# every problem in one CI run instead of stopping at the first.
run() {
  local label="$1"; shift
  section "$label"
  if "$@"; then
    printf "${GREEN}✔ %s${NC}\n" "$label"
  else
    printf "${RED}✗ %s FAILED${NC}\n" "$label"
    FAILED=1
  fi
}

# soft <label> <cmd...> : informational — prints result, never fails CI.
soft() {
  local label="$1"; shift
  section "$label (informational)"
  if command -v "$1" >/dev/null 2>&1; then
    "$@" || printf "${YELLOW}⚠ %s reported findings (not blocking)${NC}\n" "$label"
  else
    printf "${YELLOW}skip: %s not installed${NC}\n" "$1"
  fi
}

# skip a blocking tool gracefully if it isn't on PATH (e.g. running outside Nix)
have() { command -v "$1" >/dev/null 2>&1; }

# ─── 1. Infra linters ────────────────────────────────────────────────────────
if have actionlint; then run "actionlint (GitHub workflows)" actionlint; else section "actionlint"; printf "${YELLOW}skip: actionlint not on PATH${NC}\n"; fi
if have yamllint;    then run "yamllint (YAML)"              yamllint -c .yamllint .; else section "yamllint"; printf "${YELLOW}skip: yamllint not on PATH${NC}\n"; fi
if have hadolint;    then run "hadolint (Dockerfiles)"       bash -c 'hadolint --failure-threshold error apps/backend/Dockerfile apps/frontend/Dockerfile'; else section "hadolint"; printf "${YELLOW}skip: hadolint not on PATH${NC}\n"; fi

# ─── 2. Dependencies ─────────────────────────────────────────────────────────
run "pnpm install (frozen lockfile)" $PNPM install --frozen-lockfile

# ─── 3. Prisma schema ────────────────────────────────────────────────────────
# validate needs a URL to parse the datasource block; a dummy is fine here.
export DATABASE_URL="${DATABASE_URL:-postgresql://ci:ci@localhost:5432/ci?schema=public}"
run "prisma validate + generate" bash -c "$PNPM --filter @ft-trascendence/backend exec prisma validate && $PNPM --filter @ft-trascendence/backend exec prisma generate"

# ─── 4. Build (the real code gate: typecheck + compile) ──────────────────────
run "build (frontend + backend)" $PNPM -r run build

# ─── 5. Security scanners (informational) ────────────────────────────────────
soft "semgrep SAST" semgrep scan --config auto --error --quiet --exclude .pnpm-store --exclude node_modules --exclude dist .
soft "trivy filesystem" trivy fs --quiet --scanners vuln,secret,misconfig --exit-code 0 --skip-dirs .pnpm-store --skip-dirs node_modules .

# ─── verdict ─────────────────────────────────────────────────────────────────
echo
if [ "$FAILED" -eq 0 ]; then
  printf "${GREEN}CI passed ✅${NC}\n"
else
  printf "${RED}CI failed ❌ — see the blocks marked FAILED above${NC}\n"
fi
exit "$FAILED"
