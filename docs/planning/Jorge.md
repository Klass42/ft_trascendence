# Jorge (@SrJorgeG) — Identity & Access · Tech Lead

> **Your file.** This is your working brief. Read `../../AGENTS.md` for shared conventions and
> `./README.md` for the methodology. Work on branch **`jorge`** (based on `master`); merge to
> `staging` before `master`.

**Theme:** who a user is and what they can do — auth, OAuth, users, organizations, permissions.
As Tech Lead you are the **Prisma schema steward** and review auth/permissions PRs.

**Prisma models you own:** `User`, `Session`, `OAuthAccount`, `Organization`, `Friendship`.

**Directories you own:**
`apps/backend/src/{common/auth,auth,users,organizations}` ·
`apps/frontend/src/features/{auth,admin,org}` · `apps/backend/prisma/` (schema + seed + migrations).

**Contracts YOU provide (Week 1, unblock everyone — do these first):**
- `common/auth/` — `AuthUser` type, `@CurrentUser()`, `JwtAuthGuard`, `@Roles()`, `RolesGuard`.
- `prisma/seed.ts` — deterministic seed so everyone has data.

**Contracts you consume:** Aloiki's `FilesService` (avatar upload) — use its interface; David's
`NotificationsService.emit()` (friend request notifications) — optional, no-op is fine.

---

## Epic 1 — Auth contracts + seed (Week 1, TOP PRIORITY, unblocks all) ✅ DONE

> Design spec: `docs/superpowers/specs/2026-07-09-epic1-auth-contracts-seed-design.md`.
> Progress log: `docs/planning/desarrollo_jorge.md`.
> **Status:** Complete. 10 commits (`e4142030..7bb07c3a`) on `jorge`, PR #2 → `staging`.
> **Tests:** 13 unit tests, 4 suites, 0 failures.
> **Runtime:** `make up` + `make db-seed` verified — 8 rows with `$argon2id$v=` hashes, `/health` 200.

Delivered:
- ✅ `common/auth/auth-user.type.ts` — `AuthUser` 6 fields (frontend-aligned).
- ✅ `common/auth/current-user.decorator.ts` — `@CurrentUser()` factory decorator (500 on programming error).
- ✅ `common/auth/jwt-auth.guard.ts` + `jwt.strategy.ts` — passport-jwt, complete but inert (activates in Epic 2).
- ✅ `common/auth/dev-auth.guard.ts` — `x-dev-user` header → Prisma → `req.user`; **prod-blocked** (`NODE_ENV==='production'` → `return false`).
- ✅ `common/auth/roles.decorator.ts` + `roles.guard.ts` — `@Roles('ADMIN')`, `RolesGuard` via `Reflector.getAllAndOverride`.
- ✅ `common/common.module.ts` — `@Global`, `JwtModule.registerAsync`, exports guards + JwtModule. Wired into `app.module.ts`.
- ✅ `prisma/seed.ts` — stable IDs (`org-klass-0001`, `user-*-0001`), argon2 `demo1234`, `emailVerifiedAt` set, `Course` PUBLISHED `KLASS123`, upsert idempotent.
- ✅ `make db-seed` Makefile target.
- ✅ JWT env vars added to `infra/docker/docker-compose.dev.yml` (dev placeholders — Ale to review).

**Teammates can now use:**
```ts
@UseGuards(DevAuthGuard)
@Get('something')
getThing(@CurrentUser() user: AuthUser) { ... }

@UseGuards(DevAuthGuard, RolesGuard)
@Roles('ADMIN')
@Get('admin')
getAdmin(@CurrentUser() user: AuthUser) { ... }
```
Seed: `make db-seed`. Frontend dev: `VITE_DEV_USER_ID=user-student-0001` in `apps/frontend/.env.development`.

## Epic 2 — Email/password auth ✅ DONE

> Design spec: `docs/superpowers/specs/2026-07-10-epic2-email-password-auth-design.md`.
> Implementation plan: `docs/superpowers/plans/2026-07-10-epic2-email-password-auth.md`.
> Progress log: `docs/planning/desarrollo_jorge.md` (Bloque 2).
> **Status:** Complete. 9 commits (`1d6b4537..df31d706`) on `jorge`, pushed to `origin/jorge`.
> **Tests:** 40 tests, 7 suites, 0 failures.
> **Runtime:** `make up` + `curl POST /auth/login` verified — tokens + 6-field AuthUser; APP_GUARD global active (401 without token, 200 with x-dev-user in dev).

Delivered:
- ✅ `auth/auth.controller.ts` — 6 endpoints: `POST /auth/register|login|refresh|logout`, `GET /auth/me|verify-email`.
- ✅ `auth/auth.service.ts` — argon2 hashing, JWT sign (access 15m / refresh 7d), Session CRUD, refresh single-use rotation with reuse detection (revokes all sessions on reuse), email verification token (dev auto-verify, prod logs link).
- ✅ `auth/dto/{register,login,refresh}.dto.ts` — class-validator (password ≥8 + upper/lower/number).
- ✅ `common/auth/public.decorator.ts` — `@Public()` for public route opt-out.
- ✅ `common/auth/app-auth.guard.ts` — composite guard: JWT first, DevAuthGuard fallback in non-prod, `@Public()` skip. Registered as `APP_GUARD` globally.
- ✅ `common/common.module.ts` — added `AppAuthGuard` + `JwtAuthGuard` to providers/exports.
- ✅ `app.module.ts` — `APP_GUARD` registered.
- ✅ `courses/courses.controller.ts` — migrated from `@Query('organizationId')` to `@CurrentUser()`.
- ✅ `files/files.controller.ts` — migrated from `CreateFileDto` body to `@CurrentUser()`; `create-file.dto.ts` deleted.
- ✅ `courses/dto/create-course.dto.ts` — removed `organizationId` field.
- ✅ E2E tests (`auth.e2e.spec.ts`) — login, me, register validation, dev header, 401 guard.

**Frontend can now switch to real auth:** set `VITE_USE_MOCK_AUTH=false` in
`apps/frontend/.env.development`, log in with `student@demo` / `demo1234`.
`VITE_DEV_USER_ID` stays as dev fallback (AppAuthGuard accepts x-dev-user in dev).

**Teammates:** All endpoints now require auth by default (APP_GUARD global).
Use `@Public()` for public routes. `@CurrentUser()` works everywhere without
`@UseGuards()` (the global guard handles it).

## Epic 3 — Google OAuth (module: OAuth ✓) ✅ DONE

> Design spec: `docs/superpowers/specs/2026-07-10-epic3-google-oauth-design.md`.
> Implementation plan: `docs/superpowers/plans/2026-07-10-epic3-google-oauth.md`.
> Progress log: `docs/planning/desarrollo_jorge.md` (Bloque 3).
> **Status:** Complete. 6 commits on `jorge`, pushed. Merged to `staging` via PR #2.
> **Tests:** 45 tests, 8 suites, 0 failures.
> **Runtime:** Routes mapped (`/auth/google`, `/auth/google/callback`). Boots without real Google
> credentials (uses fallback). Login with email/password unaffected.

Delivered:
- ✅ `auth/google.strategy.ts` — passport-google-oauth20, scopes email+profile, `config.get()` fallbacks.
- ✅ `auth/auth.service.ts` — `googleLogin(profile)` auto-create + auto-link by email match.
- ✅ `auth/auth.controller.ts` — `GET /auth/google` + `GET /auth/google/callback` with hash fragment redirect.
- ✅ `common/common.module.ts` — GoogleStrategy registered.
- ✅ Env: `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` + `FRONTEND_URL` added to compose + .env.example.
- ✅ 5 new tests (2 strategy + 3 googleLogin).

**Notes:** Real Google Cloud Console credentials required to test the full OAuth flow. App
boots fine without them (fallback values prevent crash). Google login will 400 if creds are
empty — acceptable for dev.

## Epic 4 — Organizations (module: Organization system ✓)

> Design spec: `docs/superpowers/specs/2026-07-11-epic4-organizations-design.md`.
> Implementation plan: `docs/superpowers/plans/2026-07-11-epic4-organizations.md`.
> **Status:** Spec + plan written. Implementation pending (4 tasks).

Delivered (pending):
- [ ] `GET /organizations/me` — any user sees their org.
- [ ] `PATCH /organizations/:id` — ADMIN only, name/logoUrl editable.
- [ ] `GET /organizations/:id/members` — ADMIN only, excludes passwordHash.
- [ ] `DELETE /organizations/:id/members/:userId` — ADMIN only, no self-deletion.
- [ ] `@Roles('ADMIN')` + `RolesGuard` on admin endpoints, `@CurrentUser()` for org scope.
- [ ] No new schema models, no new guards, no `POST /organizations` (Phase 2).

## Epic 5 — Advanced permissions / admin (module: Advanced permissions ✓)

> Design spec: `docs/superpowers/specs/2026-07-11-epic5-admin-user-crud-design.md`.
> Implementation plan: `docs/superpowers/plans/2026-07-11-epic5-admin-user-crud.md`.
> **Status:** Spec + plan written. Implementation pending (4 tasks).

Delivered (pending):
- [ ] `GET /users` + `GET /users/:id` — ADMIN only, org-scoped, no passwordHash.
- [ ] `POST /users` — ADMIN creates user in org, argon2 hashed, default STUDENT.
- [ ] `PATCH /users/:id` — ADMIN updates name/email/role/bio, 403 org mismatch, 400 self-role-change.
- [ ] `DELETE /users/:id` — ADMIN deletes user, 403 org mismatch, 400 self-delete.
- [ ] Guard matrix: all endpoints `@Roles('ADMIN')` + `@CurrentUser()` for org scope.

## Epic 6 — Users profile API + friends

- [ ] `GET /users/:id` (profile), `PATCH /users/me` (name/bio), `PATCH /users/me/avatar`
      (calls Aloiki's `FilesService.createUpload`, stores `avatarUrl`).
- [ ] Friends: `POST /users/:id/friend` (request), `PATCH /friendships/:id` (accept/block),
      `GET /users/me/friends`. Emits a notification via David's `emit()` (optional).
- [ ] (Online status is set by David's presence service — you just expose `onlineAt` in the
      profile response.)

## Epic 7 — Frontend (features/auth, admin, org)

- [ ] `features/auth/`: login + register pages (client-side validation), Google button, token
      storage via Aloiki's API client, protected-route redirect.
- [ ] `features/admin/`: user list + role editor (ADMIN only).
- [ ] `features/org/`: organization settings + member management.
- [ ] Use Aloiki's `components/ui` + `app/` router. Register your routes lazily.

## Epic 8 — 2FA TOTP (stretch, only if core solid) — module: 2FA (Minor)

- [ ] `otplib` + QR; `POST /auth/2fa/enable|verify|disable`; enforce on login when enabled.

## Module points you carry
ORM (1) · Organization system (2) · Advanced permissions (2) · OAuth (1) · Standard user mgmt —
backend half (part of 2). 2FA (1, stretch).

## Reminders
- **Missing `organizationId` filter = security bug** (AGENTS.md §5). You set the example.
- Passwords **hashed + salted** (argon2) — mandatory gate.
- You own migrations: dev uses `db push`; once the schema settles, `make db-migrate NAME=...` and
  commit `prisma/migrations/`. Batch schema changes so teammates don't thrash.
- Keep `import './telemetry/otel-sdk'` first in `main.ts`.
