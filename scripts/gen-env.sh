#!/usr/bin/env bash
# ============================================================================
#  Create .env from .env.example, replacing placeholder secrets with random
#  values. Never touches an existing .env.   Usage:  make env
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  echo ".env already exists — left untouched."
  exit 0
fi

# hex <bytes> → 2*bytes lowercase hex chars (URL-safe, no quoting needed).
hex() { od -An -N"$1" -tx1 /dev/urandom | tr -d ' \n'; }

umask 077
awk \
  -v POSTGRES_PASSWORD="$(hex 24)" \
  -v JWT_ACCESS_SECRET="$(hex 32)" \
  -v JWT_REFRESH_SECRET="$(hex 32)" \
  -v GF_SECURITY_ADMIN_PASSWORD="$(hex 12)" \
  -v S3_ACCESS_KEY="GK$(hex 12)" \
  -v S3_SECRET_KEY="$(hex 32)" \
  -v GARAGE_RPC_SECRET="$(hex 32)" \
  '
  BEGIN {
    secret["POSTGRES_PASSWORD"] = POSTGRES_PASSWORD
    secret["JWT_ACCESS_SECRET"] = JWT_ACCESS_SECRET
    secret["JWT_REFRESH_SECRET"] = JWT_REFRESH_SECRET
    secret["GF_SECURITY_ADMIN_PASSWORD"] = GF_SECURITY_ADMIN_PASSWORD
    secret["S3_ACCESS_KEY"] = S3_ACCESS_KEY
    secret["S3_SECRET_KEY"] = S3_SECRET_KEY
    secret["GARAGE_RPC_SECRET"] = GARAGE_RPC_SECRET
  }
  {
    key = $0
    sub(/=.*/, "", key)
    if (index($0, "=") && (key in secret)) print key "=" secret[key]
    else print
  }
  ' .env.example > .env

echo "Created .env from .env.example with generated secrets."
