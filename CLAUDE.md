# CLAUDE.md

Guidance for Claude Code working in this repository.

## Read this first

**[`AGENTS.md`](./AGENTS.md) is the canonical engineering guide** — stack, conventions,
data-layer rules, module strategy, commands, and known gaps all live there. Read it before
making changes. This file only adds Claude-Code-specific notes; if the two ever disagree,
AGENTS.md wins.

## The 20-second version

- 42 final project, subject **v21.1 "Surprise"** (free choice — **no mandatory Pong**).
- We're building a **Learning Management System**. Target **14 module points** (Major=2, Minor=1).
- Monorepo: **Vite+React 19** frontend, **NestJS 10** backend, **Prisma + Postgres**, full
  **OTel→Prometheus/Tempo/Loki/Grafana** observability. Node 22, pnpm 9.15, Nix devShells.
- `MVP_DESIGN.md` is partly **stale** (says 18 pts / Next.js / old module names) — don't trust
  it over AGENTS.md.

## Team, branches & who does what

4 people: **3 app devs + 1 DevOps.** Each has a deep task brief in `docs/planning/`:

- **Jorge** `@SrJorgeG` → [`docs/planning/Jorge.md`](./docs/planning/Jorge.md) · Identity & Access · branch `jorge`
- **Aloiki** `@illia` → [`docs/planning/Aloiki.md`](./docs/planning/Aloiki.md) · Content & UX · branch `aloiki`
- **David** `@dacs-dev` → [`docs/planning/David.md`](./docs/planning/David.md) · Interaction · branch `david`
- **Ale Pinto** → [`docs/planning/Ale.md`](./docs/planning/Ale.md) · **DevOps/Infra** · branch `ale`

If you're working as one of them, that file is your brief. **App devs never touch `infra/`,
`.github/`, `scripts/`, `Makefile`, `flake.nix` — that's Ale's.** Trunk is `master`; work on your
branch and merge **personal → `staging` → `master`** (never straight to `master`). Combined plan +
directory-ownership map: [`docs/planning/README.md`](./docs/planning/README.md).

## Locked decisions (don't relitigate without the user)

1. Frontend is **Vite + React SPA**, not Next.js.
2. **English** identifiers in DB and code.
3. **Prisma** with tenant isolation in the **app layer** (no Postgres RLS).
4. **Simplified organization** multi-tenant for the MVP — no subdomains, RLS, or billing yet.

## Working here

- Prefer the **Makefile** (`make up`, `make down`, `make logs`). Full dev stack +
  observability comes up with `make up`. Ports/URLs live in `infra/docker/.env.example`.
  Local Nix is **nix-portable** (`make dev` / `make ci`), not a system Nix install.
- **Every tenant-scoped DB query must filter by `organizationId`** — a missing filter is a
  security bug, not a style nit.
- Keep `import './telemetry/otel-sdk'` as the **first line of `apps/backend/src/main.ts`**.
- Validate inputs in **both** frontend and backend — it's a mandatory requirement.
- Don't commit secrets. `infra/docker/.env.example` is the committed contract; real values go in gitignored `infra/docker/.env`.
- When you touch modules/points or the schema, re-check the real rules in `en.subject.pdf`, not
  MVP_DESIGN.

## Don't

- Don't add Postgres RLS, per-tenant subdomains, billing, attendance, certificates, calendar, or
  a full quiz engine until their feature is actually in scope (Phase 2 — see AGENTS.md §5).
- Don't claim a 42 module as done unless it's fully functional (half-built = 0 points).
- Don't reintroduce Redis/MongoDB (license policy — use Valkey/Postgres).
- Don't expand `.pnpm-store/` tracking; it should be removed from git, not grown.

## Memory

Durable project context lives in this session's memory dir (see `MEMORY.md` there):
`project-overview` and `stack-reality-vs-design-doc`. Update those when locked decisions or the
scaffold materially change.
