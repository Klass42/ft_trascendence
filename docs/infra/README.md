# Infrastructure guide

How ft_trascendence is deployed, configured, monitored and tested.
Owner: Viacheslav (`@ViacheslavTrofymenko`, 42 login `vtrofyme`).

## 1. One command

```bash
make
```

On a clean clone this creates `.env` with random secrets, builds the two app images, starts
14 containers, applies the Prisma migrations, loads the demo data (only if the database is
empty) and prints the URLs and logins:

```
App       https://localhost:4443      student@demo / teacher@demo / admin@demo — demo1234, org code "klass"
Grafana   https://localhost:4150      admin / <generated, printed by `make urls`>
```

Requirements: Docker Engine with the Compose plugin (v2.20+), GNU make, bash. Nothing else —
Node, pnpm and Nix are only needed for local development.

The stack is plain Docker Compose: `compose.yaml` and `.env` sit in the repo root, so
`docker compose ps`, `docker compose logs -f backend`, `docker compose exec postgres psql …`
work directly. The Makefile only wraps the common sequences.

| Command | What it does |
|---|---|
| `make` | deploy (idempotent — never re-seeds a database that has data) |
| `make down` / `make clean` | stop and remove containers, keep volumes |
| `make fclean` | also drop volumes and locally built images (`.env` is kept) |
| `make re` | `fclean` + `make` |
| `make status` · `make logs` · `make logs-<service>` | inspect |
| `make urls` | print URLs and logins again |
| `make smoke` | 12 checks through the public HTTPS entrypoint |
| `make reload` | restart services after editing a mounted config file |
| `make check` | validate `compose.yaml`, the Caddyfile and the Prometheus config/rules |
| `make db-seed` (`-small`, `-large`, `-e2e`), `make db-reset` | **replace** application data |
| `make db-migrate NAME=…` · `make db-deploy` · `make db-push` | Prisma migrations |
| `make ci` | lint + build + backend tests inside the Nix `ci` shell |

## 2. Architecture

```mermaid
flowchart LR
    browser([Browser]) -- "HTTPS :4443 / :4150<br/>HTTP :4180 → redirect" --> caddy

    subgraph compose network — nothing else is published
        caddy[caddy<br/>TLS, routing, headers]
        caddy -- "/" --> frontend[frontend<br/>nginx, static SPA]
        caddy -- "/api /socket.io /uploads /health" --> backend[backend<br/>NestJS]
        caddy -- ":4150" --> grafana

        migrate[[migrate<br/>one-shot]] --> postgres
        backend --> postgres[(postgres)]
        backend --> garage[(garage S3)]
        backend -- "OTLP" --> otel[otel-collector]

        otel -- metrics --> prometheus
        otel -- traces --> tempo
        otel -- logs --> loki
        prometheus -. scrape .-> exporters[node-exporter<br/>postgres-exporter<br/>blackbox-exporter]
        prometheus -. scrape .-> caddy
        prometheus -. scrape .-> garage
        grafana --> prometheus
        grafana --> tempo
        grafana --> loki
    end
```

| Service | Image | Role | Health check |
|---|---|---|---|
| `caddy` | `caddy:2.11-alpine` | the only published ports; TLS, routing, compression, security headers | `/healthz` on the internal listener |
| `frontend` | built · `nginx-unprivileged` | static SPA, SPA fallback, cache headers | `/healthz` |
| `backend` | built · `node:22-alpine` | NestJS API + Socket.io, runs as `node`, one process | `/health` |
| `migrate` | same image as backend | `prisma migrate deploy`, then exits; backend waits for it | exit code |
| `postgres` | `postgres:16-alpine` | database | `pg_isready` |
| `garage` | `dxflrs/garage:v2.3.0` | S3 bucket `ft-uploads` (see §6) | `garage status` |
| `otel-collector` | `otel/opentelemetry-collector-contrib` | OTLP in → Prometheus / Tempo / Loki | — (no shell in image) |
| `prometheus` | `prom/prometheus` | metrics + alerting rules | `/-/healthy` |
| `tempo`, `loki` | `grafana/tempo`, `grafana/loki` | traces, logs | scraped by Prometheus |
| `grafana` | `grafana/grafana` | dashboards, alert view, Explore | `/api/health` |
| `node-exporter`, `postgres-exporter`, `blackbox-exporter` | Prometheus exporters | host, database, HTTP probes | scraped by Prometheus |

Start order is enforced with `depends_on` conditions: `postgres` healthy → `migrate` completed →
`backend` healthy → `caddy`. `docker compose up -d` therefore returns only when the app is
reachable, and fails loudly if a step does not come up.

Every long-running service has `restart: unless-stopped` and log rotation (3 × 10 MB).

## 3. Configuration

`.env` (gitignored) is created from `.env.example` by `make env`
([`scripts/gen-env.sh`](../../scripts/gen-env.sh)), which replaces the placeholder secrets with
random values. A plain `cp .env.example .env` also boots, with weak development defaults.

| Variable | Default | Meaning |
|---|---|---|
| `CADDY_DOMAIN` | `localhost` | host name or IP used in the browser |
| `CADDY_TLS` | `internal` | `internal` = Caddy's own CA; an e-mail address = Let's Encrypt |
| `CADDY_HTTP_PORT` / `CADDY_HTTPS_PORT` | `4180` / `4443` | published app ports |
| `GRAFANA_HOST_PORT` | `4150` | published Grafana port (HTTPS) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `ft` / generated / `ft_prod` | database |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | generated | token signing |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | empty | Google OAuth (disabled while empty) |
| `PLATFORM_SUPERADMIN_EMAIL/PASSWORD/NAME` | see file | first platform admin |
| `STORAGE_DRIVER` | `local` | `local` volume or `s3` (Garage) |
| `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `GARAGE_RPC_SECRET` | generated | Garage |
| `GF_SECURITY_ADMIN_USER` / `GF_SECURITY_ADMIN_PASSWORD` | `admin` / generated | Grafana admin |

Rules of thumb:

- **Only deployment settings go in `.env`.** Service names, internal ports and image tags are
  fixed in `compose.yaml`; nothing reads them from the environment.
- `POSTGRES_PASSWORD` and the Grafana admin password are applied when their volume is first
  created. Changing them later needs `make fclean` (or changing them inside the service).
- Derived values are computed in `compose.yaml`, e.g. `FRONTEND_URL` and
  `GOOGLE_CALLBACK_URL = https://<domain>:<port>/api/auth/google/callback` — that exact URI must
  be registered in the Google Cloud console.
- New backend variable? Add it to `x-backend-env` in `compose.yaml` and, if a human must set it,
  to `.env.example` (and to `gen-env.sh` if it is a secret).

## 4. HTTPS

All traffic from outside the compose network goes through Caddy over TLS; port `4180` only
answers with a redirect to HTTPS.

- **Local / evaluation:** Caddy signs a certificate for `CADDY_DOMAIN` with its internal CA.
  Chrome shows the self-signed warning once per host.
- **Second machine (multi-user demo):** set `CADDY_DOMAIN` to the host name or IP of the machine
  running the stack, then `make up`. The certificate is issued for that name.
- **Real domain:** set `CADDY_DOMAIN`, `CADDY_TLS=<e-mail>`, ports `80`/`443`.

Routing (`infra/caddy/Caddyfile`): `/api/*` → backend with the prefix stripped (same as the Vite
dev proxy), `/socket.io/*`, `/uploads/*`, `/health` → backend, everything else → frontend.
Responses get `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, compression, and
HSTS for any domain other than `localhost`.

## 5. Images

- `apps/backend/Dockerfile` — multi-stage; pnpm store in a BuildKit cache mount; dependency layer
  cached until the lockfile changes; runtime runs `node dist/main.js` as user `node` under
  Docker's init (`init: true`). The Prisma CLI and `tsx` stay in the image for `migrate` / seeds.
- `apps/frontend/Dockerfile` — Vite build, then `nginxinc/nginx-unprivileged` serving `dist/`
  (49 MB). `apps/frontend/nginx.conf` holds the SPA fallback and cache policy.
- `.dockerignore` keeps `.git`, `node_modules`, `.env`, docs and infra out of the build context.

## 6. Data

| Volume | Content |
|---|---|
| `postgres_data` | database |
| `uploads` | files stored by the `local` storage driver |
| `garage_meta`, `garage_data` | S3 objects |
| `prometheus_data` (7 d), `tempo_data` (48 h), `loki_data` (72 h), `grafana_data` | observability |
| `caddy_data`, `caddy_config` | Caddy CA and certificates |

Storage: `STORAGE_DRIVER=local` is the supported mode. With `s3` uploads do reach Garage, but
the presigned download URLs point at `http://garage:3900`, which a browser cannot reach — see
the open item in [`../planning/vtrofyme.md`](../planning/vtrofyme.md).

## 7. Monitoring (module: Prometheus + Grafana)

**Metrics collection.** Prometheus scrapes 12 targets (`infra/monitoring/prometheus/prometheus.yml`):

| Job | Source | What it gives |
|---|---|---|
| `node` | node-exporter | host CPU, memory, load, disk |
| `postgres` | postgres-exporter | connections, transactions, database size, deadlocks |
| `probe` | blackbox-exporter | HTTP health of backend, frontend and Caddy from inside the network |
| `caddy` | Caddy built-in metrics | request rate, status codes, latency at the edge |
| `garage` | Garage admin API | cluster and block health |
| `otel-collector`, `prometheus`, `grafana`, `loki`, `tempo` | self-metrics | pipeline health |

Backend application metrics (HTTP server histograms, V8 heap, event loop, GC) are **pushed**:
NestJS → OTLP → collector → Prometheus remote-write, job `ft-backend`. Traces go to Tempo and
logs to Loki through the same collector; `OtelLogger` (`apps/backend/src/telemetry/`) forwards
every Nest log line with its trace id.

**Dashboards** (`infra/monitoring/grafana/dashboards/`, provisioned as code):

- *Platform Overview* (home) — targets up, health probes, firing alerts, request and error rate,
  telemetry pipeline, backend log volume.
- *NestJS Backend* — request rate, latency percentiles, error rate, heap, event loop, GC.
- *Infrastructure* — host, PostgreSQL, Caddy, probes, Garage.

**Alerting rules** (`infra/monitoring/prometheus/rules/alerts.yml`, 11 rules): scrape target
down, health probe failed, PostgreSQL down, backend 5xx rate, backend p95 latency, event loop
saturation, PostgreSQL connections, host CPU / memory / disk, telemetry export failures.
State is shown in Grafana → Alerting → Alert rules and in the "Firing alerts" panel.

**Secured access.** Grafana is reachable only over HTTPS through Caddy, with a generated admin
password, no anonymous access, no sign-up and secure cookies. Prometheus, Tempo and Loki are not
published at all; query them through Grafana (Explore) or `docker compose exec`.

**Demo for the evaluation**

```bash
make urls                          # Grafana URL + admin password
docker compose stop backend        # → "ServiceProbeFailed" turns Pending, then Firing (~1.5 min)
docker compose start backend       # → resolves within a minute
```

## 8. CI

`.github/workflows/ci.yaml`, on pull requests and on pushes to `staging` / `master`:

1. **checks** — `scripts/ci.sh` in the Nix `ci` shell (same as `make ci`): actionlint, yamllint,
   hadolint, `prisma validate`, build, backend unit + integration tests (348 tests); semgrep and
   trivy are informational.
2. **deploy** — `make check`, then `make` on a clean runner, `scripts/smoke.sh`, and the
   Playwright compose smoke suite (login through HTTPS with zero console errors).

Not yet in CI: ESLint (the repo has no ESLint config).

## 9. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `make` stops with `dependency failed to start: container …backend… is unhealthy` | `make logs-backend`; usually a failed migration (`docker compose logs migrate`) |
| `migrate` fails with `P1000: Authentication failed` | the `postgres_data` volume was created with another password — `make re` (drops data) |
| `required variable … is missing a value` | no `.env` — run `make env` |
| Edited the Caddyfile / Prometheus / Grafana files, nothing changed | `make reload` |
| Port already in use | change `CADDY_HTTP_PORT` / `CADDY_HTTPS_PORT` / `GRAFANA_HOST_PORT` in `.env` |
| Grafana rejects the password from `.env` | `grafana_data` predates it — `docker compose down && docker volume rm ft-trascendence_grafana_data && make up` |

**Coming from the old layout** (`infra/docker/docker-compose.yml`, `infra/docker/.env`): run
`make re` once. The old `infra/docker/.env` is no longer read and can be deleted.
