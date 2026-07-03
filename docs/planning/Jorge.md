# Jorge (@SrJorgeG) — Identity & Access · Tech Lead

> **Your file.** This is your working brief. Read `../../AGENTS.md` for shared conventions and
> `./README.md` for the methodology. Work on branch **`jorge`** (based on `main`); merge to
> `staging` before `main`.

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

## Epic 1 — Auth contracts + seed (Week 1, TOP PRIORITY, unblocks all)

- [ ] `apps/backend/src/common/auth/auth-user.type.ts` — `interface AuthUser { userId: string;
      organizationId: string; role: 'ADMIN'|'TEACHER'|'STUDENT'; }`
- [ ] `apps/backend/src/common/auth/current-user.decorator.ts` — `@CurrentUser()` param decorator
      returning `req.user as AuthUser`.
- [ ] `apps/backend/src/common/auth/jwt-auth.guard.ts` — verifies access JWT, sets `req.user`.
- [ ] `apps/backend/src/common/auth/dev-auth.guard.ts` — **fallback** for teammates: reads
      `x-dev-user` header (a seeded userId), loads the user, sets `req.user`. Enabled when
      `NODE_ENV=development`. This is what lets others build endpoints before real login exists.
- [ ] `apps/backend/src/common/auth/roles.decorator.ts` + `roles.guard.ts` — `@Roles('ADMIN')`.
- [ ] `apps/backend/src/common/common.module.ts` — exports guards so any module can apply them.
- [ ] `apps/backend/prisma/seed.ts` — 1 `Organization`, users `admin@demo`, `teacher@demo`,
      `student@demo` (hashed password `demo1234`), 1 published `Course` with a section + lesson.
      Wire `package.json` `"prisma": { "seed": "ts-node prisma/seed.ts" }` and a `make db-seed`.
- [ ] Announce in the team channel when `common/auth` + seed are on `staging`.

## Epic 2 — Email/password auth

- [ ] `apps/backend/src/auth/` — `auth.module.ts`, `auth.controller.ts`, `auth.service.ts`,
      `dto/{register,login,refresh}.dto.ts` (class-validator).
- [ ] Password hashing: `argon2` (add dep). Never store plaintext; salted by argon2.
- [ ] `POST /auth/register` (email unique per org), `POST /auth/login`, `POST /auth/refresh`,
      `POST /auth/logout`. Access JWT (15 min) + refresh JWT (7 d); store refresh **hash** in
      `Session`.
- [ ] Refresh-token rotation + revoke on logout.
- [ ] `GET /auth/me` → current user + org + role.
- [ ] Email verification token (dev: log the link; real email is Ale's SMTP later).

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
