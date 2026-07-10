# Epic 2 — Email/password auth (Design Spec)

**Owner:** Jorge (@SrJorgeG) — Identity & Access, Tech Lead
**Branch:** `jorge` → `staging` → `master`
**Date:** 2026-07-10
**Status:** Approved
**Scope:** Only Epic 2 of `docs/planning/Jorge.md`. Epics 3–8 are out of scope and get their own specs.

---

## 1. Purpose

Deliver the email/password authentication flow the frontend already consumes:
`POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`, `POST /auth/logout`,
`GET /auth/me`, and `GET /auth/verify-email`. Activate a **global composite auth guard**
(`AppAuthGuard`) that enforces authentication on every endpoint by default while keeping
the `x-dev-user` dev bypass alive in non-production. Migrate Aloiki's `courses` and
`files` controllers from `@Query('organizationId')` to `@CurrentUser()` so tenant
isolation comes from the authenticated identity, not a query string (permission granted
by Aloiki to modify his code in the `jorge` branch).

This unlocks real login for the frontend (turn off `VITE_USE_MOCK_AUTH`) and makes the
API secure-by-default for the upcoming public/market-facing deployment.

## 2. Constraints (hard)

- **Frontend-first alignment.** The frontend `AuthUser` has **6 fields**
  (`userId, email, name, avatarUrl, organizationId, role`) in
  `apps/frontend/src/lib/api/types.ts:10-19`; unchanged in Epic 2. `POST /auth/login`
  returns `{ user: AuthUser; accessToken: string; refreshToken: string }` and
  `GET /auth/me` returns `AuthUser` directly — both shapes already consumed by
  `apps/frontend/src/lib/api/auth-context.tsx`.
- **Passwords hashed + salted** with argon2 (mandatory project gate, already installed
  in Epic 1). Never store plaintext, never log passwords.
- **Refresh tokens never stored raw.** Only `sha256(rawToken)` goes in
  `Session.refreshTokenHash`.
- **`import './telemetry/otel-sdk'` stays the first line of `main.ts`.** Not touched.
- **English-only identifiers**; comments in English; commit bodies may be Spanish.
- **DevAuthGuard blocked in production.** `AppAuthGuard` must never fall back to
  `DevAuthGuard` when `NODE_ENV === 'production'`.
- **Prisma schema unchanged.** The existing `User`, `Session`, `OAuthAccount` models
  (added in Epic 1) already cover everything Epic 2 needs.

## 3. Design decisions (from brainstorm)

| Topic | Decision | Rationale |
|---|---|---|
| Registration model | **D** — `POST /auth/register` auto-assigns to the seeded org (`org-klass-0001`). Org CRUD is Epic 4. | Unblocks login fastest; no "choose org" UI exists yet. |
| Email verification | **B** — Service fully implemented; in dev `emailVerifiedAt = now()` (auto-verify). In prod, `emailVerifiedAt` stays `null` until `/auth/verify-email` is hit; the verification link is logged to console until Ale's SMTP is ready. | Unblocks dev login immediately; production path is coded but deferred via env. |
| Refresh-token rotation | **A** — Single-use with reuse detection. `/auth/refresh` consumes the old session, issues a new pair. If a consumed token is presented again, **all** user sessions are revoked. | OWASP standard; `Session` table already supports it via `refreshTokenHash @unique`. |
| Logout scope | **A** — Invalidates only the current session. Other devices stay logged in. | Expected "Logout" behaviour on one device. A "revoke all" endpoint can be added later. |
| Password rules | **B** — min 8 chars, at least 1 uppercase, 1 lowercase, 1 number. Enforced via class-validator on both DTO. | Reasonable security without frustrating LMS users. Adjustable later. |
| Global guard | **A1** — `APP_GUARD = AppAuthGuard` (composite). Migrate `courses`/`files` to `@CurrentUser()` in this epic. | Project is going to market as a public API; security-by-default is essential now. Aloiki gave permission to modify his controllers. |
| Guard strategy | **Approach 2** — `AppAuthGuard` tries `JwtAuthGuard` first; if that fails and `NODE_ENV !== 'production'`, falls back to `DevAuthGuard` (x-dev-user). `@Public()` skips entirely. | Preserves dev productivity (`VITE_DEV_USER_ID`) while enforcing JWT-only in prod. |

## 4. Endpoints

| Method | Route | Guard | Response |
|---|---|---|---|
| `POST` | `/auth/register` | `@Public()` | `{ user: AuthUser; accessToken: string; refreshToken: string }` |
| `POST` | `/auth/login` | `@Public()` | `{ user: AuthUser; accessToken: string; refreshToken: string }` |
| `POST` | `/auth/refresh` | `@Public()` | `{ accessToken: string; refreshToken: string }` |
| `POST` | `/auth/logout` | `AppAuthGuard` | `204 No Content` |
| `GET` | `/auth/me` | `AppAuthGuard` | `AuthUser` (direct, not wrapped) |
| `GET` | `/auth/verify-email?token=...` | `@Public()` | `{ verified: true }` or redirect to frontend |

### Response shapes (exact — match frontend)

```ts
// POST /auth/login + POST /auth/register
{ user: AuthUser; accessToken: string; refreshToken: string }

// POST /auth/refresh
{ accessToken: string; refreshToken: string }

// GET /auth/me
AuthUser  // direct

// POST /auth/logout
204 No Content (empty body)
```

## 5. Tokens

- **Access token:** JWT, **15 min** expiry, payload `{ sub: userId }`, signed with
  `JWT_ACCESS_SECRET`. The frontend stores it in `localStorage` and sends
  `Authorization: Bearer <accessToken>`.
- **Refresh token:** JWT, **7 days** expiry, payload `{ sub: userId, jti: sessionId }`,
  signed with `JWT_REFRESH_SECRET`. Only `sha256(rawToken)` is stored in
  `Session.refreshTokenHash`; the raw token is returned to the client and never
  persisted server-side.
- Both secrets are already in `.env.example` and `infra/docker/docker-compose.dev.yml`
 (dev placeholders added in Epic 1).

## 6. Auth flows

### 6.1 Register

1. Validate `RegisterDto` (email, password, name) via global `ValidationPipe`.
2. Assign `organizationId` = seeded org (`org-klass-0001` — hard default for MVP).
3. Check uniqueness within org (`@@unique([organizationId, email])` → 409 on conflict).
4. Hash password with `argon2.hash(password)`.
5. Create `User` with `role: STUDENT`.
6. Email verification:
   - `NODE_ENV !== 'production'`: set `emailVerifiedAt = now()` (auto-verify). Log
     the verification link to console for completeness.
   - `NODE_ENV === 'production'`: leave `emailVerifiedAt = null`. Generate a verification
     token — a short-lived (30 min) JWT signed with `JWT_ACCESS_SECRET`, payload
     `{ sub: userId, purpose: 'email-verify' }`. Log the link
     `GET /auth/verify-email?token=...` to console (real SMTP is Ale's later task).
     Login is blocked until verified (403).
7. Create `Session` → issue access + refresh tokens.
   - **In dev:** tokens returned immediately (user is auto-verified → login works).
   - **In prod:** tokens are still returned so the frontend can auto-login the new
     user right after registering. If the user logs out and tries to log back in
     *before* verifying, login returns 403. This is acceptable for the MVP: the
     frontend (Epic 7) will handle the verify-then-login UX; the backend stays
     simple (register always returns tokens, login checks verification).
8. Return `{ user: AuthUser; accessToken; refreshToken }`.

### 6.2 Login

1. Validate `LoginDto` (email, password).
2. Find user by `[organizationId, email]` (seeded org default). If not found → **401**.
3. Verify `argon2.verify(user.passwordHash, password)`. If mismatch → **401**.
4. If `emailVerifiedAt === null` → **403** "Email not verified".
5. Create `Session` → issue access + refresh tokens.
6. Return `{ user: AuthUser; accessToken; refreshToken }`.

### 6.3 Refresh

1. Validate `RefreshDto` (refreshToken string).
2. Hash the incoming token: `sha256(refreshToken)`.
3. Find `Session` by `refreshTokenHash`.
   - **Found & not expired:** delete the old session, create a new one, issue a new
     access + refresh pair. Return `{ accessToken, refreshToken }`.
   - **Not found (consumed/invalid) but JWT decodes to a valid user:** possible token
     reuse/theft → **delete all sessions for that user** and return **401**.
   - **Not found and JWT undecodable:** return **401** (generic).
4. The frontend's `apiClient` (`client.ts:267-309`) already calls `/auth/refresh` on 401
   and replaces tokens. No frontend change needed.

### 6.4 Logout

1. Requires `AppAuthGuard` (user is authenticated).
2. Read the refresh token from the request body `{ refreshToken }`.
3. Hash it, delete the matching `Session` row.
4. Return `204 No Content`.
5. Other sessions for the same user remain active.
6. The access token stays valid until it expires (15 min) — this is expected JWT
   behaviour; server-side revocation of access tokens is out of scope.

### 6.5 Me

1. Requires `AppAuthGuard` (validates JWT or dev header, sets `req.user`).
2. Return `req.user` as `AuthUser` directly (already the 6-field shape from
   `JwtStrategy.validate` / `DevAuthGuard`).

### 6.6 Verify email

1. `@Public()` endpoint, receives `?token=...` query param.
2. Decode the verification JWT (signed with `JWT_ACCESS_SECRET`, payload
   `{ sub, purpose: 'email-verify' }`). Reject if `purpose !== 'email-verify'` or
   if the token is expired → 401. Extract `sub` (userId).
3. Set `user.emailVerifiedAt = now()`.
4. Return `{ verified: true }` (JSON, not a redirect — the frontend in Epic 7 will
   handle the post-verification redirect; for now JSON lets us test via curl).

## 7. DTOs (class-validator)

```ts
// dto/register.dto.ts
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @IsString()
  @MinLength(1)
  name: string;
}

// dto/login.dto.ts
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

// dto/refresh.dto.ts
export class RefreshDto {
  @IsString()
  refreshToken: string;
}
```

## 8. AppAuthGuard (global composite guard)

New file: `apps/backend/src/common/auth/app-auth.guard.ts`.

```ts
@Injectable()
export class AppAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly devAuthGuard: DevAuthGuard,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    try {
      return await this.jwtAuthGuard.canActivate(ctx);
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        try {
          return await this.devAuthGuard.canActivate(ctx);
        } catch {
          throw new UnauthorizedException();
        }
      }
      throw new UnauthorizedException();
    }
  }
}
```

- `@Public()` decorator: `SetMetadata('isPublic', true)`, in
  `common/auth/public.decorator.ts`.
- Registered as `APP_GUARD` in `app.module.ts` providers:
  `{ provide: APP_GUARD, useClass: AppAuthGuard }`.
- In production: only JWT validation succeeds or 401. No dev bypass.
- In dev: JWT first; if no/invalid JWT, falls back to `x-dev-user` header.

## 9. Migration of existing controllers

### 9.1 courses.controller.ts

Remove all `@Query('organizationId')`. Use `@CurrentUser() user: AuthUser`:

| Method | Before | After |
|---|---|---|
| `POST /courses` | `@Body() dto` (incl. `organizationId`) | `@Body() dto, @CurrentUser() user` → `service.create({ ...dto, organizationId: user.organizationId })` |
| `GET /courses` | `@Query('organizationId')` | `@CurrentUser() user` → `service.findAll(user.organizationId, ...)` |
| `GET /courses/:id` | `@Query('organizationId')` | `@CurrentUser() user` → `service.findOne(id, user.organizationId)` |
| `PATCH /courses/:id` | `@Query('organizationId')` | `@CurrentUser() user` → `service.update(id, user.organizationId, dto)` |
| `DELETE /courses/:id` | `@Query('organizationId')` | `@CurrentUser() user` → `service.delete(id, user.organizationId)` |

`CreateCourseDto` loses the `organizationId` field (remove `@IsUUID()` on it).

### 9.2 files.controller.ts

| Method | Before | After |
|---|---|---|
| `POST /files` | `@Body() dto` (`organizationId`, `uploaderId`) | `@CurrentUser() user` → `service.createUpload(file, user.organizationId, user.userId)` |

`CreateFileDto` is removed entirely (no remaining fields — the upload endpoint takes
only the file + auth identity).

`GET /files/:id/url` and `DELETE /files/:id` now require authentication via the global
guard. A scoped-by-org check can be added to `getSignedUrl` / `delete` as a follow-up;
the minimum for Epic 2 is that they are no longer unauthenticated.

### 9.3 Frontend impact

- `client.ts` already sends `Authorization: Bearer <token>` when a token is present,
  and `x-dev-user` when `VITE_DEV_USER_ID` is set. No change needed.
- The frontend currently sends `organizationId` in query/body for courses/files.
  Sending it is now harmless (ignored by the backend); Aloiki can clean it up on his
  branch. No breakage either way.
- To switch from mock to real auth: set `VITE_USE_MOCK_AUTH=false` in
  `apps/frontend/.env.development` and log in with seed credentials
  (`student@demo` / `demo1234`). `VITE_DEV_USER_ID` can stay set as a fallback for
  the dev guard.

## 10. File layout

```
apps/backend/src/
  auth/
    auth.module.ts          # wires controller + service
    auth.controller.ts      # POST /auth/register|login|refresh|logout, GET /auth/me|verify-email
    auth.service.ts         # business logic (argon2, JWT, Session CRUD)
    dto/
      register.dto.ts
      login.dto.ts
      refresh.dto.ts
  common/
    auth/
      public.decorator.ts   # @Public() + IS_PUBLIC_KEY
      app-auth.guard.ts     # composite guard (JWT + dev fallback)
    common.module.ts        # add AppAuthGuard to providers + exports
  app.module.ts             # add { provide: APP_GUARD, useClass: AppAuthGuard }
  courses/
    dto/create-course.dto.ts  # remove organizationId field
    courses.controller.ts     # migrate to @CurrentUser()
  files/
    dto/create-file.dto.ts    # remove (delete file)
    files.controller.ts       # migrate to @CurrentUser()
```

## 11. Environment

No new env vars required — all already present from Epic 1:
- `JWT_ACCESS_SECRET` (access token signing)
- `JWT_REFRESH_SECRET` (refresh token signing — new usage in Epic 2)
- `NODE_ENV` (controls dev fallback in `AppAuthGuard` + auto-verify in register)

Ale may need to review `JWT_REFRESH_SECRET` for staging/prod (flagged in Epic 1).

## 12. Dependencies

All already installed in Epic 1: `argon2`, `@nestjs/jwt`, `@nestjs/passport`,
`passport`, `passport-jwt`. No new deps in Epic 2.

## 13. Tests (Definition of Done)

### Unit tests

- **`auth.service.spec.ts`:**
  - register: new user → `{ user, tokens }`; duplicate email → 409.
  - login: valid → tokens; wrong password → 401; unverified email → 403.
  - refresh: valid → new pair; expired → 401; reused (consumed) token → revoke all
    sessions + 401.
  - logout: deletes session; other sessions remain.
- **`app-auth.guard.spec.ts`:**
  - `@Public()` → allows.
  - JWT valid → allows.
  - JWT invalid + dev + `x-dev-user` → allows.
  - JWT invalid + dev + no header → 401.
  - JWT invalid + production → 401 (no dev fallback).
- **`courses.controller.spec.ts`:** verify `@CurrentUser()` is used; `organizationId`
  comes from `user.organizationId`, not `@Query`.
- **Existing Epic 1 tests:** still pass (no regressions in
  `current-user.decorator`, `roles.guard`, `jwt.strategy`, `dev-auth.guard`).

### E2E tests

- **`auth.e2e-spec.ts`:**
  - `POST /auth/login` with seed credentials → 200 + correct shape.
  - `GET /auth/me` with Bearer → `AuthUser`.
  - `GET /auth/me` without token → 401.
  - `POST /auth/refresh` → new pair; old refresh token → 401.
  - `POST /auth/logout` → 204; subsequent refresh with same token → 401.

### Smoke

- `make up` clean → backend starts, `APP_GUARD` active.
- `make db-seed` → seed users can login.
- `curl POST /auth/login` with `student@demo`/`demo1234` → tokens.
- `curl GET /auth/me` with Bearer → 6-field `AuthUser`.
- `curl GET /courses` without token → 401.
- `curl GET /courses` with `x-dev-user: user-student-0001` (dev) → 200.

## 14. Out of scope (handled in later epics/specs)

- Google OAuth (Epic 3).
- Organizations CRUD, Users CRUD admin (Epics 4–5).
- Profile + friends (Epic 6).
- Frontend auth pages (Epic 7).
- 2FA (Epic 8, stretch).
- Rate-limiting / account lockout after N failed attempts.
- Real SMTP for email verification (Ale's task).
- Server-side access-token revocation (access tokens are stateless; logout only
  kills the refresh session).
- Scoping `GET /files/:id/url` and `DELETE /files/:id` by `organizationId` (minimum
  for Epic 2 is requiring authentication; full org-scope check is a follow-up).
- Multi-org registration (register always uses seeded org in Epic 2; Epic 4 adds org
  management).

## 15. Open items / hand-offs after this epic

- Notify Aloiki: `VITE_USE_MOCK_AUTH=false` + real login works. `VITE_DEV_USER_ID`
  can stay as dev fallback. His `courses`/`files` controllers are migrated; he should
  review the diff and stop sending `organizationId` in query/body (harmless but
  redundant now).
- Notify David: same `AppAuthGuard` protects his endpoints; he can use
  `@CurrentUser()` + `@Roles()` without re-adding guards.
- Ale: review `JWT_REFRESH_SECRET` for staging/prod before merge to `master`.
- Track: scoped `files` get/delete by org as a follow-up enhancement.
- Track: rate-limiting on `/auth/login` and `/auth/register` as a security task.