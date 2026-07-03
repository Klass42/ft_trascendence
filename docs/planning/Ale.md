# Ale Pinto — DevOps / Infrastructure

> **Your file.** Working brief. Read `../../AGENTS.md` for shared conventions and `./README.md`
> for the methodology. Work on branch **`ale`** (based on `main`); merge to `staging` before
> `main`.
>
> ⚠️ Add your GitHub handle to `.github/CODEOWNERS.md` and ask a `Klass42` admin to grant you
> Write access + set the default branch to `main`.

**Theme:** you own everything that isn't application code — containers, HTTPS, storage backend,
CI/CD, observability, secrets, deployment, backups. The 3 app devs never touch `infra/`.

**Directories you own:**
`infra/**` · `.github/**` · `scripts/**` · `Makefile` · `flake.nix` · `apps/*/Dockerfile` ·
`apps/frontend/nginx.conf`.

**Contracts YOU provide (Week 1, unblock everyone — do these first):**
- **Reverse proxy + HTTPS (Caddy)** — one entrypoint, `/`→frontend, `/api`→backend, WS upgrade for
  David's sockets. Mandatory subject gate.
- **Garage (S3) service + bucket + keys** in the dev compose + `.env` — Aloiki's `S3StorageDriver`
  points at it. Until it's up they use the local-disk driver, so you're not blocking them, but land
  it early.
- **Green CI** (already `scripts/ci.sh`) — keep it green and extend it (below).

---

## Epic 1 — Reverse proxy + HTTPS (Week 1, mandatory gate)

- [ ] `infra/docker/caddy/Caddyfile` — TLS (internal CA for dev / real cert for prod), routes
      `/` → `frontend`, `/api/*` → `backend:3000`, and **WebSocket upgrade** for `/api/socket.io`.
- [ ] Add `caddy` service to `infra/docker/docker-compose.dev.yml`; expose 80/443; make the app
      reachable only through the proxy.
- [ ] Verify: browser → `https://localhost` works, no mixed-content, sockets connect through TLS.

## Epic 2 — Object storage (Garage) (Week 1, unblocks uploads)

- [ ] Add `garage` service (S3-compatible) to the dev compose; init a bucket `ft-uploads` + access
      keys; wire `S3_ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY/BUCKET` into `.env.dev` + `.env.example`.
- [ ] A `make garage-init` target that creates the bucket/keys idempotently.
- [ ] Coordinate the exact env var names with Aloiki (she reads them in `S3StorageDriver`).

## Epic 3 — CI/CD hardening

- [ ] Keep `scripts/ci.sh` green. **Add a shared ESLint flat config** (`eslint.config.mjs` +
      `typescript-eslint`) for both apps and make lint blocking in CI (currently only build gates).
- [ ] Add a **test** stage (`pnpm -r test`) once devs add unit tests; wire coverage.
- [ ] Container image build + **Trivy** scan as a real (non-informational) gate on release branches.
- [ ] Protect `main` and `staging` (branch protection): require CI green + 1 review before merge.
- [ ] Bump `actions/checkout` etc. to silence the Node-20 deprecation warning.

## Epic 4 — Observability (module: Monitoring Prometheus+Grafana ✓, Major 2)

- [ ] Wire app metrics: ensure the backend exports Prometheus metrics (OTel already emits; confirm
      scrape). Add HTTP latency/error-rate/request-count dashboards.
- [ ] Finish Grafana dashboards (`infra/monitoring/grafana/dashboards/`): app overview, DB, sockets.
- [ ] **Alert rules** (error rate, p99 latency, container down) + verify traces (Tempo) and logs
      (Loki) flow end-to-end from a real request.
- [ ] Secure Grafana (real admin password via env/secret, disable sign-up).

## Epic 5 — Secrets, security & env management

- [ ] Consolidate env: `.env.example` (done) is the contract; ensure no secret is committed.
- [ ] Security at the proxy: rate limiting, security headers (HSTS, CSP, X-Frame-Options), CORS.
- [ ] (Stretch, Cybersecurity Major) HashiCorp Vault for secrets + ModSecurity/WAF on Caddy.
- [ ] Privacy Policy + Terms of Service **routes/pages** (mandatory) — build the routes + footer
      links; Aloiki styles them with the design system. Real, non-placeholder content.

## Epic 6 — Deployment, backups, single-command

- [ ] Production compose (`docker-compose.prod.yml`) + a single `make deploy` / `docker compose up`.
- [ ] Postgres automated backups + restore runbook; Garage data persistence.
- [ ] Health checks + restart policies on every service; a `/status` page (Minor: health/status +
      DR module).
- [ ] A clean **demo environment** for evaluation (seeded data, HTTPS, monitoring visible).

## Epic 7 — Kubernetes (optional/aspirational — do NOT let it block the single-command gate)

- [ ] Finish `infra/k8s/` manifests + HPA; keep Docker Compose as the graded path.

## Module points you carry
DevOps: Monitoring Prometheus+Grafana (Major, 2). Stretch: Cybersecurity WAF+Vault (Major, 2),
Health/status + DR (Minor, 1), ELK log management (Major, 2).

## Reminders
- The **single `docker compose up`** and **HTTPS everywhere** gates are yours — the project is
  rejected without them.
- Don't edit app code (`apps/backend/src/**` business logic, `apps/frontend/src/features/**`).
  Provide infra and interfaces; the devs consume them.
- Announce env-var name changes — Aloiki (storage) and Jorge (OAuth/JWT/SMTP) read them.
