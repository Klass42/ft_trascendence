# Epic 1 — Auth contracts + Prisma seed · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Jorge's Identity & Access primitives (`common/auth/`) + a deterministic
`prisma/seed.ts` so every teammate can protect endpoints and reach real demo rows
*before* the login flow (Epic 2) exists.

**Architecture:** A `@Global CommonModule` exports guards + decorators + `JwtModule`.
`DevAuthGuard` (reader of the `x-dev-user` header, dev-only) is the operative guard
during the pre-login phase; `JwtAuthGuard` (passport-jwt) is finished but inert until
tokens are issued in Epic 2. `@Roles()`+`RolesGuard` enable RBAC. Seed writes stable IDs
(`org-klass-0001`, `user-*-0001`) via `upsert` so `VITE_DEV_USER_ID` is shareable.

**Tech Stack:** NestJS 10, Prisma 6 (Postgres 16), argon2 (password hashing),
@nestjs/jwt + @nestjs/passport + passport-jwt, Jest 29 + @nestjs/testing
(unit/logic) + supertest (smoke via TestingModule), pnpm 9, Node 22.

**Spec:** `docs/superpowers/specs/2026-07-09-epic1-auth-contracts-seed-design.md`.
**Tracker:** `docs/planning/desarrollo_jorge.md`.

---

## File Structure (what gets created/modified)

```
apps/backend/
  package.json                              # MODIFY: deps, prisma.seed, test scripts
  tsconfig.json                              # MODIFY (if needed by jest paths)
  jest.config.ts                            # CREATE
  src/
    common/
      common.module.ts                      # CREATE — @Global, exports guards + JwtModule
      auth/
        auth-user.type.ts                   # CREATE — AuthUser (6 fields) + GlobalRole
        current-user.decorator.ts           # CREATE — @CurrentUser()
        roles.decorator.ts                  # CREATE — @Roles(...roles)
        roles.guard.ts                      # CREATE — RolesGuard
        jwt.strategy.ts                     # CREATE — JwtStrategy (passport-jwt)
        jwt-auth.guard.ts                   # CREATE — JwtAuthGuard
        dev-auth.guard.ts                   # CREATE — DevAuthGuard (x-dev-user)
        index.ts                            # CREATE — barrel
        __tests__/
          current-user.decorator.spec.ts
          roles.guard.spec.ts
          dev-auth.guard.spec.ts
          jwt.strategy.spec.ts
    app.module.ts                            # MODIFY — add CommonModule import
  prisma/
    seed.ts                                  # CREATE — deterministic seed, stable IDs
Makefile                                     # MODIFY — add db-seed target
docs/planning/desarrollo_jorge.md            # MODIFY — log Block 1 when done
```

Unit responsibility boundaries:
- `auth-user.type.ts` — pure type only, no runtime. Single import surface.
- Each guard is one file with one responsibility (authenticate-via-JWT OR authenticate-via-dev-header OR authorize-by-role).
- `index.ts` re-exports; nothing else lives in `common/auth/` except `__tests__/`.
- `CommonModule` is the only place that registers `JwtModule` (so feature modules don't repeat config).

---

## Prerequisites / Branch hygiene

- [ ] **Step 0.1: Confirm branch and clean tree**

```bash
git branch --show-current        # must be 'jorge'
git status                       # clean (allowed: uncommitted spec/tracker/Jorge.md from brainstorm)
```
If dirty with the brainstorm docs (expected), that's fine — they get committed in Task 1.

- [ ] **Step 0.2: Sync with remote staging in case anything moved**

```bash
git fetch origin --prune
git rev-list --left-right --count origin/jorge...origin/staging   # expect '0 0'
```
If staging is ahead, `git merge --ff-only origin/staging` first.

---

## Task 1: Install dependencies + configure Jest + commit docs from brainstorm

**Files:**
- Modify: `apps/backend/package.json`
- Create: `apps/backend/jest.config.ts`
- Modify: `apps/backend/tsconfig.json` (jest paths, only if needed)
- Modify: `docs/planning/desarrollo_jorge.md` (mark Task 1 done)

- [ ] **Step 1.1: Install runtime deps**

```bash
pnpm --filter @ft-trascendence/backend add argon2 @nestjs/jwt @nestjs/passport passport passport-jwt
```
Expected exit 0. Verify `apps/backend/package.json` `dependencies` now lists all five.

- [ ] **Step 1.2: Install dev deps (test runner + types + seed runner)**

```bash
pnpm --filter @ft-trascendence/backend add -D jest @types/jest ts-jest @nestjs/testing supertest @types/supertest @types/passport-jwt ts-node
```
Expected exit 0. `devDependencies` now lists all seven.

- [ ] **Step 1.3: Create `apps/backend/jest.config.ts`**

```ts
import type { Config } from 'jest';

export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'src.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts'],
  testTimeout: 10000,
} satisfies Config;
```

- [ ] **Step 1.4: Add scripts to `apps/backend/package.json`**

In the `"scripts"` block, add:
```json
"test": "jest",
"test:watch": "jest --watch",
"test:cov": "jest --coverage"
```
Then add the Prisma seed config alongside (next to the existing scripts / deps, at the top level of the JSON):
```json
"prisma": { "seed": "ts-node prisma/seed.ts" }
```

Run `pnpm --filter @ft-trascendence/backend exec jest --version` and expect a version banner (≥ 29).

- [ ] **Step 1.5: Smoke test — Jest loads with no spec files**

```bash
pnpm --filter @ft-trascendence/backend test
```
Expected: `No tests found` message (exit code 1 is OK here — it just means zero specs exist yet). If you see a config/transform error, fix `jest.config.ts` before continuing.

- [ ] **Step 1.6: Commit (docs from brainstorm + test infra together)**

```bash
git add docs/superpowers/specs/2026-07-09-epic1-auth-contracts-seed-design.md \
        docs/planning/desarrollo_jorge.md \
        docs/planning/Jorge.md \
        apps/backend/package.json apps/backend/jest.config.ts pnpm-lock.yaml
git commit -m "feat(backend): add auth deps + jest config; docs: epic 1 spec + progress tracker"
```

---

## Task 2: AuthUser type + barrel + @CurrentUser decorator

**Files:**
- Create: `apps/backend/src/common/auth/auth-user.type.ts`
- Create: `apps/backend/src/common/auth/current-user.decorator.ts`
- Create: `apps/backend/src/common/auth/index.ts`
- Test: `apps/backend/src/common/auth/__tests__/current-user.decorator.spec.ts`

- [ ] **Step 2.1: Write failing test for `@CurrentUser()`**

`apps/backend/src/common/auth/__tests__/current-user.decorator.spec.ts`:
```ts
import { ExecutionContext } from '@nestjs/common';
import {CurrentUser} from '../current-user.decorator';
import type { AuthUser } from '../auth-user.type';

describe('@CurrentUser()', () => {
  it('returns req.user when present', () => {
    const user: AuthUser = {
      userId: 'user-1', email: 'a@b.co', name: 'A',
      avatarUrl: null, organizationId: 'org-1', role: 'STUDENT',
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
    expect(CurrentUser(undefined, ctx)).toEqual(user);
  });

  it('throws when req.user is undefined (forgot to apply a guard)', () => {
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;
    expect(() => CurrentUser(undefined, ctx)).toThrow(/@CurrentUser/);
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `pnpm --filter @ft-trascendence/backend test -- current-user`
Expected: FAIL — `Cannot find module '../current-user.decorator'` (and `'../auth-user.type'`).

- [ ] **Step 2.3: Create `auth-user.type.ts`**

```ts
export type GlobalRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

/**
 * Identity of the authenticated user. MUST match the frontend contract in
 * apps/frontend/src/lib/api/types.ts (6 fields). Do not reduce fields without
 * coordinating with the frontend.
 */
export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  organizationId: string;
  role: GlobalRole;
}
```

- [ ] **Step 2.4: Create `current-user.decorator.ts`**

```ts
import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthUser } from './auth-user.type';

/**
 * Param decorator that yields the authenticated AuthUser on `req.user`.
 * Throws if no auth guard populated `req.user` — a programming error, not
 * a 401 for the end user. Always pair with a guard (DevAuthGuard / JwtAuthGuard).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user) {
      throw new UnauthorizedException(
        '@CurrentUser() used without an auth guard — add @UseGuards to this route',
      );
    }
    return req.user;
  },
);
```

- [ ] **Step 2.5: Create barrel `index.ts`**

```ts
export * from './auth-user.type';
export * from './current-user.decorator';
export * from './roles.decorator';
export * from './roles.guard';
export * from './jwt.strategy';
export * from './jwt-auth.guard';
export * from './dev-auth.guard';
```
(This forward-references files created in later tasks — that's fine, the barrel is unused until all of them exist.)

- [ ] **Step 2.6: Run test to verify it passes**

Run: `pnpm --filter @ft-trascendence/backend test -- current-user`
Expected: PASS (2 tests).

- [ ] **Step 2.7: Commit**

```bash
git add apps/backend/src/common/auth/auth-user.type.ts \
        apps/backend/src/common/auth/current-user.decorator.ts \
        apps/backend/src/common/auth/index.ts \
        apps/backend/src/common/auth/__tests__/current-user.decorator.spec.ts
git commit -m "feat(auth): add AuthUser type (6 fields) + @CurrentUser() decorator"
```

---

## Task 3: @Roles() decorator + RolesGuard

**Files:**
- Create: `apps/backend/src/common/auth/roles.decorator.ts`
- Create: `apps/backend/src/common/auth/roles.guard.ts`
- Test: `apps/backend/src/common/auth/__tests__/roles.guard.spec.ts`

- [ ] **Step 3.1: Write failing test for RolesGuard**

```ts
import { ExecutionContext, Reflector } from '@nestjs/common';
import { Roles } from '../roles.decorator';
import { RolesGuard } from '../roles.guard';
import type { AuthUser } from '../auth-user.type';

const mkCtx = (role: AuthUser['role'] | undefined) =>
  ({
    getHandler: () => someHandler,
    switchToHttp: () => ({
      getRequest: () => (role ? {
        user: {
          userId: 'u', email: 'a@b.co', name: 'A',
          avatarUrl: null, organizationId: 'org', role,
        } as AuthUser,
      } : {}),
    }),
  }) as unknown as ExecutionContext;

const someHandler = function handler() {};

describe('RolesGuard', () => {
  it('allows when no @Roles metadata (auth-only)', async () => {
    const guard = new RolesGuard(new Reflector());
    expect(await guard.canActivate(mkCtx('STUDENT'))).toBe(true);
  });

  it('allows when user role is in the list', async () => {
    Reflect.defineMetadata('roles', ['ADMIN'], someHandler);
    const guard = new RolesGuard(new Reflector());
    expect(await guard.canActivate(mkCtx('ADMIN'))).toBe(true);
  });

  it('denies when user role not in the list', async () => {
    Reflect.defineMetadata('roles', ['ADMIN'], someHandler);
    const guard = new RolesGuard(new Reflector());
    expect(await guard.canActivate(mkCtx('STUDENT'))).toBe(false);
  });

  it('denies (401) when req.user is undefined', async () => {
    Reflect.defineMetadata('roles', ['ADMIN'], someHandler);
    const guard = new RolesGuard(new Reflector());
    await expect(guard.canActivate(mkCtx(undefined))).rejects.toThrow();
  });
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `pnpm --filter @ft-trascendence/backend test -- roles.guard`
Expected: FAIL — moduleId not found.

- [ ] **Step 3.3: Create `roles.decorator.ts`**

```ts
import { SetMetadata } from '@nestjs/common';
import type { GlobalRole } from './auth-user.type';

/**
 * Restrict a handler to the given global roles. Example:
 *   @UseGuards(DevAuthGuard, RolesGuard)
 *   @Roles('ADMIN')
 * Combine with an auth guard that sets `req.user`. Multiple roles allowed:
 *   @Roles('ADMIN', 'TEACHER')
 */
export const Roles = (...roles: GlobalRole[]) => SetMetadata('roles', roles);
export const ROLES_KEY = 'roles';
```

- [ ] **Step 3.4: Create `roles.guard.ts`**

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { AuthUser } from './auth-user.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AuthUser['role'][]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    // No @Roles() decorator → auth-only, allowed (the auth guard already validated).
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user) {
      throw new UnauthorizedException('Authentication required for a role-restricted route');
    }
    return required.includes(req.user.role);
  }
}
```

- [ ] **Step 3.5: Run test to verify it passes**

Run: `pnpm --filter @ft-trascendence/backend test -- roles.guard`
Expected: PASS (4 tests).

- [ ] **Step 3.6: Commit**

```bash
git add apps/backend/src/common/auth/roles.decorator.ts apps/backend/src/common/auth/roles.guard.ts \
        apps/backend/src/common/auth/__tests__/roles.guard.spec.ts
git commit -m "feat(auth): add @Roles() decorator + RolesGuard"
```

---

## Task 4: JwtStrategy + JwtAuthGuard (inert but complete)

**Files:**
- Create: `apps/backend/src/common/auth/jwt.strategy.ts`
- Create: `apps/backend/src/common/auth/jwt-auth.guard.ts`
- Test: `apps/backend/src/common/auth/__tests__/jwt.strategy.spec.ts`

`JwtAuthGuard` is just `extends AuthGuard('jwt')`, no unit test (Nest covers it). We unit-test `JwtStrategy.validate()` directly — that's where the loading logic lives.

- [ ] **Step 4.1: Write failing test for `JwtStrategy.validate()`**

```ts
import { PrismaService } from '@/prisma/prisma.service';
import { JwtStrategy } from '../jwt.strategy';

const userRow = {
  id: 'user-x', email: 'x@b.co', name: 'X', avatarUrl: null,
  organizationId: 'org-x', role: 'TEACHER' as const,
};

const prisma = {
  user: {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
      where.id === 'user-x' ? userRow : null,
    ),
  },
} as unknown as PrismaService;

describe('JwtStrategy.validate()', () => {
  it('maps the Prisma user row to AuthUser (6 fields)', async () => {
    const strategy = new JwtStrategy(prisma);
    const out = await strategy.validate({ sub: 'user-x' } as any);
    expect(out).toEqual({
      userId: 'user-x', email: 'x@b.co', name: 'X', avatarUrl: null,
      organizationId: 'org-x', role: 'TEACHER',
    });
  });

  it('throws UnauthorizedException when the user is gone', async () => {
    const strategy = new JwtStrategy(prisma);
    await expect(strategy.validate({ sub: 'no-one' } as any)).rejects.toThrow();
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `pnpm --filter @ft-trascendence/backend test -- jwt.strategy`
Expected: FAIL — module not found.

- [ ] **Step 4.3: Create `jwt.strategy.ts`**

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuthUser } from './auth-user.type';

export interface JwtPayload {
  sub: string; // userId
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: (req) => {
        const auth = req?.headers?.authorization;
        if (!auth?.startsWith('Bearer ')) return null;
        return auth.slice(7);
      },
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /** Called by passport after the JWT is verified. Returns the AuthUser on req.user. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User no longer exists');
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      organizationId: user.organizationId,
      role: user.role,
    };
  }
}
```

- [ ] **Step 4.4: Create `jwt-auth.guard.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Validates access JWT. In Epic 1 nobody signs tokens yet, so any request
 * reaching this guard without a valid bearer token returns 401 — correct.
 * Epic 2 enables token issuance; no code change needed here.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 4.5: Run test to verify it passes**

Run: `pnpm --filter @ft-trascendence/backend test -- jwt.strategy`
Expected: PASS (2 tests).

- [ ] **Step 4.6: Run ALL specs so far to catch regressions**

Run: `pnpm --filter @ft-trascendence/backend test`
Expected: PASS (8 tests across 3 files).

- [ ] **Step 4.7: Commit**

```bash
git add apps/backend/src/common/auth/jwt.strategy.ts apps/backend/src/common/auth/jwt-auth.guard.ts \
        apps/backend/src/common/auth/__tests__/jwt.strategy.spec.ts
git commit -m "feat(auth): add JwtStrategy + JwtAuthGuard (inert until Epic 2 issues tokens)"
```

---

## Task 5: DevAuthGuard (operative pre-login guard)

**Files:**
- Create: `apps/backend/src/common/auth/dev-auth.guard.ts`
- Test: `apps/backend/src/common/auth/__tests__/dev-auth.guard.spec.ts`

- [ ] **Step 5.1: Write failing test for DevAuthGuard**

```ts
import { ExecutionContext } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DevAuthGuard } from '../dev-auth.guard';

const userRow = {
  id: 'user-admin-0001', email: 'admin@demo', name: 'Ad',
  avatarUrl: null, organizationId: 'org-klass-0001', role: 'ADMIN' as const,
};

const mkCtx = (devUserId?: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers: devUserId ? { 'x-dev-user': devUserId } : {} }) }),
  }) as unknown as ExecutionContext;

const prisma = {
  user: {
    findUnique: jest.fn(
      async ({ where }: { where: { id: string } }) => (where.id === 'user-admin-0001' ? userRow : null),
    ),
  },
} as unknown as PrismaService;

describe('DevAuthGuard', () => {
  beforeEach(() => (process.env.NODE_ENV = 'development'));
  afterAll(() => { process.env.NODE_ENV = 'test'; });

  it('loads the user from x-dev-user header and sets req.user', async () => {
    const guard = new DevAuthGuard(prisma);
    const ctx = mkCtx('user-admin-0001');
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(ctx.switchToHttp().getRequest<{ user: unknown }>().user).toMatchObject({
      userId: 'user-admin-0001', role: 'ADMIN', organizationId: 'org-klass-0001',
    });
  });

  it('denies when header is missing', async () => {
    const guard = new DevAuthGuard(prisma);
    await expect(guard.canActivate(mkCtx(undefined))).rejects.toThrow();
  });

  it('denies when the user does not exist', async () => {
    const guard = new DevAuthGuard(prisma);
    await expect(guard.canActivate(mkCtx('ghost'))).rejects.toThrow();
  });

  it('refuses (false) in production even with a valid header', async () => {
    process.env.NODE_ENV = 'production';
    const guard = new DevAuthGuard(prisma);
    expect(await guard.canActivate(mkCtx('user-admin-0001'))).toBe(false);
    process.env.NODE_ENV = 'development';
  });
});
```

- [ ] **Step 5.2: Run test to verify it fails**

Run: `pnpm --filter @ft-trascendence/backend test -- dev-auth`
Expected: FAIL — module not found.

- [ ] **Step 5.3: Create `dev-auth.guard.ts`**

```ts
import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuthUser } from './auth-user.type';

/**
 * Pre-login dev guard: resolves the `x-dev-user` header (a seeded userId)
 * to a User row and sets `req.user` as the 6-field AuthUser.
 *
 * - The frontend sends this header automatically when VITE_DEV_USER_ID is set
 *   (apps/frontend/src/lib/api/client.ts).
 * - BLOCKED in production (NODE_ENV === 'production') so the dev bypass can
 *   never leak to a graded deploy.
 * - Replaced in practice by JwtAuthGuard once Epic 2 ships login, but kept as
 *   the dev-valve: tests/manual QA can still impersonate a seeded user by
 *   sending the header, without issuing JWTs.
 */
@Injectable()
export class DevAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'production') return false;

    const req = ctx.switchToHttp().getRequest<{ headers?: Record<string, string | undefined>; user?: AuthUser }>();
    const devUserId = req.headers?.['x-dev-user'];
    if (!devUserId) {
      throw new UnauthorizedException('Missing x-dev-user header (dev-only guard)');
    }

    const user = await this.prisma.user.findUnique({ where: { id: devUserId } });
    if (!user) {
      throw new UnauthorizedException(`Dev user ${devUserId} not found`);
    }

    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      organizationId: user.organizationId,
      role: user.role,
    };
    return true;
  }
}
```

- [ ] **Step 5.4: Run test to verify it passes**

Run: `pnpm --filter @ft-trascendence/backend test -- dev-auth`
Expected: PASS (4 tests).

- [ ] **Step 5.5: Commit**

```bash
git add apps/backend/src/common/auth/dev-auth.guard.ts \
        apps/backend/src/common/auth/__tests__/dev-auth.guard.spec.ts
git commit -m "feat(auth): add DevAuthGuard (x-dev-user header, dev-only, prod-blocked)"
```

---

## Task 6: CommonModule + wire into AppModule + smoke test

**Files:**
- Create: `apps/backend/src/common/common.module.ts`
- Modify: `apps/backend/src/app.module.ts`
- Smoke: `pnpm --filter @ft-trascendence/backend build`

- [ ] **Step 6.1: Create `common.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './auth/jwt.strategy';
import { RolesGuard } from './auth/roles.guard';
import { DevAuthGuard } from './auth/dev-auth.guard';

/**
 * Global Identity & Access primitives. Imports JwtModule (configured via env) so
 * JwtAuthGuard can verify tokens in Epic 2; exports the guards + strategy so any
 * feature module can @UseGuards them without re-importing.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [RolesGuard, DevAuthGuard, JwtStrategy],
  exports: [RolesGuard, DevAuthGuard, JwtStrategy, JwtModule],
})
export class CommonModule {}
```

- [ ] **Step 6.2: Wire `CommonModule` into `app.module.ts`**

In `apps/backend/src/app.module.ts`, add the import and registration:

```ts
// after the existing PrismaModule import:
import { CommonModule } from './common/common.module';
```
And in the `imports` array, place `CommonModule` right after `PrismaModule`:
```ts
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  TelemetryModule,
  PrismaModule,
  CommonModule,        // <-- new line, in the Jorge-owned area
  AuthModule,
  UsersModule,
  OrganizationsModule,
  // ... rest unchanged
],
```

- [ ] **Step 6.3: Smoke test — `pnpm build` succeeds (tsc catches type/layout errors)**

Run: `pnpm --filter @ft-trascendence/backend build`
Expected: exit 0, `dist/` regenerated, no TS errors. (No ts-node run yet — the smoke is "does it compile + do all module imports resolve". The runtime smoke is Task 8 via `make up`.)

- [ ] **Step 6.4: Smoke test — Jest run still green**

Run: `pnpm --filter @ft-trascendence/backend test`
Expected: PASS (12 tests across 4 files).

- [ ] **Step 6.5: Commit**

```bash
git add apps/backend/src/common/common.module.ts apps/backend/src/app.module.ts
git commit -m "feat(common): add @Global CommonModule wiring guards + JwtModule"
```

---

## Task 7: Prisma seed (stable IDs, idempotent, argon2)

**Files:**
- Create: `apps/backend/prisma/seed.ts`

- [ ] **Step 7.1: Write `seed.ts`**

```ts
/**
 * Deterministic demo data for the LMS. Re-runnable: every row uses upsert by
 * stable id, so the seed never creates duplicates. Run with `make db-seed`.
 *
 * IDs are HARDCODED so `VITE_DEV_USER_ID` is a shareable constant (see
 * docs/planning/desarrollo_jorge.md). org-klass-0001 aligns with the frontend
 * mock in apps/frontend/src/lib/api/auth-context.tsx.
 */
import { PrismaClient, GlobalRole, CourseStatus, CourseRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'demo1234';

const IDS = {
  org: 'org-klass-0001',
  admin: 'user-admin-0001',
  teacher: 'user-teacher-0001',
  student: 'user-student-0001',
  course: 'course-demo-0001',
  section: 'section-demo-0001',
  lesson: 'lesson-demo-0001',
  enrollment: 'enrollment-demo-0001',
} as const;

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const now = new Date();

  const org = await prisma.organization.upsert({
    where: { id: IDS.org },
    update: { name: 'Klass Demo' },
    create: { id: IDS.org, name: 'Klass Demo', slug: 'klass-demo' },
  });

  const mkUser = (id: string, email: string, name: string, role: GlobalRole) =>
    prisma.user.upsert({
      where: { id },
      update: { passwordHash, emailVerifiedAt: now },
      create: {
        id, email, name, role, passwordHash,
        organizationId: org.id, emailVerifiedAt: now,
      },
    });

  const admin = await mkUser(IDS.admin, 'admin@demo', 'Ada Admin', 'ADMIN');
  const teacher = await mkUser(IDS.teacher, 'teacher@demo', 'Theo Teacher', 'TEACHER');
  const student = await mkUser(IDS.student, 'student@demo', 'Sam Student', 'STUDENT');

  const course = await prisma.course.upsert({
    where: { id: IDS.course },
    update: { ownerId: teacher.id, status: 'PUBLISHED' as CourseStatus },
    create: {
      id: IDS.course,
      organizationId: org.id,
      ownerId: teacher.id,
      title: 'Welcome to Klass',
      description: 'A short onboarding course.',
      accessCode: 'KLASS123',
      status: 'PUBLISHED' as CourseStatus,
    },
  });

  const section = await prisma.section.upsert({
    where: { id: IDS.section },
    update: { title: 'Getting Started' },
    create: { id: IDS.section, courseId: course.id, title: 'Getting Started', order: 0 },
  });

  const lesson = await prisma.lesson.upsert({
    where: { id: IDS.lesson },
    update: { title: 'Welcome' },
    create: {
      id: IDS.lesson, sectionId: section.id,
      title: 'Welcome', order: 0,
      contentMd: '# Welcome\n\nGlad to have you in the Klass demo course.',
    },
  });

  await prisma.enrollment.upsert({
    where: { id: IDS.enrollment },
    update: {},
    create: {
      id: IDS.enrollment,
      courseId: course.id, userId: student.id,
      role: 'STUDENT' as CourseRole, progress: 0,
    },
  });

  console.log('\n✅ Seed complete. Stable IDs:');
  console.log(`   org          ${IDS.org}`);
  console.log(`   admin        ${IDS.admin}  (admin@demo)`);
  console.log(`   teacher      ${IDS.teacher}  (teacher@demo)`);
  console.log(`   student      ${IDS.student}  (student@demo)`);
  console.log(`   course       ${IDS.course}  (accessCode KLASS123)`);
  console.log(`\n   Frontend dev: set VITE_DEV_USER_ID=${IDS.student}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 7.2: Make sure `prisma generate` knows about the new enum imports**

Run: `pnpm --filter @ft-trascendence/backend exec prisma generate`
Expected: exit 0, output mentions `Generated Prisma Client`. (Enums `GlobalRole` / `CourseStatus` / `CourseRole` are exported by `@prisma/client` from the schema; if generate prints an enum-naming error, fix at the schema — but the schema already declares them in `schema.prisma` so no change expected.)

- [ ] **Step 7.3: Type-check the seed without running it**

Run: `pnpm --filter @ft-trascendence/backend exec tsc --noEmit -p tsconfig.json` (this won't include `prisma/seed.ts` because it's outside `src/`). Confirm the seed file itself type-checks:

```bash
pnpm --filter @ft-trascendence/backend exec ts-node --transpile-only prisma/seed.ts --help 2>&1 | head -5
```
Better: a one-shot typecheck of just the seed file via `tsc` against a relaxed check:

```bash
pnpm --filter @ft-trascendence/backend exec tsc --noEmit --skipLibCheck prisma/seed.ts
```
Expected: exit 0 (or only `Cannot find name`-style noise if `@prisma/client` is stale — if so, run `prisma generate` again).

If your types aren't resolving, double-check that `prisma generate` was actually run after `pnpm install` (the postinstall hook should do it, but in case it didn't).

- [ ] **Step 7.4: Commit**

```bash
git add apps/backend/prisma/seed.ts
git commit -m "feat(db): deterministic Prisma seed (stable IDs, argon2-hashed demo1234)"
```

---

## Task 8: Add `make db-seed` to Makefile

**Files:**
- Modify: `Makefile`

- [ ] **Step 8.1: Add the target inside the existing "# Base de datos" block**

Locate the `db-studio:` target (around line 74) and add a new target right after it:

```makefile
db-seed: ## Carga datos demo deterministas (1 org, 3 users con demo1234, 1 curso)
	$(PRISMA) db seed
```

- [ ] **Step 8.2: Verify Make parses it**

Run: `make -n db-seed`
Expected: prints the resolved command (e.g. `pnpm --filter @ft-trascendence/backend exec prisma db seed` — no errors).

- [ ] **Step 8.3: Commit**

```bash
git add Makefile
git commit -m "infra(make): add db-seed target for the deterministic seed"
```
(Infra target here is fine — Ale is aware we add a Makefile entry for our seed, and we made no other infra change.)

---

## Task 9: Runtime smoke — full stack boot, seed applied, deep verify

This is the end-to-end smoke that proves everything actually works against the
real Postgres in the dev compose stack. No framework, just shell + curl.

**Files:** none (verification only).

- [ ] **Step 9.1: Bring the dev stack up (backend + postgres)**

```bash
make up
```
Wait for healthy: `make status` → backend & postgres `Up`. Tail logs briefly
with `make logs-backend` to ensure no crash on import of `CommonModule`.

Expected in backend logs: `[Backend] Running on http://localhost:3000` and no
`Cannot resolve dependencies` errors about `JwtModule` / `ConfigService`.

If you see a config error like `JWT_ACCESS_SECRET not found`, that means the
backend container reads `.env` and `JWT_ACCESS_SECRET` is unset in
`infra/docker/.env.dev` — append `JWT_ACCESS_SECRET=dev-not-secret-replace-me`
and `JWT_REFRESH_SECRET=dev-not-secret-replace-me` to that file (it is the
committed dev-defaults file — Ale owns it but adding dev secrets there is
sanctioned by AGENTS.md §7). Restart with `make down && make up`.

- [ ] **Step 9.2: Push schema, then seed**

```bash
make db-push
make db-seed
```
Expected: `make db-seed` prints the `✅ Seed complete` block with the stable IDs.

- [ ] **Step 9.3: Verify the rows are real**

```bash
pnpm --filter @ft-trascendence/backend exec prisma studio --port 5555 &
sleep 2
```
(Open `http://localhost:5555` in a browser — sanity check: 1 org, 3 users, 1
course PUBLISHED with accessCode KLASS123, 1 section, 1 lesson, 1 enrollment.
Kill `prisma studio` with `kill %1` after.)

If you don't want studio, a quick equivalent:

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec postgres \
  psql -U ft -d ft_dev -c "SELECT id, email, role FROM \"User\"; SELECT id, slug FROM \"Organization\";"
```
Expected: 3 user rows (admin/teacher@demo/student@demo), 1 org row `klass-demo`.

Verify the password is hashed (NOT `demo1234` in plaintext):

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec postgres \
  psql -U ft -d ft_dev -c "SELECT email, \"passwordHash\" FROM \"User\" WHERE email='admin@demo';"
```
Expected: `passwordHash` starts with `$argon2id$` (argon2), not `demo1234`.

- [ ] **Step 9.4: Smoke the dev guard via curl (frontend proxy header path)**

`DevAuthGuard` works on a `/health` POST for now. Easiest end-to-end check: a
quick temp route is overkill for Epic 1, so instead hit `GET /` (the existing
`AppController` route) with the header and confirm. Keep it simple — there's no
protected route yet, so the deep proof comes via the unit tests in Tasks 2–5.
Here we only confirm the backend responds after seeding:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/health
```
Expected: `200` (AppController/health still works — CommonModule didn't break it).

```bash
curl -s -i -H "x-dev-user: user-student-0001" http://localhost:3000/health | head -5
```
Expected: 200 response (header is accepted; no protected route consumes it yet,
that's fine — this proves the app boots and accepts the header without 4xx on
interception).

- [ ] **Step 9.5: Full unit test run one final time**

```bash
pnpm --filter @ft-trascendence/backend test
```
Expected: PASS (12 tests across 4 files, 0 failures).

- [ ] **Step 9.6: Lint / build gate**

```bash
pnpm --filter @ft-trascendence/backend build
```
Expected: exit 0. (ESLint isn't wired for the backend per AGENTS.md §9; the
build is the code gate.)

- [ ] **Step 9.7: No commit needed (Task 9 is verification-only)**

If anything failed, fix forward and re-commit the changed file with the same
prefix, e.g. `fix(auth): correct JwtStrategy after runtime smoke`.

---

## Task 10: Update tracker, push branch, open PR

**Files:**
- Modify: `docs/planning/desarrollo_jorge.md` (log Block 1 done)

- [ ] **Step 10.1: Update `desarrollo_jorge.md` Block 1 — tick all checkboxes and add the commit hashes**

Run `git log --oneline jorge -10` to collect hashes, then edit the Bloc 1
checkboxes in §4 to ✓ and append a one-line per-task log:

```
### Bloque 1 — 2026-07-09 — Epic 1 implementado
- ✅ deps + jest config + docs committed (hash …)
- ✅ AuthUser + @CurrentUser (hash …)
- ✅ @Roles + RolesGuard (hash …)
- ✅ JwtStrategy + JwtAuthGuard (hash …)
- ✅ DevAuthGuard (hash …)
- ✅ CommonModule wired (hash …)
- ✅ prisma/seed.ts (hash …)
- ✅ make db-seed (hash …)
- runtime smoke green (`make up` → 200, seed loads rows, argon2 in DB)
- unit tests: 12 passing across 4 files
- Updates to §1 Estado: Epic 1 DONE, ready for Epic 2 spec when ready.
```

- [ ] **Step 10.2: Commit the tracker update**

```bash
git add docs/planning/desarrollo_jorge.md
git commit -m "docs(planning): mark Epic 1 Block 1 complete in desarrollo_jorge.md"
```

- [ ] **Step 10.3: Push branch and open PR to staging**

```bash
git push -u origin jorge
gh pr create --base staging --head jorge \
  --title "feat(auth+db): Epic 1 — auth contracts + deterministic seed" \
  --body "Epic 1 of docs/planning/Jorge.md. See spec \
docs/superpowers/specs/2026-07-09-epic1-auth-contracts-seed-design.md and \
tracking doc docs/planning/desarrollo_jorge.md.

Delivers:
- CommonModule (@Global) exporting guards + JwtModule
- AuthUser (6 fields) + @CurrentUser() + @Roles()+RolesGuard
- JwtAuthGuard + JwtStrategy (inert until Epic 2)
- DevAuthGuard (x-dev-user header, production-blocked)
- prisma/seed.ts (stable IDs, argon2) + make db-seed

Tests: 12 unit tests passing. Smoke: make up + db-seed verified (rows in DB,
argon2 hashes, /health 200)."
```
Open the returned PR URL and request review from Aloiki (CODEOWNERS should
route, but explicitly @-mention him since we want quick feedback on the AuthUser
contract change in Jorge.md).

- [ ] **Step 10.4: Announce in team channel**

> "Epic 1 landed in `jorge` → PR to `staging`. `common/auth/` + seed ready. To
> use the dev guard now, decorate your endpoint with
> `@UseGuards(DevAuthGuard)` and inject `@CurrentUser()`. Seed with `make
> db-seed`; frontend dev: set `VITE_DEV_USER_ID=user-student-0001` in
> `apps/frontend/.env.development`."

---

## Self-Review Notes (ran during planning — no action needed during execution)

- ✅ Spec §3 (AuthUser 6 fields) → Task 2.
- ✅ Spec §5 (DevAuthGuard dev-only, prod-blocked) → Task 5 (test covers prod branch).
- ✅ Spec §6 (JwtAuthGuard inert) → Task 4 (tests cover loading; guard verifies token at runtime via passport).
- ✅ Spec §7 (@Roles + RolesGuard compose) → Task 3.
- ✅ Spec §8 (@CurrentUser throws if no guard) → Task 2 (test covers throw).
- ✅ Spec §9 (CommonModule @Global, no APP_GUARD) → Task 6 (no APP_GUARD line anywhere).
- ✅ Spec §10 (seed stable IDs, upsert, argon2, emailVerifiedAt) → Task 7.
- ✅ Spec §11 (deps list) → Task 1.
- ✅ Spec §12 (package.json prisma.seed + Makefile) → Tasks 1 + 8.
- ✅ Spec §14 (unit + smoke DoD) → Tasks 2–5 (unit), Task 9 (runtime smoke).
- ✅ All code present (no TBD / "implement later" steps).
- ✅ Type names consistent across tasks (`AuthUser`, `GlobalRole`, `JwtPayload`, `DevAuthGuard`, `JwtAuthGuard`, `RolesGuard`).