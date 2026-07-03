# MVP Work Plan — ft_trascendence

Work plan for the **MVP phase** (~3 weeks), split across **3 developers** so we can work in
parallel with minimal merge conflicts. Read this first, then your own file:

- [`dacs-dev.md`](./dacs-dev.md) — **Ops & Interaction** (DevOps/infra, evaluations, forums, real-time)
- [`SrJorgeG.md`](./SrJorgeG.md) — **Identity & Access** (auth, OAuth, RBAC, organizations)
- [`illia.md`](./illia.md) — **Content & UX** (frontend shell + design system, courses, content, files)

Product & module context lives in [`../../AGENTS.md`](../../AGENTS.md) and
[`../../MVP_DESIGN.md`](../../MVP_DESIGN.md). We target **14 module points** (planned ~16).

> ⚠️ `MVP_DESIGN.md` was written for a 4-person team. This plan supersedes it for task
> distribution (we are 3).

## How the split works

Each person owns a **coherent vertical** (backend module(s) + their frontend screens + tests).
Ownership is by **directory**, so two people rarely touch the same file. Module *points* are not
evenly split (courses/evaluations are big product features mapped to few explicit points) — but
*workload* is roughly balanced.

### Directory ownership (avoid editing outside your lane without a heads-up)

| Area | Owner | Backend (`apps/backend/src/`) | Frontend (`apps/frontend/src/`) |
|---|---|---|---|
| Identity & Access | **SrJorgeG** | `auth/`, `users/`, `organizations/`, `permissions/`, `prisma/` | `features/auth/`, `features/admin/`, `features/org/` |
| Content & UX | **illia** | `courses/`, `sections/`, `lessons/`, `enrollments/`, `files/`, `storage/` | `app/` (shell/router/layout), `components/ui/` (design system), `features/courses/`, `features/profile/` |
| Ops & Interaction | **dacs-dev** | `assignments/`, `submissions/`, `forums/`, `notifications/`, `realtime/` | `features/gradebook/`, `features/forums/`, `features/notifications/` | 
| Infra / CI | **dacs-dev** | — | — |

dacs-dev also owns `infra/**`, `.github/**`, `scripts/**`, `Makefile`, `flake.nix`.

### Shared files — coordinate before editing (announce in the team channel)

- **`apps/backend/prisma/schema.prisma`** — **SrJorgeG is the steward.** Need a model/field?
  Open a small PR or ping Jorge; don't edit in a big feature branch that sits for days. He owns
  migrations (`make db-migrate`).
- **`apps/backend/src/app.module.ts`** — everyone registers their Nest module here. Keep imports
  alphabetical, land these edits in tiny PRs to avoid conflicts.
- **`package.json` / `pnpm-lock.yaml`** — adding a dep: run `pnpm install`, commit the lockfile,
  land fast.
- **`apps/frontend/src/app/` router** — illia owns it; others add their route lazily and PR it in.

## Git workflow (mandatory-part: commits from everyone, clean history)

- Branch per task: `feat/<area>-<short>` (e.g. `feat/auth-jwt`), PR into `master`.
- Small PRs, review by ≥1 teammate (CODEOWNERS auto-requests). No direct pushes to `master`.
- Conventional commit prefixes already in use: `feat:`, `fix:`, `infra:`, `chore:`, `docs:`.
- Every PR: no console errors, validation on both ends, feature reachable only by the right role
  and scoped by `organizationId`. (Full DoD in AGENTS.md §8.)

## Sprint 0 — Foundation (✅ done by dacs-dev/Opus, before the split)

Landed so everyone starts on a solid, conflict-free base:

- ✅ Prisma schema (`apps/backend/prisma/schema.prisma`) — validates.
- ✅ Postgres in the dev compose; backend gets `DATABASE_URL`, auto `db push` on boot.
- ✅ Nest foundation: global `PrismaModule`/`PrismaService`, `ConfigModule`, global
  `ValidationPipe`, `/health` DB ping, BigInt→string JSON fix.
- ✅ **Feature-module skeletons pre-registered in `app.module.ts`** — one empty module per owner
  (see the ownership table). Implement *inside* your module folder; you rarely touch
  `app.module.ts` again.
- ✅ `scripts/ci.sh` — CI is green (infra linters + build + prisma validate blocking).
- ✅ Repo hygiene: `.pnpm-store` untracked, CODEOWNERS, root `.env.example`.

## Remaining foundation — Week 1, Days 1–2 (still unblock everyone)

| Task | Owner | Unblocks |
|---|---|---|
| Auth API (register/login/JWT) + `JwtAuthGuard` + `@CurrentUser()` | SrJorgeG | every authenticated route |
| Switch DB to real migrations once schema settles (`make db-migrate NAME=init`) | SrJorgeG | migration history |
| Frontend shell: router, auth-guard, app layout, 3 design-system primitives | illia | all frontend screens |
| `StorageService` (Garage/S3 put/get/presign) stub + Garage compose service | illia + dacs-dev | file upload, avatars, submissions |
| Add Caddy/HTTPS reverse proxy | dacs-dev | eval requirement, everyone's PRs |
| Socket.io gateway skeleton + auth handshake | dacs-dev | notifications, presence |

## Dependency map (who waits for whom)

```
SrJorgeG: Prisma+Auth ──► (User/session available)
                           ├──► illia: Courses/Enrollment/Profile
                           └──► dacs: Evaluations/Forums (need users+courses)
illia: StorageService ──► illia: File upload ──► dacs: Submission files
                                              └──► illia: Lesson attachments / avatars
dacs: Socket.io gateway ─► dacs: Notifications ─► everyone emits events
illia: Frontend shell ──► everyone's screens
```

Rule of thumb: **Week 1** = foundations + your module's backend API; **Week 2** = wire frontend +
cross-feature integration; **Week 3** = polish, multi-user testing, Privacy/ToS, README, demo.

## Definition of Done & mandatory gates

Before the MVP is "done", these subject-mandatory items must be green (owner in parens):
`docker compose up` single command (dacs) · HTTPS everywhere (dacs) · multi-user no races (all) ·
email+password hashed+salted (SrJorgeG) · Privacy Policy + ToS pages (dacs) · validation front+back
(all) · zero console errors (all) · `.env`/`.env.example` (done) · README with team roles + module
justification (all, PO-led).
