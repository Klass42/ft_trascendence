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
- **Ale Pinto** (handle TBD) — **DevOps / Infra**: owns `infra/**`, `.github/**`, `scripts/**`,
  `Makefile`, `flake.nix`, Dockerfiles, HTTPS/proxy, storage backend, CI/CD, monitoring, deploy.
  **App devs do not touch infra.**

Per-person deep task plans: `docs/planning/{Jorge,Aloiki,David,Ale}.md`;
`docs/planning/README.md` is the combined master plan + directory-ownership map.

### Branching (see docs/planning/README.md §2)
Trunk is **`master`** (the GitHub default). Each person has a personal branch off `master`
(`jorge`/`aloiki`/`david`/`ale`); sub-branches per task are fine. **Nothing goes straight to
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
| Database | **PostgreSQL 16** | `postgres` service in the dev compose |
| Cache/Queue | Valkey + BullMQ | Planned, not scaffolded |
| Object storage | Garage (S3-compatible) | Files stored as references, not blobs |
| Real-time | Socket.io via NestJS Gateway | |
| Reverse proxy / HTTPS | Caddy (or nginx TLS) | Planned, not scaffolded |
| Observability | OTel Collector → Prometheus + Tempo + Loki + Grafana | Built |
| Dev env | Nix flake devShells + direnv | `dev` / `debug` / `ci` |

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
- **Roles**: separate *global* role (within org: admin/teacher/student) from *course-scoped*
  role (enrollment). Don't duplicate role logic across the two.
- Standardize timestamps as `createdAt` / `updatedAt` (camelCase in Prisma). One naming style.
- **Schema is phased** — build only what a feature needs now. Deferred to Phase 2: billing
  (plans/subscriptions/payments), attendance, certificates, calendar events, full quiz engine,
  tutor/guardian relations. Don't create these tables until their feature is in scope.

## 6. Repo layout & commands

```
apps/backend      NestJS 10 API (OTel-instrumented). Only /, /health exist today.
apps/frontend     Vite + React 19 SPA (currently a health dashboard).
infra/docker      docker-compose.yml + .env.example (app + postgres + observability + Caddy).
infra/monitoring  otel-collector, prometheus, tempo, loki, grafana configs + dashboards.
infra/k8s         k8s manifests + HPA (aspirational; compose is the dev/eval path).
infra/nix         Nix-built OCI images (backend/frontend).
flake.nix         devShells: dev / debug / ci (entered via nix-portable, not a Nix install).
Makefile          task runner (see below).
infra/docker/.env.example  single source of truth for ports, URLs, image tags, credentials.
MVP_DESIGN.md     product plan (partly stale — see §1).
```

Common commands (prefer the Makefile):

```bash
make             # default: nix-portable + compose up --build from .env.example + seed
make up          # same as `make`
make help        # list targets
make down        # stop; make fclean also drops volumes
make logs        # follow logs; make logs-backend for just the API
make status      # compose ps
make dev         # nix-portable → flake devShell (Node 22, pnpm, docker)
make ci          # nix-portable → flake ci shell + scripts/ci.sh
make env         # create infra/docker/.env from .env.example (local overlays)
pnpm dev         # run apps in watch mode (parallel)
pnpm -r run lint # lint all packages
```

Ports, public URLs, image tags, and credentials live in **`infra/docker/.env.example`**.
Compose and the Makefile import that file (`--env-file`); optional `infra/docker/.env`
overlays it. Do not hardcode ports in the Makefile or compose.

Default published URLs (change in `.env.example`; unprivileged 41xx for campus):
App `https://localhost:4443`, Grafana `https://localhost:4150` (admin/admin),
Prometheus `:4160`, Tempo `:4161`, Loki `:4165`. HTTP redirect `:4180`.
Dev-without-compose: frontend `5173`, backend `3000`.

## 7. Code conventions

- TypeScript end to end. Match existing style; no reformat-only diffs.
- Backend: **`import './telemetry/otel-sdk'` MUST stay the first line of `main.ts`** (before any
  other import) or instrumentation breaks.
- Frontend talks to the API via `/api` (Vite proxy in dev, nginx proxy in the image).
- Validate every input in **both** layers (class-validator/DTOs on Nest; form validation on React).
- No secrets in code or gitignored `.env` files. The committed contract is
  `infra/docker/.env.example` (non-secret dev defaults: ports, URLs, placeholder
  credentials). Real secrets go in gitignored `infra/docker/.env` (`make env`).
- Conventional-style commit prefixes already in use (`infra:`, `init:`); keep them.

## 8. Definition of Done (per feature)

1. Works in latest Chrome with **no console warnings/errors**.
2. Validation implemented front **and** back.
3. Happy-path test.
4. Responsive (works on mobile).
5. RBAC verified — reachable only by the right role, and tenant-scoped by `organizationId`.
6. Reviewed by ≥1 teammate (CODEOWNERS routes reviews).
7. Comes up clean under `docker compose up` from scratch.

## 9. Known gaps / cleanup (updated 2026-07)

Done this session: ✅ Postgres + Prisma scaffolded (schema validates, in dev compose) ·
✅ `.pnpm-store/` untracked + gitignored · ✅ CODEOWNERS updated · ✅ root `.env.example` added ·
✅ `scripts/ci.sh` created — CI is green (infra linters + build + prisma validate blocking;
semgrep/trivy informational).

Also done: ✅ Nest foundation — global `PrismaModule`/`PrismaService`, `ConfigModule`, global
`ValidationPipe`, `/health` DB ping, BigInt JSON fix, and empty feature-module skeletons
(auth/users/organizations/courses/files/assignments/forums/notifications/realtime) pre-registered
in `app.module.ts` so owners don't fight over it.

Still open:
- ❌ Not scaffolded yet: auth logic, Valkey, Garage (S3), Caddy/HTTPS, Privacy/ToS pages, Socket.io.
- 🔧 CI does not yet run ESLint (no eslint config in the repo). The **build** (tsc/nest/vite) is
  the code gate for now. Adding a shared eslint flat config is a separate tooling task.
- 🔧 Dev compose bootstraps the DB with `prisma db push` (no migration history yet). Once the
  schema stabilizes, switch to `prisma migrate` and commit migrations.
- 📝 K8s manifests exist but the graded path is Docker Compose; don't let k8s block the "single
  command" requirement.
