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

## Epic 2 — Email/password auth (NEXT — spec not yet written)

> **Status:** Not started. **Brainstorm + spec required before code.**
> Must produce: `docs/superpowers/specs/2026-07-XX-epic2-email-password-auth-design.md`.

- [ ] **Brainstorm + write spec** before touching code.
- [ ] Migrate Aloiki's `courses.controller.ts` + `files.controller.ts` from `@Query(organizationId)`
      to `@CurrentUser()` **before** adding global `APP_GUARD`.
- [ ] `apps/backend/src/auth/` — `auth.module.ts`, `auth.controller.ts`, `auth.service.ts`,
      `dto/{register,login,refresh}.dto.ts` (class-validator).
- [ ] Password hashing: `argon2` (already installed in Epic 1). Never store plaintext; salted by argon2.
- [ ] `POST /auth/register` (email unique per org), `POST /auth/login`, `POST /auth/refresh`,
      `POST /auth/logout`. Access JWT (15 min) + refresh JWT (7 d); store refresh **hash** in
      `Session`. **`POST /auth/login` response shape** (matches
      `apps/frontend/src/lib/api/auth-context.tsx:150-166`): `{ user: AuthUser; accessToken:
      string; refreshToken: string }`.
- [ ] Refresh-token rotation + revoke on logout. `POST /auth/refresh` returns
      `{ accessToken, refreshToken }`.
- [ ] **`GET /auth/me` → `AuthUser` directly** (not wrapped — the frontend calls
      `apiClient.get<AuthUser>('/auth/me')` and `setUser(currentUser)` in `auth-context.tsx:107-115`).
- [ ] Email verification token (dev: log the link; real email is Ale's SMTP later).
- [ ] Switch frontend from mock auth to real: turn off `VITE_USE_MOCK_AUTH`, use `VITE_DEV_USER_ID` only for DevAuthGuard fallback.

## Epic 3 — Google OAuth (module: OAuth ✓)

- [ ] `passport-google-oauth20` (add deps). `GET /auth/google` + `GET /auth/google/callback`.
- [ ] On callback: find/create `OAuthAccount` + `User`, issue our JWTs, redirect to frontend with
      tokens.
- [ ] Config via `ConfigService`: `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` (already in `.env.example`).

## Epic 4 — Organizations (module: Organization system ✓)

- [ ] `apps/backend/src/organizations/` — module/controller/service + DTOs.
- [ ] `GET/POST/PATCH/DELETE /organizations` (create/read/update/delete).
- [ ] Membership: `POST /organizations/:id/members` (add), `DELETE /organizations/:id/members/:userId`.
- [ ] Actions scoped: a user only sees/acts within their `organizationId`.

## Epic 5 — Advanced permissions / admin (module: Advanced permissions ✓)

- [ ] `apps/backend/src/users/` — admin user CRUD: `GET/POST/PATCH/DELETE /users` (org-scoped,
      `@Roles('ADMIN')`).
- [ ] Role management: change a user's `GlobalRole`; different responses/fields per role.
- [ ] Guard matrix documented (who can hit what) in this file when done.

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
