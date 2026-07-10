# Epic 1 — Auth contracts + Prisma seed (Design Spec)

**Owner:** Jorge (@SrJorgeG) — Identity & Access, Tech Lead
**Branch:** `jorge` → `staging` → `master`
**Date:** 2026-07-09
**Status:** Approved
**Scope:** Only Epic 1 of `docs/planning/Jorge.md`. Epics 2–8 are out of scope and get their own specs.

---

## 1. Purpose

Unblock every teammate by delivering two contracts everyone blocks on, **without
building the login flow yet** (that is Epic 2):

1. **`common/auth/`** — the Identity & Access primitives every protected endpoint
   applies: the `AuthUser` type, `@CurrentUser()`, `JwtAuthGuard` (complete but
   inert until tokens are issued), `DevAuthGuard` (the operative guard for the
   pre-login phase, reading `x-dev-user`), `@Roles()` + `RolesGuard`, and a
   `@Global CommonModule` that exports them.
2. **`prisma/seed.ts`** — deterministic demo data (1 org, 3 users with argon2-hashed
   `demo1234`, 1 published course with section + lesson + enrollment) with **stable
   IDs** so `VITE_DEV_USER_ID` can be a fixed, shareable value.

Teammates (Aloiki, David) can protect their already-built controllers with
`@UseGuards(DevAuthGuard)` + `@CurrentUser()` immediately after this lands, and
reach real rows via the seed — no waiting for login.

## 2. Constraints (hard)

- **Frontend-first alignment.** Anything the frontend already depends on is a
  contract we match, not break. The frontend `AuthUser` has **6 fields**
  (`userId, email, name, avatarUrl, organizationId, role`) in
  `apps/frontend/src/lib/api/types.ts:10-19`; our backend `AuthUser` MUST be the
  same shape. IDs in the seed align with the frontend mock where possible
  (`org-klass-0001`).
- **Passwords hashed + salted** with argon2 (mandatory project gate). Even the
  seed must hash `demo1234` — we never store plaintext, not even in dev.
- **No `APP_GUARD` global in Epic 1.** Aloiki's `courses`/`files` controllers
  currently read `organizationId` from `@Query`; a global guard would break
  them. Guards are opt-in via `@UseGuards(...)` until Epic 2.
- **`import './telemetry/otel-sdk'` stays the first line of `main.ts`.** Not
  touched in this epic.
- **English-only identifiers**; casing matches Aloiki's existing code
  (`@Controller('plural')`, DTOs in `dto/`, barrel `index.ts`).
- **English-only comments** to match the existing module headers; commit bodies
  may be Spanish.

## 3. AuthUser contract (6 fields — matches frontend)

```ts
export type GlobalRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  organizationId: string;
  role: GlobalRole;
}
```

`POST /auth/login` (Epic 2) will return `{ user: AuthUser; accessToken: string;
refreshToken: string }` and `GET /auth/me` (Epic 2) will return `AuthUser`
directly — both shapes are already consumed by
`apps/frontend/src/lib/api/auth-context.tsx`. We do not build these endpoints in
Epic 1; we only fix the type so Epic 2 can satisfy the contract without rework.

## 4. File layout

```
apps/backend/src/common/
  common.module.ts            # @Global, exports guards + JwtModule
  auth/
    auth-user.type.ts         # AuthUser + GlobalRole
    current-user.decorator.ts # @CurrentUser() param decorator
    jwt.strategy.ts           # JwtStrategy (passport-jwt)
    jwt-auth.guard.ts         # JwtAuthGuard(@nestjs/passport) — inert in Epic 1
    dev-auth.guard.ts         # DevAuthGuard — operative pre-login guard
    roles.decorator.ts        # @Roles(...roles) metadata
    roles.guard.ts            # RolesGuard
    index.ts                  # barrel
```

`CommonModule` is added to `AppModule.imports` once. `app.module.ts` already
groups Jorge-owned imports; the single new line goes there. No other changes to
`app.module.ts`.

## 5. DevAuthGuard (operative in Epic 1)

- Activates **only when `NODE_ENV !== 'production'`**; in production the guard
  returns `false` (403) so the dev bypass cannot leak to a graded deploy.
- Reads the `x-dev-user` header (string = a seeded `userId`). This header name is
  already what Aloiki's `client.ts` sends via `DevTokenStorage.getDevUserId()`
  (`apps/frontend/src/lib/api/client.ts:227-240`).
- Loads the `User` row by id via the globally-injected `PrismaService`. Missing
  user → `401 Unauthorized`.
- Maps the Prisma `User` to the 6-field `AuthUser` (`avatarUrl` may be `null`)
  and assigns it to `req.user`.
- **Does not validate a JWT.** This is the point: endpoints can be protected
  before login exists.

Enforce-ability of "dev only" lives entirely inside the guard's `canActivate`;
we do not rely on module-loading tricks. A unit test asserts the production
branch returns `false`.

## 6. JwtAuthGuard + JwtStrategy (inert but complete)

- `JwtAuthGuard extends AuthGuard('jwt')` from `@nestjs/passport`.
- `JwtStrategy` extends `PassportStrategy(Strategy, 'jwt')`; reads
  `JWT_ACCESS_SECRET` from `ConfigService`, verifies `Authorization: Bearer
  <jwt>`, decodes `{ sub: userId }`, loads the `User` from Prisma, and returns
  an `AuthUser` (which passport sets on `req.user`).
- `CommonModule` imports `JwtModule.registerAsync(...)` so `JwtService` is
  injectable (Epic 2 will call `jwtService.sign(...)`). We **do not sign** in
  Epic 1, so any request reaching `JwtAuthGuard` without a valid token returns
  `401`. Correct behaviour; no code change needed in Epic 2 to activate it.

## 7. @Roles() + RolesGuard

- `@Roles('ADMIN')` / `@Roles('ADMIN','TEACHER')` — implemented with
  `Reflector.createDecorator<string[]>()`.
- `RolesGuard` reads `req.user.role`, compares against the decorator metadata.
  No `@Roles()` on a handler → guard allows (auth-only). `req.user` missing →
  `401`.
- Order of composition: `@UseGuards(DevAuthGuard, RolesGuard)` or
  `@UseGuards(JwtAuthGuard, RolesGuard)`. RolesGuard runs after the auth guard
  has populated `req.user`.

## 8. @CurrentUser()

`createParamDecorator((_data, ctx) => req.user as AuthUser)`. If `req.user` is
undefined, throw (programming error — a route using `@CurrentUser()` without an
auth guard) so the developer notices immediately.

## 9. CommonModule (@Global)

- `@Global() @Module({ imports: [JwtModule.registerAsync(...)], providers:
  [RolesGuard, DevAuthGuard, JwtStrategy], exports: [RolesGuard, DevAuthGuard,
  JwtStrategy, JwtModule] })`.
- Consumes `PrismaService` (already `@Global` via `PrismaModule`) and
  `ConfigService` (already global via `ConfigModule.forRoot({ isGlobal: true })`).
- Added once to `AppModule.imports`.

## 10. prisma/seed.ts — deterministic data with stable IDs

Stable IDs (explicit `id:` on every row, no `cuid()` randomness):

| Entity      | id                   | notes |
|-------------|----------------------|-------|
| Organization| `org-klass-0001`     | slug `klass-demo`, aligns with frontend mock |
| User (admin)| `user-admin-0001`    | `admin@demo`, ADMIN, argon2(`demo1234`) |
| User (teacher) | `user-teacher-0001` | `teacher@demo`, TEACHER, argon2(`demo1234`) |
| User (student) | `user-student-0001` | `student@demo`, STUDENT, argon2(`demo1234`) |
| Course      | `course-demo-0001`    | owner = teacher, `status: PUBLISHED`, `accessCode: KLASS123` |
| Section     | `section-demo-0001`  | course, title "Welcome", order 0 |
| Lesson      | `lesson-demo-0001`    | section, `contentMd: '# Welcome...'`, order 0 |
| Enrollment  | `enrollment-demo-0001` | course × student, STUDENT, progress 0 |

Properties:
- **Idempotent** — `upsert` keyed by `where: { id }` on every row. Re-running
  `db-seed` never creates duplicates.
- **Re-hashes passwords** each run (argon2 salts differ each time; acceptable).
- **`emailVerifiedAt = new Date()`** on all three users — skip the email-
  verification flow for dev convenience.
- **Argon2** is a dependency of this epic specifically because the seed must
  hash `demo1234` before the login service exists.
- On success, the seed logs the three user IDs and the suggested
  `VITE_DEV_USER_ID=user-student-0001` line so Aloiki can update
  `apps/frontend/.env.development` (his file — we do not touch it).

## 11. Dependencies to add

`apps/backend`:
- runtime: `argon2`, `@nestjs/jwt`, `@nestjs/passport`, `passport`,
  `passport-jwt`
- dev: `@types/passport-jwt`, `ts-node` (for the prisma seed runner)

## 12. Wiring

- `apps/backend/package.json`:
  - add `"prisma": { "seed": "ts-node prisma/seed.ts" }`
  - add scripts if useful (`prisma:seed` calling `prisma db seed`)
- `Makefile`: new target
  `db-seed: ... pnpm --filter @ft-trascendence/backend exec prisma db seed`
  (documented in the `# Base de datos` block next to `db-push`).
- `apps/backend/src/app.module.ts`: add `CommonModule` to imports (one line in
  the Jorge-owned block). Nothing else in that file.

## 13. Environment

- `.env.example` already documents `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
  `GOOGLE_*`. No change required in Epic 1 beyond optionally a one-line comment
  that `NODE_ENV=development` enables `DevAuthGuard`.
- `.env` (git-ignored) must carry real values for the stack to run; `db-seed`
  works in compose via `infra/docker/.env.dev` (Ale's, already committed).

## 14. Tests (Definition of Done — happy path)

- **Unit:** `@CurrentUser` (mock `req.user` present/absent), `DevAuthGuard`
  (header present / header absent / user not found / production-blocked),
  `RolesGuard` (allowed / denied / no metadata / no user), `JwtStrategy`
  (valid token / invalid token / user not found).
- **Smoke:** `CommonModule` boots without breaking `AppModule`; `AppModule`
  still starts (`make up` clean).
- **Seed:** validated manually by `make db-seed` against the dev compose DB, then
  `psql`/`prisma studio` sanity-check of the 8 rows.

## 15. Out of scope (handled in later epics/specs)

- `POST /auth/register|login|refresh|logout`, `GET /auth/me` (Epic 2).
- Google OAuth (Epic 3).
- Organizations CRUD, Users CRUD (Epics 4–5).
- Profile + friends (Epic 6).
- Frontend admin/org pages (Epic 7).
- 2FA (Epic 8, stretch).
- Switching the global `APP_GUARD` on (Epic 2, after controllers migrate to
  `@CurrentUser()`).
- Migrating Aloiki's `courses`/`files` controllers off `@Query(organizationId)`
  onto `@CurrentUser()` — coordination with Aloiki, tracked in
  `desarrollo_jorge.md` as debt.

## 16. Open items / hand-offs after this epic

- Notify Aloiki to set `VITE_DEV_USER_ID=user-student-0001` and flip
  `VITE_USE_MOCK_AUTH=false` once Epic 2's `/auth/login` is available; in the
  interim, Epic 1 lets the frontend already hit `/api` with `x-dev-user` and the
  guard resolves it.
- Track the "controllers still reading `organizationId` from `@Query`" debt for
  the Epic 2 global-guard rollout.
- Update `docs/planning/Jorge.md` Epic 1 to the 6-field `AuthUser` and note
  alignment with the frontend (done as part of this spec — see §17).