# Viacheslav (vtrofyme) — DevOps / Infrastructure

> Working brief. Shared conventions: `../../AGENTS.md`. How the deployment works day to day:
> [`../infra/README.md`](../infra/README.md). Branch **`vtrofyme`** (based on `staging`), merged
> through `staging` like everyone else.
>
> GitHub `@ViacheslavTrofymenko`, 42 login `vtrofyme`. Took over the DevOps role from Ale Pinto.

**Theme:** everything that is not application code — containers, HTTPS, storage backend, CI/CD,
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

## 1. The infra rework (this branch)

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
| Monitoring content | 3 scrape targets (1 permanently down), 0 exporters, 0 alert rules, 2 dashboards | 12 targets, node / postgres / blackbox exporters, 11 alert rules, 3 dashboards | subject: exporters, custom dashboards, alerting rules |
| Logs | Loki received nothing | backend logger also emits OTLP log records with the trace id | logs ↔ traces in Grafana |
| Reliability | no restart policy, 3 health checks | `restart: unless-stopped`, 7 health checks, log rotation, ordered start-up | `make` returns when the app really answers |
| CI | linters + build | + 348 backend tests, + a job that runs `make`, `make smoke` and the Playwright compose smoke | the single-command gate is tested on every PR |

Verified on the branch: `make` from scratch, `make smoke` 12/12, the team's compose E2E suites
9/9, backend tests 348/348, alert `ServiceProbeFailed` fires 72 s after `docker compose stop
backend` and resolves 12 s after it is started again.

**Touches outside my directories** (need the owners' review):
- `apps/backend/src/telemetry/otel-logger.ts` (new), two lines in `apps/backend/src/main.ts`, the
  `@opentelemetry/api-logs` dependency — without them Loki stays empty.
- `apps/frontend/vite.config.ts` — drops the reads of the removed `infra/docker/.env*` files.

**Migration for teammates:** after pulling, run `make re` once (drops the local database and
re-seeds it). The old `infra/docker/.env` is no longer read.

## 2. Open questions for the team

1. Compose and `.env` in the repo root — agreed? It changes the paths everyone is used to.
2. The two app-code touches above: keep them in my PR, or should the owners make them?
3. Loki and Tempo (~280 MB of RAM together) are not required by the module. Keep, or drop?
4. Garage: `STORAGE_DRIVER=s3` uploads fine, but presigned URLs point at `http://garage:3900`,
   which a browser cannot reach. Fix it (public HTTPS endpoint in Caddy + `S3_PUBLIC_ENDPOINT`
   in Aloiki's driver) or remove the container and keep the local volume?
5. `make` no longer re-seeds. E2E runs that need a pristine database call `make db-seed`
   (or `make db-seed-e2e`) explicitly — fine?
6. Nix devShell stays as an optional developer tool. Does anyone use it?
7. CI runs on pull requests and on pushes to `staging` / `master` only — fine?
8. Google OAuth (Jorge): the redirect URI to register is
   `https://localhost:4443/api/auth/google/callback`; the backend then redirects to `/#accessToken=…`
   while the page that reads the tokens is `/auth/callback`.

## 3. Next steps

- [ ] Run `make` + `make smoke` on a campus machine (rootless Docker) — only tested on a laptop.
- [ ] First green run of the new workflow on GitHub.
- [ ] **Health check + status page + automated backups + restore runbook** (DevOps Minor, +1
      point): scheduled `pg_dump`, `make backup` / `make restore`, a status page.
- [ ] README "Instructions" section (mandatory README is still the template).
- [ ] Shared ESLint flat config, lint blocking in CI (`pnpm lint` fails today: no config).
- [ ] Full Playwright suite in CI (only the compose smoke runs now).
- [ ] Alertmanager with a notification channel; alerts are visible only in Grafana today.
- [ ] Content-Security-Policy header — only after every screen is checked for console errors.
- [ ] Drop devDependencies from the backend image (~630 MB → ~400 MB).

## Module points I carry

DevOps: Monitoring with Prometheus and Grafana (Major, 2). Candidate: health check, status page,
backups and disaster recovery (Minor, 1).

## Reminders

- The single-command deploy and HTTPS-everywhere gates are mine — the project is rejected
  without them.
- I do not edit application business logic; I provide infra and interfaces.
- Env-var renames are announced — Aloiki (storage) and Jorge (OAuth / JWT) read them.
