*This project has been created as part of the 42 curriculum by <login-jorge>, <login-david>, <login-aloiki>, vtrofyme.*

<!-- TODO(team): replace the three placeholders above with the real 42 logins (same order as the
     team table below). The subject requires this exact sentence, in italics, as the very first line. -->

# Klass

A learning management system (LMS) for academies: organizations, courses, subjects, lessons,
assignments and tests, grades, forums, friends and real-time notifications. Final project of the
42 Common Core (`ft_transcendence`, subject v21.1 "Surprise", free-choice web application).

## Table of contents

1. [Description](#description)
2. [Team information](#team-information)
3. [Project management](#project-management)
4. [Instructions](#instructions)
5. [Technical stack](#technical-stack)
6. [Database schema](#database-schema)
7. [Features list](#features-list)
8. [Modules](#modules)
9. [Individual contributions](#individual-contributions)
10. [Resources](#resources)
11. [License](#license)

## Description

<!-- TODO(team): goal of the project, a short overview and the key features (subject: "a clear
     name for the project and its key features"). Draft below, extend or rewrite. -->

**Klass** is a multi-tenant LMS. Each organization (an academy) has its own courses, subjects,
teachers and students; the platform administrator manages organizations from a separate
back-office. Teachers publish lessons and assignments (text, files, tests), grade submissions and
run forums; students follow their courses, hand in work, see their grades and talk to classmates.
Everything is served over HTTPS from a single `make`.

Key features: organizations and role-based access (platform admin, organization admin, teacher,
student), courses and subjects, lessons in Markdown, assignments and auto-graded tests, grades,
forums, friends and presence, real-time notifications, file uploads, Google sign-in, and a
monitored deployment (Prometheus + Grafana).

## Team information

<!-- TODO(team): the subject requires PO and PM to be named. Add the roles and one line of
     responsibilities per person. Keep the order of the first line of this file. -->

| Member | 42 login | GitHub | Role(s) | Responsibilities |
|---|---|---|---|---|
| Jorge | `<login>` | [@SrJorgeG](https://github.com/SrJorgeG) | Tech Lead, <!-- PO/PM? --> developer | authentication, roles and permissions, organizations, database schema |
| David | `<login>` | [@dacs-dev](https://github.com/dacs-dev) | developer | assignments, grades, forums, notifications, WebSocket |
| Aloiki | `<login>` | [@illia](https://github.com/illia) | developer | frontend, design system, courses, files |
| Viacheslav | `vtrofyme` | [@ViacheslavTrofymenko](https://github.com/ViacheslavTrofymenko) | DevOps | Docker images and Compose stack, HTTPS, CI/CD, monitoring, deployment, infrastructure docs |
| Ale Pinto | `<login>` | [@Aletheios42](https://github.com/Aletheios42) | DevOps (left the project) | initial repository, first Compose stack and CI |

## Project management

<!-- TODO(team): how the work was organized (task split, meetings, branches), tools (GitHub
     Issues / Projects, …) and communication channels (Discord, …). -->

- **Branches:** every member works on a personal branch and opens a pull request to `staging`;
  `staging` is merged into `master` for delivery. CI runs on every pull request, including a real
  deployment of the stack (see [CI](#continuous-integration)).
- **Code ownership:** [`.github/CODEOWNERS`](.github/CODEOWNERS); the split per person is in
  [`docs/planning/README.md`](docs/planning/README.md).
- **Tools:** <!-- TODO --> · **Communication:** <!-- TODO --> · **Meetings:** <!-- TODO -->

## Instructions

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Docker Engine | 24+ with the Compose plugin v2.20+ | the only hard requirement; rootless Docker works |
| GNU make, bash, curl | any | `make` wraps `docker compose`; `make smoke` uses `curl` |
| Free ports | `4180`, `4443`, `4150` | changeable in `.env` (see below) |
| Node.js 22 + pnpm 9.15 | optional | only for local development, tests and `make ci` (pnpm comes with `corepack enable`) |

About 1 GB of RAM and 2 GB of disk for images and volumes. Nothing is installed on the host:
all services run in containers.

### Run

```bash
git clone https://github.com/Klass42/ft_trascendence.git
cd ft_trascendence
make
```

`make` does, in order:

1. `make env` — copies `.env.example` to `.env` and replaces every placeholder secret with a
   random value ([`scripts/gen-env.sh`](scripts/gen-env.sh)). An existing `.env` is never touched.
2. `docker compose up -d --build` — builds the backend and frontend images and starts the 12
   containers in dependency order: PostgreSQL healthy → Prisma migrations (`migrate`, one-shot) →
   backend healthy → Caddy. The command returns only when the application answers.
3. Seeds the demo data **only if the database is empty**, so re-running `make` is safe.
4. Prints the URLs and logins (`make urls`).

Then open **https://localhost:4443** and accept the self-signed certificate once (Caddy issues it
from its own CA). Demo accounts, organization code `klass`:

| Account | Password | Role |
|---|---|---|
| `student@demo` | `demo1234` | student |
| `teacher@demo` | `demo1234` | teacher |
| `admin@demo` | `demo1234` | organization admin |
| `PLATFORM_SUPERADMIN_EMAIL` from `.env` (`admin@platform.local` by default) | `PLATFORM_SUPERADMIN_PASSWORD` from `.env` | platform admin, signs in at `/platform/login` |

Grafana: **https://localhost:4150**, user `admin`, password `GF_SECURITY_ADMIN_PASSWORD` from
`.env` (`make urls` prints it).

### Configuration (`.env`)

`.env` is git-ignored; [`.env.example`](.env.example) is the committed template. Only deployment
settings live there: internal host names, ports and image tags are fixed in
[`compose.yaml`](compose.yaml).

| Variable | Default | Meaning |
|---|---|---|
| `CADDY_DOMAIN` | `localhost` | host name or IP typed in the browser; the certificate is issued for it |
| `CADDY_TLS` | `internal` | `internal` = Caddy's own CA (self-signed); an e-mail address = Let's Encrypt (needs a public domain and ports 80/443) |
| `CADDY_HTTP_PORT` / `CADDY_HTTPS_PORT` | `4180` / `4443` | published ports; HTTP only redirects to HTTPS |
| `GRAFANA_HOST_PORT` | `4150` | published Grafana port (HTTPS) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `ft` / generated / `ft_prod` | database credentials, applied when the volume is first created |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | generated | token signing |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | empty | Google OAuth, disabled while empty. Redirect URI to register: `https://<CADDY_DOMAIN>:<CADDY_HTTPS_PORT>/api/auth/google/callback` |
| `PLATFORM_SUPERADMIN_EMAIL` / `_PASSWORD` / `_NAME` | see file | first platform administrator, created on first start |
| `STORAGE_DRIVER` | `local` | `local` = Docker volume `uploads`; `s3` = the bundled Garage bucket |
| `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `GARAGE_RPC_SECRET` | generated | Garage (S3) credentials |
| `GF_SECURITY_ADMIN_USER` / `GF_SECURITY_ADMIN_PASSWORD` | `admin` / generated | Grafana admin, applied when the volume is first created |

To serve the stack to other machines (multi-user demo), set `CADDY_DOMAIN` to the host's name
or IP and run `make up`.

### Everyday commands

| Command | What it does |
|---|---|
| `make` | deploy (idempotent) |
| `make status` · `make logs` · `make logs-backend` | state, health and logs |
| `make urls` | print the URLs and logins again |
| `make smoke` | 12 checks through the public HTTPS entrypoint: health, SPA, API, Socket.io, redirect, login, Grafana access, dashboards, Prometheus targets and rules |
| `make down` | stop and remove containers, keep data |
| `make fclean` · `make re` | also drop volumes and images · wipe and redeploy from scratch |
| `make db-seed` (`-small`, `-large`, `-e2e`) · `make db-reset` | **replace** the application data with a demo scenario |
| `make db-migrate NAME=…` · `make db-deploy` | create / apply Prisma migrations |
| `make check` | validate `compose.yaml`, the Caddyfile and the Prometheus config and rules |
| `make ci` | run the CI script locally: linters, build, backend tests |
| `make help` | the full list |

`compose.yaml` and `.env` sit in the repository root, so plain `docker compose ps`,
`docker compose logs -f backend` or `docker compose exec postgres psql …` work as well.

### Development without Docker rebuilds

```bash
corepack enable && pnpm install        # Node 22
pnpm --filter @ft-trascendence/backend run test            # 350 unit tests (Prisma mocked)
pnpm --filter @ft-trascendence/backend run test:integration
pnpm --filter @ft-trascendence/frontend run test:e2e:compose   # Playwright against the running stack
pnpm dev                                                   # both apps in watch mode
```

### Troubleshooting

| Symptom | Fix |
|---|---|
| `make` stops with `container …backend… is unhealthy` | `make logs-backend`; usually a failed migration, see `docker compose logs migrate` |
| `migrate` fails with `P1000: Authentication failed` | the `postgres_data` volume was created with another password: `make re` (drops data) |
| `required variable … is missing a value` | no `.env`: run `make env` |
| Port already in use | change `CADDY_HTTP_PORT`, `CADDY_HTTPS_PORT` or `GRAFANA_HOST_PORT` in `.env` |
| Edited a Caddy / Prometheus / Grafana file and nothing changed | `make reload` |
| Grafana rejects the password from `.env` | `grafana_data` predates it: `docker compose down && docker volume rm ft-trascendence_grafana_data && make up` |

Full infrastructure guide: [`docs/infra/README.md`](docs/infra/README.md).

## Technical stack

### Frontend

<!-- TODO(Aloiki): technologies, frameworks and why. Known facts: React 19, TypeScript, Vite 6,
     react-router-dom 7, CSS Modules + design tokens (own design system, 17 components),
     socket.io-client, react-markdown, lucide-react. -->

### Backend

NestJS 10 on Node 22 with TypeScript, Prisma 6 as the ORM, Passport (JWT + Google OAuth 2.0),
argon2 for passwords, class-validator DTOs behind a global `ValidationPipe` (`whitelist` +
`forbidNonWhitelisted`), `@nestjs/throttler` for rate limiting, multer uploads with content
sniffing, an S3 driver for Garage and a local driver, Socket.io (`@nestjs/websockets`) and
`@nestjs/event-emitter`.

*Why:* NestJS gives us modules, dependency injection and guards, so each feature lives in its own
module and tenant isolation and RBAC are enforced in one place (`@CurrentUser()`, `RolesGuard`)
instead of being repeated per route. The real-time layer is decoupled with an event bus: services
publish domain events (`notification.created`, `analytics.updated`) and the Socket.io gateway
reacts to them, so no service imports the gateway and nothing breaks when nobody is connected.

### Database

PostgreSQL 16. *Why:* Klass is relational by nature — organizations own users, courses, subjects,
files and templates; memberships and staff link people to cohorts; activities nest questions,
attempts and answers. We need real transactions (session rotation, concurrent attempt start,
consistent cascades) and concurrent readers/writers without inventing our own joins. MongoDB was
rejected: the SSPL licence is awkward for a school project, and forcing a document store onto
strongly related entities would have pushed integrity into application code. Prisma talks to
Postgres through a connection pool; `postgres-exporter` scrapes it for the monitoring stack.

### Infrastructure and observability

| Component | Version | Role | Why this choice |
|---|---|---|---|
| **Docker + Docker Compose** | Engine 24+, Compose v2 | 12 containers described in one `compose.yaml`; `make` = `docker compose up` | subject requirement: one command, no host installs |
| **Caddy** | 2.11 | the only service with published ports: TLS termination, routing (`/api`, `/socket.io`, `/uploads` → backend, rest → SPA, `:4150` → Grafana), compression, security headers | issues certificates by itself (internal CA or Let's Encrypt) and reloads config without downtime; nginx + certbot would need manual certificate handling |
| **nginx (unprivileged)** | 1.27 | serves the built SPA inside the `frontend` container | 49 MB image, no Node at runtime |
| **PostgreSQL** | 16 | database, with `postgres-exporter` for metrics | see [Database](#database) |
| **Garage** | 2.3 | optional S3-compatible object storage for uploads (`STORAGE_DRIVER=s3`) | self-hosted, no cloud account; the default driver is a local volume |
| **OpenTelemetry SDK + Collector** | 0.57 / 0.114 | the backend pushes HTTP, V8 and event-loop metrics over OTLP; the collector remote-writes them to Prometheus | one vendor-neutral pipeline; the backend needs no `/metrics` endpoint |
| **Prometheus** | 2.54 | 10 scrape targets, 11 alerting rules, 7-day retention | the de-facto standard named by the subject |
| **Grafana** | 11.4 | 3 provisioned dashboards (Platform overview, NestJS backend, Infrastructure), alert view | dashboards and alerts live in the repo as JSON/YAML, no manual setup |
| **node-exporter, postgres-exporter, blackbox-exporter** | 1.8 / 0.16 / 0.25 | host, database and HTTP-probe metrics | standard exporters for the subject's "exporters" requirement |
| **GitHub Actions** | — | linters, build, backend tests, then a real `make` deployment with smoke and Playwright tests on every pull request | runs on the free tier, no self-hosted runner |

Design rules behind it:

- **One process per container, non-root.** The backend runs as user `node`; migrations run in a
  one-shot `migrate` container; the frontend is static files on unprivileged nginx.
- **Start order is enforced**, not hoped for: `depends_on` with health conditions, so `make`
  fails loudly instead of printing URLs that do not answer. Every long-running service has
  `restart: unless-stopped`, a health check and log rotation (3 × 10 MB).
- **Only Caddy is published.** Prometheus, the collector and the exporters stay on the compose
  network; Grafana is reachable only over HTTPS with a generated admin password, no anonymous
  access and no sign-up.
- **No shared secrets in git.** `.env.example` holds placeholders; `make env` generates random
  values per machine.
- **Deploy needs only Docker.** Node, pnpm and linters are for development and CI; no Nix, no
  global installs.

<a id="continuous-integration"></a>
**Continuous integration** ([`.github/workflows/ci.yaml`](.github/workflows/ci.yaml)), on pull
requests and pushes to `staging` / `master`:

1. **checks** — [`scripts/ci.sh`](scripts/ci.sh) on Node 22 (same as `make ci`): actionlint,
   yamllint, hadolint, `prisma validate`, build of both apps, backend unit + integration tests.
2. **deploy** — `make check`, then `make` on a clean runner, `make smoke` (12 checks over
   HTTPS) and the Playwright compose smoke suite (login through the proxy with zero browser
   console errors).

## Database schema

Klass is multi-tenant around **Organization**. Every user belongs to exactly one organization
(`organizationId`, email unique per org). Identity lives in `User`, `Session` (refresh tokens),
`OAuthAccount` (Google) and `Friendship`. Platform admins use `platformRole` and a separate
`/platform` login; inside a tenant, `GlobalRole` is `ADMIN`, `TEACHER` or `STUDENT`.

Content hangs off the org: `Course` (cohort) → `Subject` → `Section` / `Lesson`, plus
`CourseMembership` and `SubjectStaff`. Materials also use `LearningResource` / `SubjectResource`
(library) and `File` (uploads, avatars). The current task engine is `TaskTemplate` → `Activity` →
`Question` / `Attempt` / `Answer`; the older `Assignment` / `Submission` tables stay for
read/legacy (writes return 410). Side domains: `ForumThread` / `ForumPost`, `Notification`,
`AuditLog`, `OrganizationInvitation`.

Tenancy is enforced in Nest services (queries scoped by organization or course membership), not
with Postgres RLS. The schema is defined in
[`apps/backend/prisma/schema.prisma`](apps/backend/prisma/schema.prisma) (31 models) and versioned
as Prisma migrations in `apps/backend/prisma/migrations` (8 migrations). ER diagrams:
[`docs/diagrams.md`](docs/diagrams.md) (domain map, core ER, assignments ER) and
[`docs/diagrams/ERD.md`](docs/diagrams/ERD.md).

## Features list

<!-- TODO(team): complete list, one line per feature: what it does + who built it. Suggested
     groups: authentication & accounts, organizations & roles, courses & subjects, lessons &
     content, assignments & tests, grades, forums, friends & presence, notifications, files,
     platform back-office, deployment & monitoring. -->

| Feature | Description | Member(s) |
|---|---|---|
| Email/password auth | Register, login, refresh (single-use rotation with reuse detection), logout, email verification, change password; argon2 hashes; JWT access 15m / refresh 7d | Jorge |
| Google OAuth 2.0 | Sign-in with Google, auto-create or link by email, signed single-use `state` | Jorge |
| Organizations and roles | Multi-tenant orgs, invitations, member management, org settings; `ADMIN` / `TEACHER` / `STUDENT` inside the tenant | Jorge |
| Platform back-office | Separate `/platform` login for platform admins; create and manage organizations | Jorge |
| Admin user CRUD | Organization admins list, create, update and deactivate users in their tenant | Jorge |
| Profile and account | Edit name, avatar, notification preference and preferred language; change password | Jorge |
| Database schema and seed | Prisma schema stewardship, migrations and deterministic demo seed | Jorge |
| One-command deployment | `make` builds and starts the whole stack over HTTPS from a clean clone, generates secrets, applies migrations and seeds demo data | Viacheslav |
| HTTPS everywhere | Caddy terminates TLS for the app and Grafana; HTTP redirects to HTTPS; security headers | Viacheslav |
| Monitoring | Prometheus with 10 targets and 11 alerting rules, 3 Grafana dashboards, password-protected Grafana | Viacheslav |
| CI pipeline | linters, build, 362 backend tests, real deployment + smoke + browser test on every pull request | Viacheslav |
| Real-time channel | Socket.io gateway authenticated with the user's JWT; one room per user; live notification push, presence and analytics refresh; clean handling of connect/disconnect (presence is only broadcast on the first and last socket of a user) | David |
| Notifications | Persisted notifications with a bell, unread counter, toasts, a notification page and deep links; emitted on grading, forum replies, friend requests and content/enrolment changes | David |
| Activities and attempts | Unified task engine: quizzes, exams and written tasks built from question blocks (multiple choice, true/false, fill the blanks, matching, ordering, short answer, essay, file upload); attempt window and limits, draft autosave and resume, automatic grading with partial credit, manual grading with feedback | David (engine with Jorge) |
| Gradebook and final grade | Per-course gradebook, student grades page, weighted course final grade, CSV export with formula-injection protection | David |
| Forums | Threads and nested replies per subject, pinning, search, reply notifications | David |
| Friends and presence | Search people in your organization, send/accept/reject/cancel/remove friend requests, live online status | David |
| Analytics dashboard | Course KPIs, submissions over time, grade distribution, date range, CSV and print-to-PDF export, live refresh when an attempt is submitted or graded | David |
| Secure file access | Downloads are authorised per owner (course member, author, library, avatar) and served through short-lived HMAC-signed URLs; no public `/uploads` | David / Aloiki |
| Auth hardening | Refresh tokens verified before any revocation, signed single-use OAuth `state`, rate limiting with `429 + Retry-After` | David / Jorge |

## Modules

<!-- TODO(team): confirm the list, the points and write 2–4 lines per module: justification,
     how it was implemented, who did it. The Monitoring row is done. Need 14 points. -->

| Module | Type | Points | Member(s) | Implementation |
|---|---|---|---|---|
| Use a framework for both frontend and backend | Major | 2 | <!-- TODO --> | React 19 (Vite) + NestJS 10 <!-- TODO: justify --> |
| Real-time features with WebSocket | Major | 2 | David | Socket.io gateway with JWT handshake, per-user rooms, live notifications, presence to friends and live analytics; connect/disconnect handled; efficient targeted broadcasting (see below) |
| Use an ORM for the database | Minor | 1 | Jorge | Prisma 6 over PostgreSQL 16 (typed client, migrations, seed) — see below |
| Standard user management | Major | 2 | Jorge | register/login/refresh/logout, profile, admin user CRUD, seed — see below |
| Advanced permissions / RBAC | Major | 2 | Jorge | `GlobalRole` + `PlatformRole`, guards, tenant-scoped queries — see below |
| Organization system | Major | 2 | Jorge | orgs, invitations, members, platform back-office — see below |
| Notification system | Minor | 1 | David | Persisted, real-time notifications for the create/update/delete actions of tasks, content, subjects, enrolments, forum, library and users (see below) |
| Advanced analytics dashboard | Major | 2 | David | Interactive line/bar charts, live refresh, date range filter, CSV and PDF export (see below) |
| File upload | Minor | 1 | Aloiki | <!-- TODO --> |
| OAuth 2.0 authentication (Google) | Minor | 1 | Jorge | Passport Google strategy, link-by-email, signed `state` — see below |
| **Monitoring system (Prometheus + Grafana)** | Major | 2 | Viacheslav | see below |
| **Total** | | **18** | | |

**Real-time features with WebSocket (Major).** *Justification:* a learning platform is full of
things that change under the user's feet (a grade is published, a teacher posts a task, a friend
comes online); polling would be wasteful and slow. *Implementation:* a Socket.io gateway
(`apps/backend/src/realtime`) authenticates the handshake with the access JWT, joins each socket
to a `user:<id>` room and pushes `notification:new`, `presence:update` and `analytics:update`
only to the people concerned. Presence counts sockets per user in memory and broadcasts only on
the first connection and the last disconnection, so a user with three tabs causes two events, not
six. The frontend keeps one connection (`useNotificationsSocket`, `PresenceProvider`) and
reconnects automatically. *Limit we know about:* the socket counter is per process; running
several backend replicas would need a shared store such as Valkey.

**Notification system (Minor).** *Implementation:* `NotificationsService.emit/emitMany` persist
the row and publish an event; the gateway pushes it live. Emitters sit in the services that
create, update or delete tasks, course content, subjects/cohorts, enrolments, forum threads,
library resources and users, never notify the actor, deduplicate recipients and cannot break the
action if they fail. The UI has the bell, unread counter, toasts, a page with deep links and
mark-all-read.

**Advanced analytics dashboard (Major).** *Justification:* teachers need to see how a course is
going without opening every attempt. *Implementation:* `apps/backend/src/analytics` aggregates
attempts with `groupBy`/`aggregate` (no N+1), always filtered by organization and gated to the
staff of the subject; grades use each student's best graded attempt normalised to the activity's
maximum score. The frontend draws hand-made SVG line and bar charts with tooltips (we avoided a
chart library that still depends on `findDOMNode`, removed in React 19), a date-range filter
(maximum 366 days), CSV export that honours the selected range and a print stylesheet for PDF.
When a student submits or a teacher grades an attempt, the backend emits an event and the open
dashboard refreshes by itself.

**Monitoring system (Major).** *Justification:* the stack has 12 containers; without metrics and
alerts a failing service is found by users, not by the team. *Implementation:* the NestJS backend
is instrumented with the OpenTelemetry SDK (HTTP server histograms, V8 heap, GC, event-loop lag)
and pushes OTLP to an OpenTelemetry Collector, which remote-writes to Prometheus. Prometheus also
scrapes node-exporter (host), postgres-exporter (database), blackbox-exporter (HTTP probes of
backend, frontend and Caddy), Caddy, Garage and the monitoring stack itself: 10 targets. Eleven
alerting rules cover target down, failed health probe, PostgreSQL down, backend 5xx rate and p95
latency, event-loop saturation, connection pool, host CPU / memory / disk and telemetry export
failures. Grafana is provisioned from the repo with three dashboards (Platform overview, NestJS
backend, Infrastructure) and the Prometheus data source; it is served over HTTPS through Caddy
with a generated admin password, no anonymous access and no sign-up, and nothing else of the
monitoring stack is published. Configuration: [`infra/monitoring/`](infra/monitoring/).
*Demo:* `docker compose stop backend` → the `ServiceProbeFailed` alert fires in about 90 seconds;
`docker compose start backend` → it resolves.

**Use an ORM for the database (Minor).** *Justification:* hand-written SQL across 30+ models would
have been slow and error-prone for a team that ships features in parallel. *Implementation:* Prisma 6
(`apps/backend/prisma`) owns the schema, migrations and a typed client injected into Nest services;
the seed is idempotent (`make db-seed`) so every developer and CI start from the same rows. I keep
the schema consistent when others need new models (activities, library, …) so migrations stay ordered.

**Standard user management (Major).** *Justification:* an LMS without accounts, profiles and admin
user tools is a demo, not a product. *Implementation:* `apps/backend/src/auth` and `users` cover
register/login/refresh/logout, email verification, change password, `GET/PATCH /users/me`, admin
user CRUD and the friends API surface that David’s presence UI consumes. Passwords are argon2; DTOs
are validated with class-validator; the seed ships a demo org with admin/teacher/student so the rest
of the team is never blocked. Frontend: auth pages, admin users and profile/account flows under
`apps/frontend/src/features/{auth,admin}`.

**Advanced permissions / RBAC (Major).** *Justification:* the same API must serve platform admins,
org admins, teachers and students without leaking another tenant’s data. *Implementation:*
`apps/backend/src/common/auth` exports `AuthUser`, `@CurrentUser()`, `AppAuthGuard` (global JWT with
a prod-blocked `DevAuthGuard` fallback), `@Roles()` / `RolesGuard` for `GlobalRole`, and platform
role guards for `/platform`. Every sensitive query is scoped by `organizationId` or course/subject
membership; services refuse cross-tenant ids instead of trusting the client.

**Organization system (Major).** *Justification:* Klass sells to academies, not to a single school,
so tenancy is a first-class module. *Implementation:* `apps/backend/src/organizations` — create/read
org settings, invitations, member list and role changes; platform back-office creates and manages
orgs. Frontend: `/org` settings and members, plus the platform admin shell. Invitations accept into
the right tenant without sharing passwords in chat.

**OAuth 2.0 authentication (Google) (Minor).** *Justification:* students already have Google
accounts; forcing a second password raises drop-off. *Implementation:* Passport Google strategy
(`apps/backend/src/auth/google.strategy.ts`), start at `/api/auth/google`, callback with a signed
single-use `state`, auto-create or link by email to an existing local user, then issue the same JWT
pair as password login. Credentials stay in env; with empty client id/secret the routes stay off.

## Individual contributions

<!-- TODO(Aloiki): what you built, which modules, and the challenges you hit and how you solved
     them. Be specific (the subject asks for honesty here). David's section is done. -->

### Jorge

I owned identity and access end to end: the Prisma schema (steward), email/password auth, Google
OAuth, sessions and refresh rotation, organizations and invitations, RBAC (`GlobalRole` +
`PlatformRole`), admin user CRUD, profile/account (including change password), the platform
back-office login, and the matching frontend under auth/admin/org. Modules I carry: ORM (Minor),
Standard user management (Major), Advanced permissions / RBAC (Major), Organization system (Major)
and OAuth 2.0 (Minor). I also unblocked the team in week one with `common/auth` contracts
(`AuthUser`, guards, `@Roles()`) and a deterministic seed so nobody waited on JWT.

*Challenges.* (1) **Contracts before features**: the frontend expected a six-field `AuthUser` and
specific auth response shapes before the backend existed; aligning the type and `GET /auth/me` early
avoided a rewrite later. (2) **Refresh reuse**: treating refresh tokens as single-use and revoking
the whole session family on reuse closed a theft window we would have missed with a naive rotate.
(3) **Tenant isolation**: every list/get had to filter by org (or course membership); reviews and
tests caught places that trusted a client-supplied `organizationId`. (4) **Unblocking others**:
`DevAuthGuard` (`x-dev-user`, prod-blocked) let Aloiki and David build against real guards before
password login was finished, then disappear once JWT was global.

### David

I owned everything that happens *around* the content: the activities and attempts engine
(question blocks, graders with partial credit, attempt windows and limits, resume and autosave),
grading and the gradebook, forums, notifications, the Socket.io real-time layer with presence,
the analytics dashboard, the friends screen, and later the security hardening of those areas
(authorised file downloads with signed URLs, hidden answer keys, attempt concurrency, CSV
injection). Modules I carry: Real-time WebSockets (Major), Notifications (Minor) and Advanced
analytics (Major), and I contributed to Standard user management (friends and presence).

*Challenges.* (1) **Decoupling real time**: a gateway that every service imports creates circular
dependencies, so services publish domain events and the gateway subscribes. (2) **Concurrency**:
two requests opening the same attempt could exceed the attempt limit; starting an attempt is now a
serializable transaction that resumes the open attempt on conflict, covered by a concurrent-call
test. (3) **Not trusting my own tests**: after the rework a live pass with Playwright found
things unit tests had missed (analytics still read a legacy model and showed zeros; the avatar
upload used the wrong HTTP verb), so every change now goes through a real-stack check. (4)
**Tenant isolation**: every query is scoped by `organizationId` and by course membership; an
audit found a cross-course clone and an answer-key leak, both fixed with regression tests.

### Aloiki

<!-- TODO -->

### Viacheslav (vtrofyme) — DevOps

Took over the infrastructure from the previous DevOps in September 2026 and reworked it so the
deployment and the Monitoring module meet the subject:

- **Compose stack** (`compose.yaml`, `.env.example`, `scripts/gen-env.sh`): moved to the repo
  root, cut the configuration from 96 variables to 22, generated secrets instead of committed
  ones, health checks and ordered start-up for every service, restart policy and log rotation.
- **Images:** backend as a non-root single-process container with migrations in a one-shot
  `migrate` service; frontend as a static build on unprivileged nginx (258 MB → 49 MB);
  `.dockerignore`.
- **HTTPS and edge** (`infra/caddy/Caddyfile`): published ports reduced from 6 to 3, security
  headers, compression, HTTP → HTTPS redirect, Google OAuth callback routed under `/api`.
- **Monitoring module:** exporters, 11 alerting rules, three dashboards, OpenTelemetry pipeline
  from the backend, secured Grafana. Removed Tempo and Loki when the team decided metrics were
  enough, which also dropped two containers and a backend dependency.
- **Makefile and scripts:** working `up` / `down` / `re`, idempotent seeding, `smoke` (12 HTTPS
  checks), `check` (config validation), `reload`, `urls`.
- **CI:** backend unit and integration tests in the pipeline; a `deploy` job that runs `make`,
  the smoke test and a Playwright login on every pull request; Nix replaced by plain actions.
- **Documentation:** [`docs/infra/README.md`](docs/infra/README.md) (architecture, configuration,
  HTTPS, monitoring, CI, troubleshooting) and the Instructions section of this file.

*Challenges.* The previous stack came up but hid failures: `make up` and `make down` were no-ops,
every `make` re-seeded the database, and the one scrape target that was down was invisible.
Rebuilding it around health checks and `depends_on` conditions made failures visible at deploy
time. Backend metrics had to be pushed rather than scraped because the app exposes no `/metrics`
endpoint; the OpenTelemetry Collector with Prometheus remote-write solved that. Google OAuth could not be verified end-to-end without the team's client credentials.

## Resources

<!-- TODO(team): add the references you used for the frontend, backend, Prisma and the modules,
     and describe your use of AI (which tasks, which parts). -->

### Documentation and references

- 42 subject: `ft_transcendence` v21.1.
- [NestJS documentation](https://docs.nestjs.com/) · [Prisma documentation](https://www.prisma.io/docs) · [React](https://react.dev/) · [Vite](https://vite.dev/guide/)
- [Docker Compose specification](https://docs.docker.com/compose/compose-file/) and [Compose `depends_on` conditions](https://docs.docker.com/compose/how-tos/startup-order/)
- [Caddy documentation](https://caddyserver.com/docs/) (automatic HTTPS, `reverse_proxy`, internal CA)
- [Prometheus: configuration](https://prometheus.io/docs/prometheus/latest/configuration/configuration/), [alerting rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/), [Blackbox exporter](https://github.com/prometheus/blackbox_exporter), [node_exporter](https://github.com/prometheus/node_exporter), [postgres_exporter](https://github.com/prometheus-community/postgres_exporter)
- [Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/) (data sources and dashboards as code)
- [OpenTelemetry JS SDK](https://opentelemetry.io/docs/languages/js/) and [Collector configuration](https://opentelemetry.io/docs/collector/configuration/), Prometheus remote-write exporter
- [GitHub Actions documentation](https://docs.github.com/en/actions), [actionlint](https://github.com/rhysd/actionlint), [hadolint](https://github.com/hadolint/hadolint)
- [Docker security: non-root containers](https://docs.docker.com/engine/security/), `nginx-unprivileged` image

### Use of AI

<!-- TODO(Aloiki): your part. -->

- **Jorge:** Coding assistants (Claude Code and Grok) were used as a pair-programmer for Nest
  modules, Prisma schema/migrations, specs under `docs/superpowers/`, and the unit/E2E tests around
  auth and organizations. Rules: write the design/acceptance criteria first; read and adjust every
  diff by hand; keep the backend suite green before merging; agents never touched infrastructure,
  secrets, or someone else’s module without a human review.

- **David:** Claude Code (Anthropic) was used as an orchestrator that reads the code base, writes
  design notes and reviews diffs, and OpenAI Codex agents (several in parallel, each in its own git
  worktree) implemented scoped changes. We used them for the activities engine, the analytics
  rewrite, security fixes found by an audit and the friends/avatar screens. Rules we followed:
  every task had written acceptance criteria; nothing was merged without reading the diff, running
  the unit tests and checking the behaviour on the running stack (several agent mistakes were
  caught that way, for example an over-strict id validator and a wrong HTTP method); and the
  agents never touched infrastructure or secrets.

- **Infrastructure (Viacheslav):** Claude Code (Anthropic) was used as a pair-programmer for the
  infrastructure rework: drafting `compose.yaml`, the Makefile, the Caddyfile, Prometheus
  alerting rules and Grafana dashboard JSON, the CI workflow, `docs/infra/README.md` and this
  Instructions section, and for reviewing the previous stack against the subject. Every change
  was read, adjusted and verified by hand (`make` from a clean clone, `make smoke`, alert firing
  and resolving, CI runs). Design decisions (Caddy instead of nginx, OTLP push instead of a
  `/metrics` endpoint, what is published, what was removed) were made by the team.

## License

[`LICENSE`](LICENSE).
