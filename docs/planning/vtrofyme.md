# Viacheslav (vtrofyme) — DevOps / Infrastructure

> Working brief. Shared conventions: `../../AGENTS.md`. How the deployment works day to day:
> [`../infra/README.md`](../infra/README.md). Work on branch **`vtrofyme`** (based on `master`);
> merge to `staging` before `master`.
>
> GitHub `@ViacheslavTrofymenko`, 42 login `vtrofyme`. Took over the DevOps role from Ale Pinto.

**Theme:** everything that is not application code: containers, HTTPS, storage backend, CI/CD,
observability, secrets, deployment, backups.

**Directories I own:**
`infra/**` · `.github/**` · `scripts/**` · `Makefile` · `compose.yaml` · `.env.example` ·
`.dockerignore` · `flake.nix` · `apps/*/Dockerfile` · `apps/frontend/nginx.conf`.

**Contracts I provide:**
- One command (`make`) that brings the whole stack up over HTTPS from a clean clone.
- Environment variables for the backend: declared in `x-backend-env` in `compose.yaml`; anything a
  human sets goes through `.env.example`. I announce every rename.
- Green CI, including a real deployment of the stack on each pull request.
- The Monitoring module (Prometheus + Grafana, Major, 2 points).

---

## 1. The infra rework

The stack Ale left came up and served the app, but the Monitoring module did not meet the
subject, monitoring was exposed without a password, and half of the documented `make` targets
did nothing. The rework keeps the same stack, ports and target names, and changes this:

| Area | Before (staging `a4b921dc`) | After | Why |
|---|---|---|---|
| Layout | `infra/docker/docker-compose.yml`, usable only through make with flags | `compose.yaml` + `.env` in the repo root | plain `docker compose ps/logs/exec` works |
| Configuration | 96 variables, mostly internal hosts and ports | 22: domain, published ports, credentials, secrets | `.env` holds only what a human changes |
| Secrets | `.env` = copy of the example (`dev-not-secret-replace-me`, `ft/ft`, `admin/admin`); Garage RPC secret committed | `make env` generates random secrets | no shared, known secrets |
| Makefile | `make up` / `make down` were no-ops; deploy downloaded nix-portable (68 MB); every `make` re-seeded the database | same target names, working; seeds only an empty database; new `smoke`, `reload`, `check` | re-running is safe; deploy needs only Docker |
| Backend image | root, `sh -c "migrate && node"`, apk version pin | user `node`, one process; migrations in a one-shot `migrate` service; pnpm cache mount | one container = one process |
| Frontend image | `serve` on Node, 258 MB, no `.dockerignore` | static build on unprivileged nginx, 49 MB | smaller, no Node at runtime |
| Caddy | 6 published ports, no security headers, OAuth callback without `/api` | 3 ports (app, redirect, Grafana), security headers, compression, callback fixed | less exposed; OAuth reaches the backend |
| Monitoring access | Prometheus, Tempo, Loki open without auth; Grafana `admin/admin` | only Grafana published, generated password, no anonymous access | subject: "secure access to Grafana" |
| Monitoring content | 3 scrape targets (1 permanently down), 0 exporters, 0 alert rules, 2 dashboards | 10 targets, node / postgres / blackbox exporters, 11 alert rules, 3 dashboards | subject: exporters, custom dashboards, alerting rules |
| Logs | Loki received nothing | backend logger also emits OTLP log records with the trace id | logs ↔ traces in Grafana |
| Reliability | no restart policy, 3 health checks | `restart: unless-stopped`, 7 health checks, log rotation, ordered start-up | `make` returns when the app really answers |
| CI | linters + build | + 348 backend tests, + a job that runs `make`, `make smoke` and the Playwright compose smoke | the single-command gate is tested on every PR |

Verified on the branch: `make` from scratch, `make smoke` 12/12, the team's compose E2E suites
9/9, backend tests 348/348, alert `ServiceProbeFailed` fires 72 s after `docker compose stop
backend` and resolves 12 s after it is started again.

> **Update 2026-10-27 (David):** Tempo and Loki were removed afterwards (`e37afd16`); logs stay in
> Docker (`make logs`), so the "Logs" row and the Loki note below are historical. Prometheus scrapes
> 10 targets (see `infra/monitoring/prometheus/prometheus.yml`). The test counts above are from
> 2026-10-05; the suites have grown since (CI runs all backend unit + integration tests). Since
> then: `make env` also generates the platform superadmin password, Caddy sends a
> Content-Security-Policy and no longer proxies `/uploads` (files go through signed
> `/api/files/:id/content` URLs) — PR #87.

**Touches outside my directories** (need the owners' review):
- `apps/backend/src/telemetry/otel-logger.ts` (new), two lines in `apps/backend/src/main.ts`, the
  `@opentelemetry/api-logs` dependency — without them Loki stays empty.
- `apps/frontend/vite.config.ts` — drops the reads of the removed `infra/docker/.env*` files.

**Migration for teammates:** after pulling, run `make re` once (drops the local database and
re-seeds it). The old `infra/docker/.env` is no longer read.

## 2. Next steps

- [ ] Run `make` + `make smoke` on a campus machine (rootless Docker) — only tested on a laptop.
- [x] First green run of the new workflow on GitHub (green on every PR since #66).
- [ ] **Health check + status page + automated backups + restore runbook** (DevOps Minor, +1
      point): scheduled `pg_dump`, `make backup` / `make restore`, a status page.
- [x] README "Instructions" section.
- [ ] Shared ESLint flat config, lint blocking in CI (`pnpm lint` fails today: no config).
- [ ] Full Playwright suite in CI (only the compose smoke runs now).
- [ ] Alertmanager with a notification channel; alerts are visible only in Grafana today.
- [x] Content-Security-Policy header (#87, checked with a Playwright pass: no violations).
- [ ] Drop devDependencies from the backend image (~630 MB → ~400 MB).

## Module points I carry

DevOps: Monitoring with Prometheus and Grafana (Major, 2). Candidate: health check, status page,
backups and disaster recovery (Minor, 1).

## Reminders

- The single-command deploy and HTTPS-everywhere gates are mine — the project is rejected
  without them.
- I do not edit application business logic; I provide infra and interfaces.
- Env-var renames are announced — Aloiki (storage) and Jorge (OAuth / JWT) read them.
