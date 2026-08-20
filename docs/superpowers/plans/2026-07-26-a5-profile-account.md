# A5 — Perfil y cuenta reales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `ProfilePage` from a mock into a real account page: persisted avatar, editable name, real password change (revokes sessions), and persisted preferences (email notifications + language).

**Architecture:** Additive Prisma change (`User.emailNotificationsEnabled` + `User.preferredLanguage`, applied with `db push`), additive `AuthUser` extension (6→8 fields) so prefs travel in `/auth/me`, one new auth endpoint (`POST /auth/change-password`), extended `PATCH /users/me`, a new `Toggle` UI primitive, two new frontend hooks, and a `ProfilePage` rewrite composing the Épica 0 design system.

**Tech Stack:** NestJS 10 + Prisma + argon2 + class-validator (backend) · React 19 + design system `@/components/ui` (frontend) · Jest (unit) + Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-07-26-a5-profile-account-design.md` (source of truth for decisions).

**Conventions (from AGENTS.md + bitácora):** backend comments in English, Spanish UI text; `@Controller('plural')`; DTOs in `dto/`; global `ValidationPipe` (whitelist + forbidNonWhitelisted + transform); `import './telemetry/otel-sdk'` stays first in `main.ts` (untouched here); every query tenant-scoped by `organizationId` (not applicable to the self-service endpoints here — they scope by `userId` from `@CurrentUser()`).

---

## File Structure

**Backend (create/modify):**
- `apps/backend/prisma/schema.prisma` — 2 new `User` columns (Task 1).
- `apps/backend/src/common/auth/auth-user.type.ts` — AuthUser 8 fields (Task 2).
- `apps/backend/src/auth/auth.service.ts` — `mapUser` +2; new `changePassword` (Tasks 2-3).
- `apps/backend/src/common/auth/jwt.strategy.ts` + `dev-auth.guard.ts` — literal AuthUser +2 (Task 2).
- `apps/backend/src/auth/dto/change-password.dto.ts` — **new** (Task 3).
- `apps/backend/src/auth/auth.controller.ts` — new route (Task 4).
- `apps/backend/src/users/dto/update-profile.dto.ts` — +3 fields (Task 5).
- `apps/backend/src/users/users.service.ts` — `selectOwnProfile` for `updateProfile` (Task 5).
- Tests: `auth/__tests__/auth.service.spec.ts`, `users/__tests__/users.service.spec.ts`, `common/auth/__tests__/jwt.strategy.spec.ts`, `common/auth/__tests__/dev-auth.guard.spec.ts` (Tasks 2, 3, 5).

**Frontend (create/modify):**
- `apps/frontend/src/lib/api/types.ts` — AuthUser +2 (Task 6).
- `apps/frontend/src/lib/api/auth-context.tsx` — MOCK_USER +2 (Task 6).
- `apps/frontend/src/components/ui/Toggle.tsx` + `Toggle.module.css` + barrel (Task 7).
- `apps/frontend/src/features/profile/types.ts` — **new**: `UpdateProfileInput`, `OwnProfileDTO` (Task 8).
- `apps/frontend/src/lib/api/hooks/useUpdateProfile.ts` + `useChangePassword.ts` — **new** + barrel (Task 8).
- `apps/frontend/src/features/profile/ProfilePage.tsx` — rewrite + `ProfilePage.module.css` (Task 9).
- `apps/frontend/e2e/profile.spec.ts` — **new** (Task 11).

---

## Task 1: Schema — campos de preferencias en `User` + db push

**Files:**
- Modify: `apps/backend/prisma/schema.prisma` (User model, ~line 61)

- [ ] **Step 1: Añadir los dos campos al modelo User**

En `apps/backend/prisma/schema.prisma`, dentro de `model User`, inmediatamente DESPUÉS de la línea `emailVerifiedAt DateTime?` y ANTES de `createdAt`:

```prisma
  emailVerifiedAt DateTime?
  emailNotificationsEnabled Boolean @default(true)
  preferredLanguage         String  @default("es")
  createdAt       DateTime     @default(now())
```

- [ ] **Step 2: Levantar la base de datos y aplicar**

La app arranca con `db push` (no hay historia de migraciones reconciliada — decisión de la spec §3). Aplica el cambio y regenera el cliente:

```bash
make up            # si la stack no está ya levantada
make db-push       # prisma db push contra la DB del compose
make db-generate   # prisma generate (regenera el cliente con los 2 campos)
```

Expected: `db push` → `Your database is now in sync with your Prisma schema.` · `generate` → `Generated Prisma Client`.

- [ ] **Step 3: Verificar que el schema valida y el backend compila**

```bash
pnpm --filter @ft-trascendence/backend exec prisma validate
pnpm --filter @ft-trascendence/backend build
```

Expected: validación OK · build sin errores (los campos nuevos aún no se usan en código — Prisma los añade al tipo `User` sin romper nada).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(backend): añade prefs de usuario (emailNotifications, idioma) al schema"
```

---

## Task 2: AuthUser 6→8 campos (backend) + tests existentes al día

`AuthUser` se construye literalmente en TRES sitios: `AuthService.mapUser`, `JwtStrategy.validate`, `DevAuthGuard.canActivate`. Y TRES specs tienen literales de 6 campos que fallarán: `auth.service.spec.ts`, `jwt.strategy.spec.ts`, `dev-auth.guard.spec.ts`.

**Files:**
- Modify: `apps/backend/src/common/auth/auth-user.type.ts`
- Modify: `apps/backend/src/auth/auth.service.ts:26-38` (mapUser)
- Modify: `apps/backend/src/common/auth/jwt.strategy.ts:33-40` (validate)
- Modify: `apps/backend/src/common/auth/dev-auth.guard.ts:41-48`
- Test: `apps/backend/src/auth/__tests__/auth.service.spec.ts`
- Test: `apps/backend/src/common/auth/__tests__/jwt.strategy.spec.ts`
- Test: `apps/backend/src/common/auth/__tests__/dev-auth.guard.spec.ts`

- [ ] **Step 1: Extender el type**

`apps/backend/src/common/auth/auth-user.type.ts` completo:

```ts
export type GlobalRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

/**
 * Identity of the authenticated user. MUST match the frontend contract in
 * apps/frontend/src/lib/api/types.ts (8 fields). Do not reduce fields without
 * coordinating with the frontend. Additive extensions are allowed when both
 * layers change in the same PR (see A5 spec).
 */
export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  organizationId: string;
  role: GlobalRole;
  emailNotificationsEnabled: boolean;
  preferredLanguage: string;
}
```

- [ ] **Step 2: `mapUser` en `auth.service.ts`**

Sustituir el método `mapUser` (líneas 26-38) por:

```ts
  private mapUser(user: {
    id: string; email: string; name: string; avatarUrl: string | null;
    organizationId: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT';
    emailNotificationsEnabled: boolean; preferredLanguage: string;
  }): AuthUser {
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      organizationId: user.organizationId,
      role: user.role,
      emailNotificationsEnabled: user.emailNotificationsEnabled,
      preferredLanguage: user.preferredLanguage,
    };
  }
```

- [ ] **Step 3: `JwtStrategy.validate` y `DevAuthGuard`**

En `apps/backend/src/common/auth/jwt.strategy.ts`, el `return` de `validate()` queda:

```ts
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      organizationId: user.organizationId,
      role: user.role,
      emailNotificationsEnabled: user.emailNotificationsEnabled,
      preferredLanguage: user.preferredLanguage,
    };
```

En `apps/backend/src/common/auth/dev-auth.guard.ts`, el `req.user = {…}` queda:

```ts
    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      organizationId: user.organizationId,
      role: user.role,
      emailNotificationsEnabled: user.emailNotificationsEnabled,
      preferredLanguage: user.preferredLanguage,
    };
```

- [ ] **Step 4: Actualizar los tres specs con literales de 6 campos**

`auth/__tests__/auth.service.spec.ts` — el `mockUser` (líneas 10-22) gana dos campos:

```ts
const mockUser = {
  id: 'user-student-0001',
  organizationId: SEED_ORG_ID,
  email: 'student@demo',
  passwordHash: '',
  name: 'Sam Student',
  avatarUrl: null,
  role: 'STUDENT' as const,
  onlineAt: null,
  emailVerifiedAt: new Date(),
  emailNotificationsEnabled: true,
  preferredLanguage: 'es',
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

Y el `expect(result.user).toEqual({...})` del test "creates a new user and returns tokens" (~línea 107) queda:

```ts
      expect(result.user).toEqual({
        userId: 'user-student-0001',
        email: 'student@demo',
        name: 'Sam Student',
        avatarUrl: null,
        organizationId: SEED_ORG_ID,
        role: 'STUDENT',
        emailNotificationsEnabled: true,
        preferredLanguage: 'es',
      });
```

`common/auth/__tests__/jwt.strategy.spec.ts` — `userRow` y el `toEqual` quedan:

```ts
const userRow = {
  id: 'user-x', email: 'x@b.co', name: 'X', avatarUrl: null,
  organizationId: 'org-x', role: 'TEACHER' as const,
  emailNotificationsEnabled: true, preferredLanguage: 'es',
};
```

```ts
    expect(out).toEqual({
      userId: 'user-x', email: 'x@b.co', name: 'X', avatarUrl: null,
      organizationId: 'org-x', role: 'TEACHER',
      emailNotificationsEnabled: true, preferredLanguage: 'es',
    });
```

Y renombra el título del test: `'maps the Prisma user row to AuthUser (8 fields)'`.

`common/auth/__tests__/dev-auth.guard.spec.ts` — `userRow` gana los campos:

```ts
const userRow = {
  id: 'user-admin-0001', email: 'admin@demo', name: 'Ad',
  avatarUrl: null, organizationId: 'org-klass-0001', role: 'ADMIN' as const,
  emailNotificationsEnabled: true, preferredLanguage: 'es',
};
```

El último test (`toEqual`, ~línea 70) queda:

```ts
    expect(req.user).toEqual({
      userId: 'user-admin-0001', email: 'admin@demo', name: 'Ad',
      avatarUrl: null, organizationId: 'org-klass-0001', role: 'ADMIN',
      emailNotificationsEnabled: true, preferredLanguage: 'es',
    });
```

Y renombra su título: `'maps the user with all 8 AuthUser fields (incl. email, name, avatarUrl, prefs)'`.

- [ ] **Step 5: Run backend tests — deben pasar todos**

```bash
pnpm --filter @ft-trascendence/backend test
```

Expected: PASS (118 tests existentes, mismos números). Si algún otro test construye `AuthUser` literal, `tsc`/jest lo marcará — añade los 2 campos igual que arriba.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/common/auth apps/backend/src/auth
git commit -m "feat(backend): extiende AuthUser a 8 campos con prefs de cuenta"
```

---

## Task 3: `AuthService.changePassword` + `ChangePasswordDto` (TDD)

**Files:**
- Create: `apps/backend/src/auth/dto/change-password.dto.ts`
- Modify: `apps/backend/src/auth/auth.service.ts`
- Test: `apps/backend/src/auth/__tests__/auth.service.spec.ts`

- [ ] **Step 1: Escribir los tests que fallan**

En `auth.service.spec.ts`: añade `BadRequestException` al import de `@nestjs/common` (línea 1):

```ts
import { BadRequestException, ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
```

Añade este `describe` nuevo dentro de `describe('AuthService')` (por ejemplo tras el `describe('logout')`):

```ts
  describe('changePassword', () => {
    it('updates the hash and revokes all sessions on success', async () => {
      const hash = await argon2.hash('Vieja1234');
      mockUserFindUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });
      mockUserUpdate.mockResolvedValue({});
      mockSessionDeleteMany.mockResolvedValue({ count: 2 });

      const result = await service.changePassword('user-student-0001', {
        currentPassword: 'Vieja1234',
        newPassword: 'Nueva1234',
      });

      expect(result).toEqual({ changed: true });
      const updateData = (mockUserUpdate.mock.calls[0][0] as { data: { passwordHash: string } }).data;
      expect(await argon2.verify(updateData.passwordHash, 'Nueva1234')).toBe(true);
      expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: 'user-student-0001' } });
    });

    it('throws 400 when the current password is wrong (hash and sessions untouched)', async () => {
      const hash = await argon2.hash('Vieja1234');
      mockUserFindUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });

      await expect(
        service.changePassword('user-student-0001', { currentPassword: 'Mal12345', newPassword: 'Nueva1234' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(mockSessionDeleteMany).not.toHaveBeenCalled();
    });

    it('throws 400 for OAuth-only accounts (passwordHash null)', async () => {
      mockUserFindUnique.mockResolvedValue({ ...mockUser, passwordHash: null });

      await expect(
        service.changePassword('user-google-0001', { currentPassword: 'x', newPassword: 'Nueva1234' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it('throws 401 when the user no longer exists', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('ghost', { currentPassword: 'x', newPassword: 'Nueva1234' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a weak new password at the DTO level', async () => {
      const { validate } = await import('class-validator');
      const { ChangePasswordDto } = await import('../dto/change-password.dto');
      const dto = Object.assign(new ChangePasswordDto(), {
        currentPassword: 'Vieja1234',
        newPassword: 'debil',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects unknown fields through the global ValidationPipe config', async () => {
      const { ValidationPipe, BadRequestException: BRE } = await import('@nestjs/common');
      const { ChangePasswordDto } = await import('../dto/change-password.dto');
      const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

      await expect(
        pipe.transform(
          { currentPassword: 'Vieja1234', newPassword: 'Nueva1234', isAdmin: true },
          { type: 'body', metatype: ChangePasswordDto },
        ),
      ).rejects.toThrow(BRE);
    });
  });
```

- [ ] **Step 2: Run — verificar que fallan**

```bash
pnpm --filter @ft-trascendence/backend test -- auth.service.spec.ts
```

Expected: FAIL — `service.changePassword is not a function` (y los dos de DTO fallan al importar `change-password.dto`, que no existe).

- [ ] **Step 3: Implementar el DTO**

Crea `apps/backend/src/auth/dto/change-password.dto.ts`:

```ts
import { IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  // Same policy as RegisterDto.password — keep both in sync.
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword: string;
}
```

- [ ] **Step 4: Implementar `changePassword` en `AuthService`**

En `auth.service.ts`, añade `BadRequestException` al import de `@nestjs/common` (queda `BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException`) y `import type { ChangePasswordDto } from './dto/change-password.dto';` junto a los otros imports de DTOs.

Añade el método tras `logout()` (~línea 202):

```ts
  /**
   * Self-service password change. Verifies the current password, sets the new
   * one and revokes EVERY session (the caller must log in again).
   * Returns 400 (never 401) for a wrong current password so the frontend
   * api-client does not trigger its 401→refresh→retry machinery.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ changed: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    if (!user.passwordHash) {
      throw new BadRequestException('Account has no password (OAuth only)');
    }
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.session.deleteMany({ where: { userId } });
    return { changed: true };
  }
```

- [ ] **Step 5: Run — verificar que pasan**

```bash
pnpm --filter @ft-trascendence/backend test -- auth.service.spec.ts
```

Expected: PASS (suite completa, 6 tests nuevos verdes).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/auth
git commit -m "feat(backend): POST /auth/change-password — servicio + DTO (argon2, revoca sesiones)"
```

---

## Task 4: Ruta `POST /auth/change-password` en el controlador

**Files:**
- Modify: `apps/backend/src/auth/auth.controller.ts`

- [ ] **Step 1: Añadir la ruta**

En `auth.controller.ts`, añade el import del DTO:

```ts
import { ChangePasswordDto } from './dto/change-password.dto';
```

Y la ruta, justo después de `logout` (~línea 54):

```ts
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto);
  }
```

Sin `@Public()` — la protege el guard global (APP_GUARD).

- [ ] **Step 2: Build + tests completos**

```bash
pnpm --filter @ft-trascendence/backend build
pnpm --filter @ft-trascendence/backend test
```

Expected: build limpio · todos los tests verdes.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/auth/auth.controller.ts
git commit -m "feat(backend): expone POST /auth/change-password (guard global)"
```

---

## Task 5: `UpdateProfileDto` extendido + `selectOwnProfile` (TDD)

**Files:**
- Modify: `apps/backend/src/users/dto/update-profile.dto.ts`
- Modify: `apps/backend/src/users/users.service.ts`
- Test: `apps/backend/src/users/__tests__/users.service.spec.ts`

- [ ] **Step 1: Escribir los tests que fallan**

En `users.service.spec.ts`, dentro del `describe('updateProfile')` existente (~línea 183), añade:

```ts
    it('persists preference fields and selects them back (own profile)', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser, emailNotificationsEnabled: false, preferredLanguage: 'en',
      });

      const r = await service.updateProfile('user-student-0001', {
        emailNotificationsEnabled: false,
        preferredLanguage: 'en',
      });

      const args = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(args.data).toEqual({ emailNotificationsEnabled: false, preferredLanguage: 'en' });
      expect(args.select.emailNotificationsEnabled).toBe(true);
      expect(args.select.preferredLanguage).toBe(true);
      expect(r.emailNotificationsEnabled).toBe(false);
      expect(r.preferredLanguage).toBe('en');
    });

    it('persists avatarUrl as a plain string', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser, avatarUrl: '/api/files/file-1/url',
      });

      await service.updateProfile('user-student-0001', { avatarUrl: '/api/files/file-1/url' });

      const args = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(args.data).toEqual({ avatarUrl: '/api/files/file-1/url' });
    });

    it('rejects an invalid preferredLanguage at the DTO level', async () => {
      const { validate } = await import('class-validator');
      const { UpdateProfileDto } = await import('../../dto/update-profile.dto');
      const dto = Object.assign(new UpdateProfileDto(), { preferredLanguage: 'fr' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('keeps prefs out of the public profile select (listFriends)', async () => {
      (prisma.friendship.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await service.listFriends('user-student-0001');

      const args = (prisma.user.findMany as jest.Mock).mock.calls[0][0];
      expect(args.select.emailNotificationsEnabled).toBeUndefined();
      expect(args.select.preferredLanguage).toBeUndefined();
    });
```

- [ ] **Step 2: Run — verificar que fallan**

```bash
pnpm --filter @ft-trascendence/backend test -- users.service.spec.ts
```

Expected: FAIL — el 1º (`select.emailNotificationsEnabled` undefined), y el de DTO por idioma aún sin `@IsIn`.

- [ ] **Step 3: Extender el DTO**

`apps/backend/src/users/dto/update-profile.dto.ts` completo:

```ts
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  /** Relative file URL returned by FilesService (e.g. /api/files/:id/url) */
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsBoolean()
  @IsOptional()
  emailNotificationsEnabled?: boolean;

  /** UI language preference — stored now, applied when i18n lands (Phase C) */
  @IsIn(['es', 'en'])
  @IsOptional()
  preferredLanguage?: string;
}
```

- [ ] **Step 4: `selectOwnProfile` en `users.service.ts`**

Tras `selectPublicProfile` (~línea 30), añade:

```ts
/** Own profile: public fields + private account data (prefs). Only for /me endpoints. */
const selectOwnProfile = {
  ...selectPublicProfile,
  email: true, organizationId: true,
  emailNotificationsEnabled: true, preferredLanguage: true,
} as const;
```

Y en `updateProfile` (~línea 106) cambia el select:

```ts
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto, select: selectOwnProfile });
  }
```

- [ ] **Step 5: Run — verificar que pasan**

```bash
pnpm --filter @ft-trascendence/backend test -- users.service.spec.ts
```

Expected: PASS (4 tests nuevos verdes).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/users
git commit -m "feat(backend): PATCH /users/me acepta avatarUrl + prefs (selectOwnProfile)"
```

---

## Task 6: Frontend — `AuthUser` type + `MOCK_USER`

**Files:**
- Modify: `apps/frontend/src/lib/api/types.ts:12-19`
- Modify: `apps/frontend/src/lib/api/auth-context.tsx:40-47`

- [ ] **Step 1: Extender el interface**

En `types.ts`:

```ts
export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  organizationId: string;
  role: GlobalRole;
  emailNotificationsEnabled: boolean;
  preferredLanguage: string;
}
```

- [ ] **Step 2: Actualizar MOCK_USER**

En `auth-context.tsx`:

```ts
const MOCK_USER: AuthUser = {
  userId: 'user-lucia-001',
  email: 'dev@example.com',
  name: 'Lucía Molina',
  avatarUrl: null,
  organizationId: 'org-klass-0001',
  role: 'STUDENT', // STUDENT to see the student dashboard
  emailNotificationsEnabled: true,
  preferredLanguage: 'es',
};
```

- [ ] **Step 3: Build — `tsc` marca cualquier otro constructor de AuthUser**

```bash
pnpm --filter frontend build
```

Expected: PASS. Si `tsc` se queja de otro objeto literal al que le falten los campos, añádelos (es el compilador haciendo de checklist).

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/lib/api/types.ts apps/frontend/src/lib/api/auth-context.tsx
git commit -m "feat(frontend): AuthUser 8 campos (prefs) en types + mock"
```

---

## Task 7: Componente `Toggle` (design system)

**Files:**
- Create: `apps/frontend/src/components/ui/Toggle.tsx`
- Create: `apps/frontend/src/components/ui/Toggle.module.css`
- Modify: `apps/frontend/src/components/ui/index.ts`

- [ ] **Step 1: Crear `Toggle.tsx`**

```tsx
/**
 * Toggle Component
 *
 * Switch control for boolean preferences. Built on a native <button> with
 * role="switch", so keyboard (Space/Enter) and focus work out of the box.
 *
 * Usage:
 *   <Toggle checked={enabled} onChange={setEnabled} aria-label="Notificaciones" />
 */
import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  id,
  'aria-label': ariaLabel,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      id={id}
      disabled={disabled}
      className={[styles.track, checked && styles.on, disabled && styles.disabled]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} aria-hidden="true" />
    </button>
  );
}

Toggle.displayName = 'Toggle';
```

- [ ] **Step 2: Crear `Toggle.module.css`**

Solo tokens (regla de la Épica 0 — nada de valores crudos de color):

```css
.track {
  width: 2.625rem; /* 42px — matches the previous static mock proportions */
  height: 1.5rem; /* 24px */
  border-radius: var(--radius-full);
  border: none;
  padding: 0;
  background: var(--color-border-secondary);
  position: relative;
  cursor: pointer;
  transition: background var(--transition-fast);
  flex: none;
}

.track:hover:not(.disabled) {
  filter: brightness(0.97);
}

.on {
  background: var(--color-accent-primary);
}

.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 1.25rem; /* 20px */
  height: 1.25rem;
  border-radius: var(--radius-full);
  background: var(--color-bg-secondary);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast);
}

.on .knob {
  transform: translateX(1.125rem); /* 42 - 20 - 4 = 18px */
}

.track:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Barrel export**

En `apps/frontend/src/components/ui/index.ts`, en la sección `// Form controls` (tras la línea de `DatePicker`):

```ts
export { Toggle, type ToggleProps } from './Toggle';
```

- [ ] **Step 4: Build**

```bash
pnpm --filter frontend build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/ui
git commit -m "feat(ui): Toggle accesible (role=switch) para el design system"
```

---

## Task 8: Hooks `useUpdateProfile` + `useChangePassword` + tipos de perfil

**Files:**
- Create: `apps/frontend/src/features/profile/types.ts`
- Create: `apps/frontend/src/lib/api/hooks/useUpdateProfile.ts`
- Create: `apps/frontend/src/lib/api/hooks/useChangePassword.ts`
- Modify: `apps/frontend/src/lib/api/hooks/index.ts`

- [ ] **Step 1: Crear `features/profile/types.ts`**

Siguiendo el patrón de `features/admin/types` / `features/org/types` (tipos junto a la feature):

```ts
/**
 * Profile feature types — self-service account endpoints (PATCH /users/me).
 */

/** Input for PATCH /users/me. All fields optional (partial update). */
export interface UpdateProfileInput {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  emailNotificationsEnabled?: boolean;
  preferredLanguage?: string;
}

/** Response of PATCH /users/me — own profile (public fields + private prefs). */
export interface OwnProfileDTO {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  bio: string | null;
  onlineAt: string | null;
  email: string;
  organizationId: string;
  emailNotificationsEnabled: boolean;
  preferredLanguage: string;
}
```

- [ ] **Step 2: Crear `useUpdateProfile.ts`**

```ts
import { useState, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { OwnProfileDTO, UpdateProfileInput } from '@/features/profile/types';

interface UseUpdateProfileResult {
  updateProfile: (input: UpdateProfileInput) => Promise<OwnProfileDTO>;
  isSaving: boolean;
  error: Error | null;
}

/**
 * PATCH /users/me, then re-sync the auth-context (navbar name/avatar, prefs)
 * via refreshUser(). Throws on failure — the caller shows the toast.
 */
export function useUpdateProfile(): UseUpdateProfileResult {
  const { refreshUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      setIsSaving(true);
      setError(null);
      try {
        const updated = await apiClient.patch<OwnProfileDTO>('/users/me', input);
        await refreshUser();
        return updated;
      } catch (err) {
        const e = err as Error;
        setError(e);
        throw e;
      } finally {
        setIsSaving(false);
      }
    },
    [refreshUser],
  );

  return { updateProfile, isSaving, error };
}
```

- [ ] **Step 3: Crear `useChangePassword.ts`**

```ts
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import { useToast } from '@/components/ui';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

interface UseChangePasswordResult {
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  isSaving: boolean;
  error: Error | null;
}

/**
 * POST /auth/change-password. The server revokes EVERY session on success, so
 * the success path clears local tokens (no API logout call — the refresh token
 * is already dead) and redirects to /login with a toast.
 * A 400 (wrong current password / OAuth-only account) is stored in `error` and
 * re-thrown so the form can show it inline.
 */
export function useChangePassword(): UseChangePasswordResult {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const changePassword = useCallback(
    async (input: ChangePasswordInput) => {
      setIsSaving(true);
      setError(null);
      try {
        await apiClient.post('/auth/change-password', input);
        logout(); // local cleanup only — sessions are already revoked server-side
        toast({ variant: 'success', message: 'Contraseña actualizada — inicia sesión de nuevo' });
        navigate('/login');
      } catch (err) {
        const e = err as Error;
        setError(e);
        throw e;
      } finally {
        setIsSaving(false);
      }
    },
    [logout, navigate, toast],
  );

  return { changePassword, isSaving, error };
}
```

Nota: en dev con `VITE_DEV_USER_ID`/header `x-dev-user` activo, la siguiente recarga completa
volvería a autenticar al dev-user (bypass de dev documentado en Epic 1). No es un bug de esta
feature — el flujo real (sin bypass) queda cubierto por el E2E, que limpia `dev-user-id`.

- [ ] **Step 4: Barrel exports (DOS sitios — `lib/api/index.ts` re-exporta por nombre)**

En `apps/frontend/src/lib/api/hooks/index.ts`, al final:

```ts
export { useUpdateProfile } from './useUpdateProfile';
export { useChangePassword, type ChangePasswordInput } from './useChangePassword';
```

Y en `apps/frontend/src/lib/api/index.ts`, dentro del bloque `export { … } from './hooks';`
(por ejemplo tras `useUpcomingAssignments`):

```ts
  useUpcomingAssignments,
  useUpdateProfile,
  useChangePassword,
} from './hooks';
```

- [ ] **Step 5: Build**

```bash
pnpm --filter frontend build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/profile/types.ts apps/frontend/src/lib/api/hooks
git commit -m "feat(frontend): hooks useUpdateProfile + useChangePassword"
```

---

## Task 9: `ProfilePage` rewrite (design system, cero mock)

**Files:**
- Modify: `apps/frontend/src/features/profile/ProfilePage.tsx` (rewrite completo)
- Create: `apps/frontend/src/features/profile/ProfilePage.module.css`

- [ ] **Step 1: Crear `ProfilePage.module.css`**

```css
.page {
  padding: var(--space-8) var(--space-10);
  max-width: 40rem; /* 640px — same measure as the previous page */
}

.title {
  font-size: var(--text-2xl);
  font-weight: var(--font-extrabold);
  letter-spacing: -0.02em;
  margin: 0 0 var(--space-6);
}

.section {
  margin-bottom: var(--space-5);
}

.identityRow {
  display: flex;
  gap: var(--space-5);
  align-items: center;
  margin-bottom: var(--space-5);
}

.avatar {
  width: 4rem;
  height: 4rem;
  border-radius: var(--radius-full);
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-extrabold);
  font-size: var(--text-2xl);
  flex: none;
  overflow: hidden;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.displayName {
  font-size: var(--text-xl);
  font-weight: var(--font-extrabold);
}

.meta {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.upload {
  margin-bottom: var(--space-5);
}

.nameForm {
  display: grid;
  gap: var(--space-3);
}

.passwordForm {
  display: grid;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) 0;
  border-top: 1px solid var(--color-border-primary);
}

.row:first-of-type {
  border-top: none;
  padding-top: 0;
}

.rowTitle {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.rowHint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.languageSelect {
  width: 10rem;
}

.loading {
  display: flex;
  justify-content: center;
  padding: var(--space-16);
}
```

- [ ] **Step 2: Reescribir `ProfilePage.tsx`**

```tsx
import { useEffect, useState, type ChangeEvent } from 'react';
import { useAuth, useUpdateProfile, useChangePassword } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  FileUpload,
  Input,
  Select,
  Spinner,
  Toggle,
  useToast,
  type FileValue,
} from '@/components/ui';
import styles from './ProfilePage.module.css';

// Same policy as the backend DTOs (register/change-password).
const PASSWORD_RULE = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { updateProfile, isSaving: isSavingProfile } = useUpdateProfile();
  const { changePassword, isSaving: isSavingPassword } = useChangePassword();

  // ── Avatar ─────────────────────────────────────────────────────────────
  const [avatarFiles, setAvatarFiles] = useState<FileValue[]>([]);

  const handleAvatarChange = async (files: FileValue[]) => {
    setAvatarFiles(files);
    const done = files.find((f) => f.status === 'done' && f.url);
    if (done?.url) {
      try {
        await updateProfile({ avatarUrl: done.url });
        toast({ variant: 'success', message: 'Foto de perfil actualizada' });
      } catch {
        toast({ variant: 'error', message: 'No se pudo guardar la foto de perfil' });
      }
    }
  };

  // ── Name ───────────────────────────────────────────────────────────────
  const [name, setName] = useState(user?.name ?? '');
  const [nameError, setNameError] = useState<string>();
  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('El nombre no puede estar vacío');
      return;
    }
    setNameError(undefined);
    try {
      await updateProfile({ name: trimmed });
      toast({ variant: 'success', message: 'Nombre actualizado' });
    } catch {
      toast({ variant: 'error', message: 'No se pudo actualizar el nombre' });
    }
  };

  // ── Password ───────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string;
    next?: string;
    confirm?: string;
  }>({});

  const handleChangePassword = async () => {
    const errors: typeof passwordErrors = {};
    if (!currentPassword) errors.current = 'Introduce tu contraseña actual';
    if (newPassword.length < 8 || !PASSWORD_RULE.test(newPassword)) {
      errors.next = 'Mínimo 8 caracteres, con mayúscula, minúscula y número';
    }
    if (confirmPassword !== newPassword) errors.confirm = 'Las contraseñas no coinciden';
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      await changePassword({ currentPassword, newPassword });
      // Success path: the hook clears tokens, toasts and redirects to /login.
    } catch (err) {
      // 400 from the server (wrong current password / OAuth-only account)
      setPasswordErrors({
        current: (err as Error).message || 'No se pudo cambiar la contraseña',
      });
    }
  };

  // ── Preferences ────────────────────────────────────────────────────────
  const handleToggleNotifications = async (next: boolean) => {
    try {
      await updateProfile({ emailNotificationsEnabled: next });
      toast({
        variant: 'success',
        message: next ? 'Notificaciones activadas' : 'Notificaciones desactivadas',
      });
    } catch {
      toast({ variant: 'error', message: 'No se pudo guardar la preferencia' });
    }
  };

  const handleLanguageChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    try {
      await updateProfile({ preferredLanguage: e.target.value });
      toast({ variant: 'success', message: 'Idioma guardado' });
    } catch {
      toast({ variant: 'error', message: 'No se pudo guardar el idioma' });
    }
  };

  if (!user) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const roleLabel =
    user.role === 'STUDENT' ? 'Alumno' : user.role === 'TEACHER' ? 'Profesor' : 'Admin';

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Perfil</h1>

      <Card title="Identidad" className={styles.section}>
        <div className={styles.identityRow}>
          <div className={styles.avatar}>
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}
          </div>
          <div>
            <div className={styles.displayName}>{user.name}</div>
            <div className={styles.meta}>
              {roleLabel} · {user.email}
            </div>
          </div>
        </div>

        <div className={styles.upload}>
          <FileUpload
            accept="image/*"
            maxSizeBytes={5 * 1024 * 1024}
            multiple={false}
            maxFiles={1}
            organizationId={user.organizationId}
            uploaderId={user.userId}
            value={avatarFiles}
            onChange={handleAvatarChange}
            autoUpload
            hint="Foto de perfil. Formatos: JPG, PNG, WebP. Máximo 5 MB."
          />
        </div>

        <div className={styles.nameForm}>
          <Input
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={nameError}
          />
          <div>
            <Button
              onClick={handleSaveName}
              loading={isSavingProfile}
              disabled={name.trim() === user.name}
            >
              Guardar cambios
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Seguridad" className={styles.section}>
        <div className={styles.passwordForm}>
          <Input
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            error={passwordErrors.current}
          />
          <Input
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={passwordErrors.next}
            hint="Mínimo 8 caracteres, con mayúscula, minúscula y número"
          />
          <Input
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={passwordErrors.confirm}
          />
          <div>
            <Button onClick={handleChangePassword} loading={isSavingPassword}>
              Cambiar contraseña
            </Button>
          </div>
        </div>

        <div className={styles.row}>
          <div>
            <div className={styles.rowTitle}>Autenticación en dos pasos</div>
            <div className={styles.rowHint}>Protege tu cuenta con TOTP</div>
          </div>
          <Badge variant="info">Próximamente</Badge>
        </div>
      </Card>

      <Card title="Preferencias" className={styles.section}>
        <div className={styles.row}>
          <div>
            <div className={styles.rowTitle}>Notificaciones por email</div>
            <div className={styles.rowHint}>Resumen semanal de actividad</div>
          </div>
          <Toggle
            checked={user.emailNotificationsEnabled}
            onChange={handleToggleNotifications}
            disabled={isSavingProfile}
            aria-label="Notificaciones por email"
          />
        </div>
        <div className={styles.row}>
          <div>
            <div className={styles.rowTitle}>Idioma</div>
            <div className={styles.rowHint}>
              El idioma de la interfaz llegará en una próxima versión
            </div>
          </div>
          <Select
            value={user.preferredLanguage}
            onChange={handleLanguageChange}
            disabled={isSavingProfile}
            fullWidth={false}
            aria-label="Idioma"
            options={[
              { value: 'es', label: 'Español' },
              { value: 'en', label: 'English' },
            ]}
            className={styles.languageSelect}
          />
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Build**

```bash
pnpm --filter frontend build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/profile
git commit -m "feat(frontend): ProfilePage real — nombre, avatar persistente, password, prefs"
```

---

## Task 10: Smoke de API (integración con la stack real)

**Files:** ninguno (verificación manual con comandos).

- [ ] **Step 1: Asegurar la stack arriba con el schema aplicado**

```bash
make up
make db-push        # idempotente — asegura las 2 columnas
make db-seed        # si la DB está vacía
```

- [ ] **Step 2: Login devuelve AuthUser de 8 campos**

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"student@demo","password":"demo1234"}'
```

Expected: JSON con `"user": { …, "emailNotificationsEnabled": true, "preferredLanguage": "es" }` + `accessToken` + `refreshToken`.

- [ ] **Step 3: Flujo change-password completo (usuario desechable)**

```bash
# 1. Registrar usuario desechable
curl -s -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke-a5@demo","password":"Vieja1234","name":"Smoke A5"}'
# → guarda accessToken (AT) y refreshToken (RT) de la respuesta

# 2. Cambiar contraseña con la actual correcta
curl -s -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"Vieja1234","newPassword":"Nueva1234"}'
```

Expected: `{"changed":true}`.

```bash
# 3. El refresh token anterior está revocado
curl -s -X POST http://localhost:3000/auth/refresh \
  -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT\"}"
```

Expected: `401` (`Invalid refresh token`).

```bash
# 4. Login con la contraseña VIEJA falla; con la NUEVA entra
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"smoke-a5@demo","password":"Vieja1234"}'
# → 401
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"smoke-a5@demo","password":"Nueva1234"}'
# → 200 con tokens
```

- [ ] **Step 4: Contraseña actual incorrecta → 400 (no 401)**

```bash
curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer $AT2" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"Mal12345","newPassword":"Otra1234"}'
```

(`$AT2` = accessToken del login nuevo del paso 3.) Expected: `400` con mensaje `Current password is incorrect`.

- [ ] **Step 5: PATCH /users/me con prefs + avatarUrl**

```bash
curl -s -X PATCH http://localhost:3000/users/me \
  -H "Authorization: Bearer $AT2" -H 'Content-Type: application/json' \
  -d '{"emailNotificationsEnabled":false,"preferredLanguage":"en","avatarUrl":"/api/files/x/url"}'
```

Expected: 200 con el perfil propio incluyendo `emailNotificationsEnabled: false`, `preferredLanguage: "en"`, `avatarUrl`. Y `GET /auth/me` con el mismo token devuelve las prefs actualizadas.

```bash
# Idioma inválido → 400
curl -s -o /dev/null -w '%{http_code}' -X PATCH http://localhost:3000/users/me \
  -H "Authorization: Bearer $AT2" -H 'Content-Type: application/json' \
  -d '{"preferredLanguage":"fr"}'
```

Expected: `400`.

- [ ] **Step 6: Commit (solo si hubo que arreglar algo)**

Si el smoke destapó algún fallo, corrige y commitea el fix (`fix(backend): …`). Si todo fue limpio, no hay commit.

---

## Task 11: E2E `profile.spec.ts` (Playwright)

**Files:**
- Create: `apps/frontend/e2e/profile.spec.ts`

Prerequisito: stack levantada (`make up`) — el config usa `baseURL: http://localhost:5173` y la API en `:3000`.

- [ ] **Step 1: Escribir el spec**

```ts
import { test, expect } from '@playwright/test';
import { actAs } from './dev-user';

/**
 * A5 — Perfil y cuenta reales.
 *
 * Uses a THROWAWAY user (POST /auth/register in beforeAll) so seeded users'
 * passwords are never mutated. The dev auth layer (x-dev-user via localStorage)
 * impersonates the throwaway user for the UI flows; the password flow switches
 * to the real login page after removing the dev-user-id key.
 */

const BASE_URL = 'http://localhost:3000';
const EMAIL = `e2e-profile-${Date.now()}@demo`;
const OLD_PASSWORD = 'Vieja1234';
const NEW_PASSWORD = 'Nueva1234';

let userId = '';
let refreshToken = '';

test.describe('A5 — Perfil y cuenta reales', () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${BASE_URL}/auth/register`, {
      data: { email: EMAIL, password: OLD_PASSWORD, name: 'E2E Perfil' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    userId = body.user.userId;
    refreshToken = body.refreshToken;
  });

  test('editar nombre persiste tras recargar', async ({ page }) => {
    await actAs(page, userId);
    await page.goto('/profile');

    await page.getByLabel('Nombre').fill('Nombre Cambiado');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Nombre actualizado')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Nombre')).toHaveValue('Nombre Cambiado');
    await page.screenshot({ path: 'e2e/screenshots/profile-name.png' });
  });

  test('preferencias persisten tras recargar', async ({ page }) => {
    await actAs(page, userId);
    await page.goto('/profile');

    await page.getByRole('switch', { name: 'Notificaciones por email' }).click();
    await expect(page.getByText('Notificaciones desactivadas')).toBeVisible();
    await page.getByLabel('Idioma').selectOption('en');
    await expect(page.getByText('Idioma guardado')).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole('switch', { name: 'Notificaciones por email' }),
    ).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByLabel('Idioma')).toHaveValue('en');
    await page.screenshot({ path: 'e2e/screenshots/profile-prefs.png' });
  });

  test('cambiar contraseña revoca sesiones y permite re-login', async ({ page, request }) => {
    await actAs(page, userId);
    await page.goto('/profile');

    await page.getByLabel('Contraseña actual').fill(OLD_PASSWORD);
    await page.getByLabel('Nueva contraseña').fill(NEW_PASSWORD);
    await page.getByLabel('Confirmar contraseña').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(
      page.getByText('Contraseña actualizada — inicia sesión de nuevo'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    // Sessions revoked: the pre-change refresh token is dead.
    const refresh = await request.post(`${BASE_URL}/auth/refresh`, {
      data: { refreshToken },
    });
    expect(refresh.status()).toBe(401);

    // Real login page (dev bypass removed): old password fails, new one works.
    await page.evaluate(() => window.localStorage.removeItem('dev-user-id'));
    await page.goto('/login');

    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(OLD_PASSWORD);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.screenshot({ path: 'e2e/screenshots/profile-password.png' });
  });
});
```

- [ ] **Step 2: Ejecutar el spec**

```bash
pnpm --filter frontend test:e2e e2e/profile.spec.ts
```

Expected: `3 passed`. Si un selector falla, NO relajes la aserción — corrige el selector (los labels exactos están en el código de la Task 9; el login usa `Email`/`Password`/`Iniciar sesión`).

- [ ] **Step 3: Revisar las capturas**

Abre `apps/frontend/e2e/screenshots/profile-*.png` y verifica contra la DoD visual: design system compuesto, sin estilos rotos, estados correctos.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/e2e/profile.spec.ts
git commit -m "test(e2e): flujo de perfil — nombre, prefs y cambio de contraseña"
```

---

## Task 12: DoD sweep + bitácora

**Files:**
- Modify: `docs/planning/desarrollo_jorge.md`

- [ ] **Step 1: Suite completa backend + build de todo**

```bash
pnpm --filter @ft-trascendence/backend test
pnpm -r run build
```

Expected: backend 128 tests verdes (118 + 10 nuevos: 6 auth + 4 users) · build limpio en todos los paquetes.

- [ ] **Step 2: Suite E2E completa (regresión)**

```bash
pnpm --filter frontend test:e2e
```

Expected: verde (los 9 specs marcados `fixme` por QA de Aloiki se saltan — es lo esperado). Cero errores de consola en los flujos de perfil.

- [ ] **Step 3: Smoke visual manual en Chrome**

Con la stack arriba: login real → `/profile` → cambiar nombre → subir avatar → toggle prefs → cambiar contraseña → re-login. Verificar: cero warnings/errores en consola, responsive (DevTools móvil), foco visible y teclado (Tab + Space en el Toggle).

- [ ] **Step 4: Actualizar la bitácora**

Añade el **Bloque 11** a `docs/planning/desarrollo_jorge.md`: tareas completadas, commits, tests (números), resultado del smoke, y actualiza §1 Estado (A5 ✅ implementada, siguiente: A3). Actualiza también el grafo de conocimiento (engram) con el estado final.

- [ ] **Step 5: Commit**

```bash
git add docs/planning/desarrollo_jorge.md
git commit -m "docs(log): Bloque 11 — A5 perfil y cuenta reales implementada"
```

---

## Self-Review (ya aplicada)

- **Spec coverage:** schema (T1) · AuthUser extensión (T2+T6) · change-password backend (T3+T4) · DTO prefs + selectOwnProfile (T5) · Toggle (T7) · hooks (T8) · ProfilePage (T9) · smoke (T10) · E2E (T11) · DoD + bitácora (T12). Todo lo de la spec §5-§9 tiene tarea.
- **Riesgos conocidos ya cubiertos:** specs con literales de AuthUser (T2 Step 4) · 400-vs-401 (T3) · race dev-user-id en E2E (T11, se limpia antes del login real) · usuario desechable (T10/T11) · prefs fuera del select público (T5 Step 1, test 4).
