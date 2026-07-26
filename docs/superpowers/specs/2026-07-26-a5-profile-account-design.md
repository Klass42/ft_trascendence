# A5 — Perfil y cuenta reales (Design Spec)

**Owner:** Jorge (@SrJorgeG) — Identity & Access, Tech Lead
**Branch:** `jorge` → `staging` → `master`
**Date:** 2026-07-26
**Status:** Draft
**Scope:** Épica A5 de `docs/planning/Jorge-2.md` (Plan 2, Fase A del rediseño LMS). Primera de las
tres épicas restantes (A5 → A3 → A4-admin), una spec por épica.

---

## 1. Purpose

`ProfilePage` is currently a mock: the avatar upload is never persisted (lost on reload), the
name is read-only, and the "Notificaciones por email", "2FA" and "Idioma" rows are dead toggles
with no backend. This epic makes the account page real end to end:

- **Identity**: persisted avatar, editable name, read-only email + role.
- **Security**: real password change (`POST /auth/change-password`, argon2, revokes all sessions),
  honest "Próximamente" 2FA row (no dead toggle).
- **Preferences**: real persisted toggles — email notifications + language — stored on `User`.

It also fixes a latent bug: the avatar uploaded via `FileUpload` was never written to
`User.avatarUrl`.

---

## 2. Constraints (hard)

- **Compose the Épica 0 design system** (`@/components/ui`) — `Button`, `Input`, `Select`,
  `FormField`, `Badge`, `FileUpload`, `Spinner`, `useToast()`. No inline styles with raw
  colors/spacing (see `docs/planning/ui-language.md`).
- **One new UI primitive allowed**: `Toggle` (needed for preferences, doesn't exist yet). Built in
  `components/ui` with `.module.css` + tokens, per the Épica 0 rule ("si te falta alguno, añádelo
  aquí siguiendo el mismo patrón").
- **Schema change is additive only** — two new columns with defaults. Applied with
  `prisma db push` (current repo practice). Migration-history reconciliation is a separate task
  owned by Jorge/Ale (not this epic).
- **`AuthUser` extension is additive** (6 → 8 fields). Both layers change in the same PR.
  Never remove/rename existing fields (bitácora §2.1).
- **Do NOT touch enrollments/courses modules** (Aloiki's, old `@Query` pattern) — not needed here.
- **Spanish UI text** — matches existing pages.
- **No new dependencies** — argon2, class-validator, React, design system only.
- **No rate limiting** on change-password in this epic (recorded as debt, §11).

---

## 3. Design decisions (from brainstorm, 2026-07-26)

| Topic | Decision | Rationale |
|---|---|---|
| Fake toggles | **Real persisted prefs** (user choice) | Jorge-2.md allowed removing them; user chose to implement them for real |
| Prefs scope | **`emailNotificationsEnabled` + `preferredLanguage`** | i18n real is Phase C; the language is stored now, applied later |
| Language validation | **`@IsIn(['es','en'])` in DTO, plain `String` in Prisma** | Adding a language must not require a migration |
| Schema apply | **`db push`, migrations reconciliation deferred** | Zero friction now; drift fix is a separate task with Ale |
| Password change | **Revoke ALL sessions, force re-login** | Standard security posture; matches the planned E2E flow |
| Wrong current password | **400, not 401** | The frontend api-client intercepts 401 → token refresh → retry; a 401 here would trigger that machinery and confuse the flow |
| OAuth-only account | **400 "la cuenta no tiene contraseña"** | `passwordHash` is `null` for Google-created users |
| Avatar persistence | **Keep `FileUpload`, then `PATCH /users/me { avatarUrl }`** | Reuses the existing upload UX; `UpdateProfileDto` gains `avatarUrl`. The multipart `PATCH /users/me/avatar` endpoint stays for API clients |
| Prefs exposure | **Extend `AuthUser` additively** (backend type, `mapUser`, frontend type) | Single source of truth; `refreshUser()` already exists in auth-context. Rejected: separate `GET /users/me` (second source of truth) |
| 2FA row | **Text + `Badge` "Próximamente"** | Honest, no dead toggle. 2FA real is Epic 8 (stretch) |
| Toggle component | **New `components/ui/Toggle`** (`role="switch"`, keyboard-native `<button>`) | Doesn't exist; preferences need it |
| E2E password test | **Throwaway user via `POST /auth/register`** | Never mutate seeded users' passwords (would break other specs/dev) |

---

## 4. Architecture

```
ProfilePage (rewrite)
 ├─ Identidad
 │   ├─ FileUpload (existing UX) → POST /files (FilesService, existing)
 │   │     └─ on status 'done' → PATCH /users/me { avatarUrl } → refreshUser()
 │   ├─ FormField + Input (name) + Button Guardar → PATCH /users/me { name } → refreshUser()
 │   └─ email + role read-only
 ├─ Seguridad
 │   ├─ Password form: actual / nueva / confirmar
 │   │     └─ useChangePassword → POST /auth/change-password
 │   │           success → clear tokens → redirect /login (+ toast)
 │   │           400 → inline error on "actual" field
 │   └─ 2FA row: description + Badge "Próximamente"
 └─ Preferencias
     ├─ Toggle (emailNotificationsEnabled) → PATCH /users/me → refreshUser() + toast
     └─ Select (preferredLanguage es/en) → PATCH /users/me → refreshUser() + toast

Backend
 ├─ PATCH /users/me  (UsersService.updateProfile — extended DTO)
 └─ POST /auth/change-password (AuthService.changePassword — new)
       argon2.verify(current) → argon2.hash(new) → session.deleteMany(userId)
```

---

## 5. Backend design

### 5.1 Schema (`apps/backend/prisma/schema.prisma`)

```prisma
model User {
  // ...existing fields...
  emailNotificationsEnabled Boolean @default(true)
  preferredLanguage         String  @default("es")
}
```

- Additive; existing rows get `true` / `'es'` on `db push`. No seed change needed.
- Apply with `make db-push` + `prisma generate`. The dev compose already runs `db push` on
  bootstrap, so teammates get it on next `make up`.

### 5.2 `AuthUser` — 6 → 8 fields

`apps/backend/src/common/auth/auth-user.type.ts`:

```ts
export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  organizationId: string;
  role: GlobalRole;
  emailNotificationsEnabled: boolean;   // NEW
  preferredLanguage: string;            // NEW — 'es' | 'en'
}
```

Update the JSDoc ("6 fields" → "8 fields"). `AuthService.mapUser()` gains the two fields — this
automatically propagates to `POST /auth/login`, `POST /auth/register` and `GET /auth/me`.
`tsc` flags any other place constructing `AuthUser` literally (e.g. `DevAuthGuard` if applicable)
— fix all of them.

### 5.3 `PATCH /users/me` — extended DTO

`apps/backend/src/users/dto/update-profile.dto.ts`:

```ts
export class UpdateProfileDto {
  @IsString() @MinLength(1) @IsOptional()
  name?: string;

  @IsString() @IsOptional()
  bio?: string;                       // existing — still not exposed in UI

  @IsString() @IsOptional()
  avatarUrl?: string;                 // NEW — relative URL (/api/files/:id/url); plain IsString

  @IsBoolean() @IsOptional()
  emailNotificationsEnabled?: boolean; // NEW

  @IsIn(['es', 'en']) @IsOptional()
  preferredLanguage?: string;          // NEW
}
```

- `UsersService.updateProfile` logic unchanged (`prisma.user.update` with the DTO).
- Response select: introduce `selectOwnProfile` = `selectPublicProfile` + `email`,
  `organizationId`, `emailNotificationsEnabled`, `preferredLanguage`, and use it for
  `updateProfile` (own data — prefs must come back). `selectPublicProfile` stays for
  friend/public views (prefs are private).

### 5.4 `POST /auth/change-password` (new)

`apps/backend/src/auth/dto/change-password.dto.ts`:

```ts
export class ChangePasswordDto {
  @IsString() @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword: string;
}
```

`AuthService.changePassword(userId, dto)`:

1. Load user (404 impossible in practice — guard keeps it safe).
2. `user.passwordHash === null` → `400 BadRequestException('Account has no password (OAuth only)')`.
3. `await argon2.verify(user.passwordHash, dto.currentPassword)` → false →
   `400 BadRequestException('Current password is incorrect')` (**never 401** — see §3).
4. `passwordHash = await argon2.hash(dto.newPassword)`; `prisma.user.update`.
5. `prisma.session.deleteMany({ where: { userId } })` — revokes every session.
6. Return `{ changed: true }` (200).

Controller: `POST /auth/change-password`, authenticated (global guard), `@CurrentUser()`.
Not `@Public()`.

### 5.5 Backend tests (jest, existing patterns)

`auth.service` — new `describe('changePassword')`:
1. Success: hash updated (verify new passes) **and all sessions deleted**.
2. Wrong current password → 400, hash unchanged, sessions intact.
3. `passwordHash: null` (OAuth-only) → 400.
4. Weak new password rejected by DTO (validation pipe, e.g. `short` / `nouppercase1`).
5. DTO `forbidNonWhitelisted` rejects extra fields.

`users.service` — extend `updateProfile` describe:
6. Persists `emailNotificationsEnabled` / `preferredLanguage`; response includes them.
7. `preferredLanguage: 'fr'` → 400 (`@IsIn`).
8. `avatarUrl` persisted as plain string.

---

## 6. Frontend design

### 6.1 Types & hooks

- `lib/api/types.ts`: `AuthUser` gains `emailNotificationsEnabled: boolean` and
  `preferredLanguage: string` (required — backend always returns them).
- `lib/api/auth-context.tsx`: `MOCK_USER` gains both fields (keeps the mock path compiling).
- New `lib/api/hooks/useUpdateProfile.ts`:
  `mutate(patch: UpdateProfilePatch) → Promise<void>`; on success calls `refreshUser()` from
  auth-context and fires a success toast. Exposes `isSaving` / `error`.
- New `lib/api/hooks/useChangePassword.ts`:
  `mutate({ currentPassword, newPassword })`; on **200** → clears token storage + redirects to
  `/login` (with a "Contraseña actualizada — inicia sesión de nuevo" toast); on **400** →
  surfaces the server message to the form (inline, not toast).
  No API `logout` call — sessions are already revoked server-side; local cleanup is enough.
- Barrel exports in `lib/api/hooks/index.ts`.

### 6.2 `components/ui/Toggle` (new)

`Toggle.tsx` + `Toggle.module.css`, following Épica 0 conventions (tokens, no raw values):

```ts
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}
```

- `<button type="button" role="switch" aria-checked={checked}>` with a knob `<span>` — button
  gives Space/Enter keyboard support for free; visible focus ring (token).
- On: `--color-accent-primary` track; off: `--color-border-secondary`; white knob, sliding
  transition via `--transition-fast`.
- Exported from `components/ui/index.ts`.

### 6.3 `ProfilePage` rewrite

Three `Card` sections (module CSS for layout, tokens only):

1. **Identidad**
   - `FileUpload` (current props: `accept="image/*"`, `maxSizeBytes` 5 MB, `multiple={false}`,
     `autoUpload`). When a file reaches `status === 'done'` with a `url` →
     `updateProfile({ avatarUrl: url })`. Avatar preview reads `user.avatarUrl` from auth-context
     (persisted) — the half-uploaded local state hack disappears.
   - Name: `FormField` + `Input` (defaultValue = `user.name`) + `Button` "Guardar cambios"
     (`loading` while saving). Client validation: non-empty. Success toast + `refreshUser()`.
   - Email + role: read-only text rows.
2. **Seguridad**
   - Three `Input type="password"` fields: actual / nueva / confirmar, each in `FormField`.
   - Client validation before submit: current non-empty; new ≥8 + upper + lower + digit;
     confirm === new. Inline field errors.
   - Submit → `useChangePassword`. 400 → message inline under "actual". 200 → redirect + toast
     (handled by the hook).
   - 2FA row: "Autenticación en dos pasos" + description + `Badge` "Próximamente".
3. **Preferencias**
   - Row "Notificaciones por email" ("Resumen semanal de actividad") + `Toggle` bound to
     `user.emailNotificationsEnabled` → `updateProfile({ emailNotificationsEnabled: next })`.
     Optimistic UI optional; must rollback + error toast on failure.
   - Row "Idioma" + `Select` (`es` Español / `en` English) bound to `user.preferredLanguage` →
     `updateProfile({ preferredLanguage })` + success toast. Hint text: "El idioma de la
     interfaz llegará en una próxima versión" (honest).

States: page-level loading while auth-context has no user (`Spinner`); mutation errors via
toast + inline; responsive single column; no console errors.

---

## 7. E2E — `apps/frontend/e2e/profile.spec.ts`

Harness: existing Playwright + `actAs()` from `e2e/dev-user.ts` (sets `x-dev-user` via
localStorage). **Throwaway user** created in `beforeAll` via `POST /auth/register`
(email `e2e-profile-${Date.now()}@demo`, password `Demo1234`) → real userId + refreshToken kept
for assertions.

1. **Nombre**: `actAs(throwawayId)` → `/profile` → edit name → Guardar → reload → name persists
   (UI + `GET /auth/me` with `x-dev-user` shows it).
2. **Prefs**: toggle email notifications off + select "English" → reload → toggle/select state
   persists (UI state + `/auth/me` fields).
3. **Contraseña**:
   - Fill actual (`Demo1234`) / nueva (`Nueva1234`) / confirmar → submit → redirected to `/login`.
     (Race note: while `dev-user-id` is still set, the next `/auth/me` may re-authenticate and
     bounce away from `/login` — assert the success toast / redirect target immediately after
     submit, before any navigation.)
   - API: `POST /auth/refresh` with the **pre-change** refreshToken → 401 (sessions revoked).
   - Clear `dev-user-id` from localStorage → real login page: old password → error visible;
     new password → lands on dashboard.
4. Screenshot per flow (pattern of existing specs).

Requires the dev stack up (`make up`) with `db push` already applied.

---

## 8. Security considerations

- Password verification always via `argon2.verify` (constant-time); new hash via `argon2.hash`
  (per-user salt) — mandatory gate "hashed + salted".
- 400 (not 401) for wrong current password — avoids the api-client 401/refresh machinery and
  user enumeration is not a concern (authenticated self-service endpoint).
- Full session revocation on password change invalidates stolen refresh tokens.
- Prefs are own-data: only `PATCH /users/me` (self) can write them; admin `PATCH /users/:id`
  does **not** accept them (`UpdateUserDto` unchanged).
- `avatarUrl` is stored as an opaque string; rendered via `<img src>` (React-escaped). The
  upload itself goes through the existing `FilesService` validation (MIME/size).
- No rate limiting on change-password in this epic → debt (§11).

---

## 9. Definition of Done

- [ ] `pnpm -r run build` clean; backend `pnpm test` green (8 new tests).
- [ ] `make up` from scratch: `db push` applies the two columns; login returns the 8-field
      `AuthUser`.
- [ ] Profile page: zero mock, zero inline-style hacks, composes `components/ui`.
- [ ] Validation front + back on every form (name, password, prefs).
- [ ] Responsive (mobile single column), a11y (labels, focus, keyboard — Toggle is a button).
- [ ] E2E `profile.spec.ts` green (3 flows) + screenshots reviewed.
- [ ] Zero console errors/warnings in Chrome on `/profile`.
- [ ] Bitácora (`docs/planning/desarrollo_jorge.md`) updated.

---

## 10. Out of scope / future debt

- Rate limiting / brute-force protection on `POST /auth/change-password` (and login) — separate
  hardening task.
- 2FA TOTP real (Epic 8, stretch) — the row is informational only.
- i18n real — `preferredLanguage` is stored, not applied (Phase C).
- Email delivery — `emailNotificationsEnabled` is stored; no worker sends emails yet.
- "Remove avatar" action — not needed (YAGNI); uploading a new one overwrites.
- Bio editing in UI (DTO already accepts it).
- Migration-history reconciliation (drift `migrations/_init` vs `db push`) — Jorge + Ale,
  separate task.

---

## 11. Files touched

**Backend**
- `apps/backend/prisma/schema.prisma` — 2 new `User` columns.
- `apps/backend/src/common/auth/auth-user.type.ts` — +2 fields, JSDoc 6→8.
- `apps/backend/src/auth/auth.service.ts` — `mapUser` +2; new `changePassword`.
- `apps/backend/src/auth/auth.controller.ts` — new route.
- `apps/backend/src/auth/dto/change-password.dto.ts` — **new**.
- `apps/backend/src/users/dto/update-profile.dto.ts` — +3 fields.
- `apps/backend/src/users/users.service.ts` — `selectOwnProfile` for `updateProfile`.
- Tests: auth + users spec files (colocated, existing layout).

**Frontend**
- `apps/frontend/src/lib/api/types.ts` — `AuthUser` +2.
- `apps/frontend/src/lib/api/auth-context.tsx` — `MOCK_USER` +2.
- `apps/frontend/src/lib/api/hooks/useUpdateProfile.ts` — **new**.
- `apps/frontend/src/lib/api/hooks/useChangePassword.ts` — **new**.
- `apps/frontend/src/lib/api/hooks/index.ts` — barrels.
- `apps/frontend/src/components/ui/Toggle.tsx` + `Toggle.module.css` — **new** (+ barrel).
- `apps/frontend/src/features/profile/ProfilePage.tsx` — rewrite (+ `ProfilePage.module.css`).
- `apps/frontend/e2e/profile.spec.ts` — **new**.

**Ops**: none (db push via existing compose bootstrap / `make db-push`).
