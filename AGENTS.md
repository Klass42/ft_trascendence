# AGENTS.md — Engineering guide for ft_trascendence

Canonical, tool-agnostic conventions for anyone (human or AI) working in this repo.
Claude Code reads `CLAUDE.md`, which points here. Keep this file as the single source of truth.

---

## 1. What this project is

**ft_trascendence** (note the spelling — no `n`; used everywhere in package names) is 42's
Common Core final project. The subject (`en.subject.pdf`) is **version 21.1 "Surprise"**: the
rewritten, **free-choice** version. There is **no mandatory Pong** — the team picks the product.

**We are building a Learning Management System (LMS)** — "Moodle done right": modern UX,
real-time, modular. The subject explicitly lists an LMS as a valid example project (§V.3).

> ⚠️ `MVP_DESIGN.md` is the product plan but predates v21.1 in places. Ignore its stale bits:
> it cites an **18-point** target (real target is **14**), old module names ("Framework F+B"),
> and **Next.js** for the frontend (we use Vite+React — see §4). Trust the subject PDF and this
> file over MVP_DESIGN for anything about modules/points/stack.

**Team**: 4 people — **3 app developers** + **1 DevOps**:
- **Jorge** (`@SrJorgeG`) — Tech Lead, Identity & Access (auth/RBAC/org).
- **Aloiki** (`@illia`) — Content & UX (frontend shell + design system, courses, files).
- **David** (`@dacs-dev`) — Interaction (evaluations, forums, notifications, real-time).
- **Viacheslav** (`@ViacheslavTrofymenko`, 42 login `vtrofyme`) — **DevOps / Infra**: owns
  `infra/**`, `.github/**`, `scripts/**`, `Makefile`, `compose.yaml`, `.env.example`,
  Dockerfiles, HTTPS/proxy, storage backend, CI/CD, monitoring, deploy.
  **App devs do not touch infra.**

Per-person deep task plans: `docs/planning/{Jorge,Aloiki,David,vtrofyme}.md`;
`docs/planning/README.md` is the combined master plan + directory-ownership map.

### Branching (see docs/planning/README.md §2)
Trunk is **`master`** (the GitHub default). Each person has a personal branch off `master`
(`jorge`/`aloiki`/`david`/`vtrofyme`); sub-branches per task are fine. **Nothing goes straight to
`master` — flow is personal → `staging` → `master`.** `staging` is where branches integrate and
get tested before `master`.

## 2. Mandatory requirements (project is REJECTED if missing)

- Web app: frontend + backend + database, **clear DB schema**.
- **Single-command containerized deploy** (`docker compose up`).
- **HTTPS** for every connection from outside a container (browser, scripts, external APIs).
- **Multi-user simultaneous** support — no race conditions / data corruption under concurrency.
- **Email + password auth** with **hashed + salted** passwords (bcrypt/argon2).
- **Input validation on BOTH frontend and backend** for every form/input.
- Accessible **Privacy Policy** and **Terms of Service** pages with real content (footer links).
- Compatible with **latest Google Chrome**, **zero console warnings/errors**.
- Secrets in a git-ignored **`.env`** + a committed **`.env.example`**.
- Git history with commits from **all** members and meaningful messages.

## 3. Module strategy — target 14 pts (Major=2, Minor=1)

Planned core (~16 pts, comfortable margin before any AI):

| Module | Type | Pts | Where |
|---|---|---|---|
| Web: framework front **and** back | Major | 2 | React (front) + NestJS (back) |
| Web: real-time (WebSockets) | Major | 2 | Live notifications / forum |
| Web: ORM | Minor | 1 | Prisma |
| Web: file upload & management | Minor | 1 | Course content + submissions |
| Web: notification system | Minor | 1 | All create/update/delete actions |
| User Mgmt: Standard (profile/avatar/friends/status) | Major | 2 | Base |
| User Mgmt: Organization system | Major | 2 | Organizations (see §5) |
| User Mgmt: Advanced permissions (RBAC CRUD) | Major | 2 | admin/teacher/student |
| User Mgmt: OAuth 2.0 | Minor | 1 | Google |
| DevOps: Monitoring (Prometheus+Grafana) | Major | 2 | Already ~built (see §6) |

Bonus candidates (only after 14 is solid): AI Tutor (RAG Major / LLM Major), i18n (Minor),
GDPR (Minor), 2FA (Minor), Advanced analytics dashboard (Major).

> Only **fully functional** modules count. A half-built module = 0 pts. Don't claim what
> doesn't work. Some modules require a *game* (Game statistics, AI opponent, tournament,
> spectator) — **we have no game**, so those are out.

## 4. Stack (locked)

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspace (`apps/*`) | Node **22**, pnpm **9.15** |
| Frontend | **Vite 6 + React 19** (SPA) | Not Next.js. No SSR. Proxies `/api` → backend |
| Backend | **NestJS 10** | OpenTelemetry pre-wired (`src/telemetry`) |
| Data layer | **Prisma** (Postgres) | `apps/backend/prisma/schema.prisma` is the source of truth |
| Database | **PostgreSQL 16** | `postgres` service in `compose.yaml` |
| Cache/Queue | Valkey + BullMQ | Planned, not scaffolded |
| Object storage | Garage (S3-compatible) | Files stored as references, not blobs. Default driver is the local volume (`STORAGE_DRIVER`) |
| Real-time | Socket.io via NestJS Gateway | |
| Reverse proxy / HTTPS | **Caddy 2** | Built — the only container that publishes ports |
| Observability | OTel Collector → Prometheus + Grafana, exporters, alert rules | Built — see `docs/infra/README.md` |
| Dev env | Node 22 + pnpm 9.15 (corepack) | Docker only for deploy |

**License policy**: prefer OSI-approved (MIT/BSD/Apache/AGPL). Avoid source-available
non-free (SSPL/BSL/RSAL) — this excludes post-2024 Redis and MongoDB. That's why **Valkey**
(not Redis) and **Postgres** (not Mongo).

## 5. Data-layer conventions

- **English identifiers everywhere** — tables, columns, code. No Spanish in schema/code.
  (README must be English too.) Comments/commit bodies may be Spanish.
- **Prisma is the source of truth.** Never hand-edit the DB; change `schema.prisma` and run
  `prisma migrate`. No raw DDL files that drift from Prisma.
- **Multi-tenant = simplified "organization" for the MVP.** One `organizationId` FK scopes
  tenant data. **No PostgreSQL RLS, no per-tenant subdomains, no billing** in the MVP —
  those are Phase 2. This is what the "Organization system" module needs and no more.
- **Tenant isolation is enforced in the application layer** (Nest guards/services), NOT in the
  DB. **Every query over tenant-scoped data MUST filter by `organizationId`.** A missing
  `organizationId` filter is a security bug, treat it as such in review.
- **Roles**: separate the *global* role (within org: admin/teacher/student) from cohort
  membership (`CourseMembership`, students) and subject staff (`SubjectStaff`,
  teacher/assistant). A global teacher is not staff of every subject. Don't
  duplicate that logic.
- Standardize timestamps as `createdAt` / `updatedAt` (camelCase in Prisma). One naming style.
- **Schema is phased** — build only what a feature needs now. Deferred to Phase 2: billing
  (plans/subscriptions/payments), attendance, certificates, calendar events, full quiz engine,
  tutor/guardian relations. Don't create these tables until their feature is in scope.

## 6. Repo layout & commands

```
apps/backend      NestJS 10 API (OTel-instrumented) + Dockerfile.
apps/frontend     Vite + React 19 SPA + Dockerfile (static build served by nginx).
compose.yaml      the whole stack: caddy, frontend, backend, postgres, garage, observability.
.env.example      deployment settings and secrets template → `.env` (gitignored).
infra/caddy       Caddyfile: TLS, routing, security headers.
infra/garage      Garage (S3) node config.
infra/monitoring  otel-collector, prometheus (+ alert rules), blackbox, grafana.
scripts/          gen-env.sh (make env), smoke.sh (make smoke), ci.sh (make ci).
Makefile          task runner (see below).
docs/infra        how the deployment works, runbook, evaluation demo.
MVP_DESIGN.md     product plan (partly stale — see §1).
```

Common commands (prefer the Makefile; plain `docker compose …` works too, from the repo root):

```bash
make             # deploy: create .env, build, start, seed demo data on first run
make help        # list targets
make down        # stop (data kept); make fclean also drops volumes; make re = fclean + make
make status      # service state and health
make logs        # follow logs; make logs-backend for one service
make smoke       # test the running stack through HTTPS
make reload      # restart services after editing a mounted config (Caddyfile, Prometheus…)
make db-seed     # REPLACE data with the standard demo (also -small / -large / -e2e)
make db-migrate NAME=add_x   # create a Prisma migration
make ci          # scripts/ci.sh: lint, build, backend tests (needs Node 22)
pnpm dev         # run apps in watch mode (parallel)
```

Deployment settings (public host name, published ports, credentials, secrets) live in `.env`,
created from **`.env.example`** by `make env` with random secrets. Service names, internal ports
and image tags are fixed in `compose.yaml` — do not move them into `.env`.

Default URLs (unprivileged ports for campus): App `https://localhost:4443`, Grafana
`https://localhost:4150` (user/password in `.env`, printed by `make urls`), HTTP redirect `:4180`.
Prometheus is **not** published — use Grafana.
Dev-without-compose: frontend `5173`, backend `3000`.

## 7. Code conventions

- TypeScript end to end. Match existing style; no reformat-only diffs.
- Backend: **`import './telemetry/otel-sdk'` MUST stay the first line of `main.ts`** (before any
  other import) or instrumentation breaks.
- Frontend talks to the API via `/api` (Vite proxy in dev, Caddy in the deployed stack).
- Validate every input in **both** layers (class-validator/DTOs on Nest; form validation on React).
- No secrets in code. The committed contract is `.env.example` (placeholders only);
  real values live in the gitignored `.env` (`make env` generates them).
- Conventional-style commit prefixes already in use (`infra:`, `init:`); keep them.
- Auth rules: public registrations stay unverified in production until a valid verification
  token is used, and tenant JWTs must enforce that status; platform accounts are separate.
  Organization admins verify email when creating accounts. Refresh-token reuse may revoke
  sessions only after signature, refresh purpose, and `jti` validation. Google OAuth state must
  be signed, bound to an `HttpOnly` `SameSite` cookie, and carry the org slug.

## 8. Definition of Done (per feature)

1. Works in latest Chrome with **no console warnings/errors**.
2. Validation implemented front **and** back.
3. Happy-path test.
4. Responsive (works on mobile).
5. RBAC verified — reachable only by the right role, and tenant-scoped by `organizationId`.
6. Reviewed by ≥1 teammate (CODEOWNERS routes reviews).
7. Comes up clean under `docker compose up` from scratch.

## 9. Known gaps / cleanup (updated 2026-10-23)

Built and merged in `staging`: auth (email/password + tenant-aware Google), organizations and
platform back-office, users/RBAC/friends, courses split into cohort + subject, content builder,
resource library, activities/attempts engine with task templates and course final grade,
gradebook, forums, notifications + Socket.IO realtime/presence, analytics, Garage/S3 storage and
the Prometheus + Grafana stack (see `docs/infra/README.md`). The feature modules are no longer
skeletons; the root `README.md` is no longer an empty template either.

Still open:
- ❌ Valkey is not part of the stack (nothing needs it yet).
- 🔧 `STORAGE_DRIVER=s3` uploads to Garage, but presigned download URLs point at the internal
  `http://garage:3900` and are unusable from a browser. Keep `local` until the driver gets a
  public endpoint (plan in `docs/planning/vtrofyme.md`).
- 🔧 CI does not run ESLint (no shared flat config). The **build** (tsc/nest/vite) and the tests
  are the code gate for now.
- 📝 The root `README.md` still has `TODO`s the subject makes mandatory (module justification,
  features, individual contributions, AI use). Track them with the open issues labelled
  `modulo-42` and `documentation`.
- 🔎 The 2026-10-23 audit (static + live Playwright pass) is tracked as GitHub issues #43–#64.
