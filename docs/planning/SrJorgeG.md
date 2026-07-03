# SrJorgeG — Identity & Access (Tech Lead)

**Theme:** everything about *who a user is and what they're allowed to do*. You're also Tech Lead:
schema steward, architecture calls, and critical-code reviewer.

**42 module points you own (~6):** Web: ORM (1) · User Mgmt: OAuth (1) · User Mgmt: Advanced
permissions (2) · User Mgmt: Organization system (2). You co-own the Web framework Major (backend).

**You own these directories:**
`apps/backend/src/{prisma,auth,users,organizations,permissions}` ·
`apps/frontend/src/features/{auth,admin,org}` · **steward of** `apps/backend/prisma/schema.prisma`
and migrations.

**Cross-team responsibilities (Tech Lead):**
- You are the **only person who runs `make db-migrate`** and commits migrations. Others request
  schema changes via small PRs — batch them so the schema doesn't thrash.
- Review critical PRs (auth, permissions, anything touching `organizationId` scoping).

---

## Week 1 — Auth API

- [x] ~~`PrismaModule` + `PrismaService` wired globally~~ ✅ done in Sprint 0 (foundation).
      Just inject `PrismaService`.
- [x] ~~Global `ValidationPipe`, `ConfigModule`~~ ✅ done in Sprint 0. Your DTOs just need
      class-validator decorators.
- [ ] When the schema settles, take over migrations: `make db-migrate NAME=init` and commit
      `apps/backend/prisma/migrations/` (dev currently uses `db push`). You are the schema steward.
- [ ] Password hashing util (argon2 or bcrypt) — **hashed + salted** (mandatory).
- [ ] Auth API: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`.
      JWT **access + refresh**; refresh tokens stored **hashed** in `Session`.
- [ ] `JwtAuthGuard` + `@CurrentUser()` decorator + `organizationId` resolution on every request.
- [ ] DTO validation with `class-validator` (backend half of the mandatory front+back validation).
- [ ] Email verification token flow (can stub email sending in dev; log the link).

## Week 2 — OAuth, RBAC, Organizations

- [ ] **OAuth Google** (`passport-google-oauth20`): `/auth/google` + `/auth/google/callback`,
      create/link `OAuthAccount`, issue our JWTs. (module: OAuth ✓)
- [ ] **RBAC / Advanced permissions**: `RolesGuard` + `@Roles()`; admin user CRUD
      (`GET/POST/PATCH/DELETE /users`) scoped to the org; different views per role. (module ✓)
- [ ] **Organization system**: `GET/POST/PATCH/DELETE /organizations`, add/remove members,
      per-org membership + role. (module ✓)
- [ ] Frontend: login + register pages (with client-side validation), OAuth button,
      admin panel (user list + role edit), org management screen. Use illia's design-system
      components + shell/router.

## Week 3 — Hardening, polish, review

- [ ] 2FA TOTP (optional bonus — only if core is solid).
- [ ] Audit every service for **missing `organizationId` filters** (yours and teammates').
- [ ] Security pass with dacs: password rules, token expiry, refresh rotation, brute-force lockout.
- [ ] Lead the README "Modules" section (justify each module) + "Technical Stack" section.
- [ ] Final review of auth/permissions PRs; multi-user concurrency testing with the team.

## You depend on / you unblock

- **Unblock:** everyone — Prisma + auth must land Day 1–2. Treat it as top priority.
- **Depend on:** illia's frontend shell + design-system primitives for your screens (Week 2).
- **Coordinate:** `app.module.ts` (module registration), `schema.prisma` (you're steward).

## Reminders

- Missing `organizationId` filter = **security bug**, not a nit (AGENTS.md §5).
- Keep `import './telemetry/otel-sdk'` first in `main.ts`.
- English identifiers; Prisma is the source of truth (never hand-edit the DB).
