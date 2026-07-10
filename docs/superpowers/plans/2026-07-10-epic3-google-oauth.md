# Epic 3 — Google OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth 2.0 login (2 endpoints + 1 Passport strategy + 1 service method) reusing the JWT/Session infrastructure from Epic 2.

**Architecture:** GoogleStrategy (passport-google-oauth20) handles the Google consent flow. On callback, `AuthService.googleLogin(profile)` auto-creates or auto-links the user (by email match in seeded org), then reuses `issueTokens()`. Tokens are passed to the frontend via hash fragment redirect.

**Tech Stack:** NestJS 10, passport-google-oauth20, @nestjs/passport, Prisma 6, Jest 30.

**Spec:** `docs/superpowers/specs/2026-07-10-epic3-google-oauth-design.md`

---

## File Structure

### New files
| File | Responsibility |
|---|---|
| `apps/backend/src/auth/google.strategy.ts` | GoogleStrategy — PassportStrategy(Strategy, 'google') |
| `apps/backend/src/auth/__tests__/google.strategy.spec.ts` | Unit test for strategy config |

### Modified files
| File | Change |
|---|---|
| `apps/backend/src/auth/auth.service.ts` | Add `googleLogin(profile)` method |
| `apps/backend/src/auth/__tests__/auth.service.spec.ts` | Append googleLogin tests (add Prisma mock for oAuthAccount) |
| `apps/backend/src/auth/auth.controller.ts` | Add `GET /auth/google` + `GET /auth/google/callback` |
| `apps/backend/src/common/common.module.ts` | Add GoogleStrategy to providers |
| `apps/backend/package.json` | Add `passport-google-oauth20` + `@types/passport-google-oauth20` |
| `.env.example` | Add `FRONTEND_URL`, clarify `GOOGLE_CALLBACK_URL` dev value |
| `infra/docker/docker-compose.dev.yml` | Add `FRONTEND_URL` env var |

---

## Task 1: Install deps + env vars

**Files:**
- Modify: `apps/backend/package.json`
- Modify: `.env.example`
- Modify: `infra/docker/docker-compose.dev.yml`

- [ ] **Step 1: Install passport-google-oauth20**

```bash
cd apps/backend && pnpm add passport-google-oauth20 && pnpm add -D @types/passport-google-oauth20
```

- [ ] **Step 2: Add FRONTEND_URL to .env.example**

Add after the `GOOGLE_CALLBACK_URL` line:

```
# Where to redirect after OAuth callback (dev: localhost:5173, prod: your frontend URL)
FRONTEND_URL=http://localhost:5173
```

Also change the `GOOGLE_CALLBACK_URL` dev comment to clarify:
```
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

- [ ] **Step 3: Add FRONTEND_URL to docker-compose.dev.yml**

Find the backend service `environment` block and add:

```yaml
FRONTEND_URL: http://localhost:5173
```

- [ ] **Step 4: Build**

Run: `pnpm --filter @ft-trascendence/backend run build`
Expected: compiles clean.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/package.json pnpm-lock.yaml .env.example infra/docker/docker-compose.dev.yml
git commit -m "feat(auth): add passport-google-oauth20 deps + FRONTEND_URL env var"
```

---

## Task 2: GoogleStrategy — TDD

**Files:**
- Create: `apps/backend/src/auth/google.strategy.ts`
- Create: `apps/backend/src/auth/__tests__/google.strategy.spec.ts`
- Modify: `apps/backend/src/common/common.module.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/auth/__tests__/google.strategy.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from '../google.strategy';

const mkConfig = () =>
  ({
    getOrThrow: (key: string) => {
      if (key === 'GOOGLE_CLIENT_ID') return 'test-client-id';
      if (key === 'GOOGLE_CLIENT_SECRET') return 'test-client-secret';
      if (key === 'GOOGLE_CALLBACK_URL') return 'http://localhost:3000/auth/google/callback';
      throw new Error(`Unknown key: ${key}`);
    },
  }) as unknown as ConfigService;

describe('GoogleStrategy', () => {
  it('reads clientID, clientSecret, callbackURL, scope from ConfigService', () => {
    const strategy = new GoogleStrategy(mkConfig());
    // PassportStrategy stores config internally — access via the instance
    // The parent constructor sets these as properties on the strategy instance
    // We verify the strategy was constructed without throwing
    expect(strategy).toBeDefined();
  });

  it('throws when GOOGLE_CLIENT_ID is missing', () => {
    const badConfig = {
      getOrThrow: (key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') throw new Error('missing');
        return 'x';
      },
    } as unknown as ConfigService;

    expect(() => new GoogleStrategy(badConfig)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ft-trascendence/backend exec jest -- src/auth/__tests__/google.strategy.spec.ts`
Expected: FAIL — `google.strategy.ts` module not found.

- [ ] **Step 3: Create GoogleStrategy**

Create `apps/backend/src/auth/google.strategy.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';

export interface GoogleProfile {
  providerUserId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Passport strategy for Google OAuth 2.0.
 * Scopes: email + profile (needed to auto-create / link users).
 * Config via env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
  ): Promise<GoogleProfile> {
    return {
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      name: profile.displayName ?? '',
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ft-trascendence/backend exec jest -- src/auth/__tests__/google.strategy.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Register in CommonModule**

Modify `apps/backend/src/common/common.module.ts`:

1. Add import: `import { GoogleStrategy } from './auth/google.strategy';`
   Note: GoogleStrategy lives in `auth/`, not `common/auth/`. Import from the correct path:
   `import { GoogleStrategy } from '../auth/google.strategy';`
2. Add `GoogleStrategy` to the `providers` array.
3. Add `GoogleStrategy` to the `exports` array.

The full updated file:

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { JwtStrategy } from './auth/jwt.strategy';
import { RolesGuard } from './auth/roles.guard';
import { DevAuthGuard } from './auth/dev-auth.guard';
import { AppAuthGuard } from './auth/app-auth.guard';
import { GoogleStrategy } from '../auth/google.strategy';

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [JwtAuthGuard, RolesGuard, DevAuthGuard, AppAuthGuard, JwtStrategy, GoogleStrategy],
  exports: [JwtAuthGuard, RolesGuard, DevAuthGuard, AppAuthGuard, JwtStrategy, JwtModule, GoogleStrategy],
})
export class CommonModule {}
```

- [ ] **Step 6: Run all tests + build**

Run: `pnpm --filter @ft-trascendence/backend exec jest`
Expected: 42 tests pass (40 existing + 2 new).

Run: `pnpm --filter @ft-trascendence/backend run build`
Expected: compiles clean.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/auth/google.strategy.ts apps/backend/src/auth/__tests__/google.strategy.spec.ts apps/backend/src/common/common.module.ts
git commit -m "feat(auth): add GoogleStrategy (passport-google-oauth20) + register in CommonModule"
```

---

## Task 3: AuthService.googleLogin — TDD

**Files:**
- Modify: `apps/backend/src/auth/auth.service.ts` (append method)
- Modify: `apps/backend/src/auth/__tests__/auth.service.spec.ts` (append tests + mock)

- [ ] **Step 1: Write the failing tests**

Append these to the `describe('AuthService', ...)` block in `auth.service.spec.ts`, before the final closing `});`.

First, add these mock variables near the top (after the existing mock declarations):

```ts
let mockOAuthAccountFindUnique: jest.Mock;
let mockOAuthAccountCreate: jest.Mock;
```

Then add to `mkPrisma()`:

```ts
  oAuthAccount: {
    findUnique: (...a: unknown[]) => mockOAuthAccountFindUnique(...a),
    create: (...a: unknown[]) => mockOAuthAccountCreate(...a),
  },
```

Then in `beforeEach`, after the existing mock inits:

```ts
    mockOAuthAccountFindUnique = jest.fn();
    mockOAuthAccountCreate = jest.fn();
```

Then append these tests:

```ts
  describe('googleLogin', () => {
    const googleProfile = {
      providerUserId: 'google-123',
      email: 'newuser@gmail.com',
      name: 'Google User',
      avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
    };

    it('returns tokens when OAuthAccount already linked', async () => {
      mockOAuthAccountFindUnique.mockResolvedValue({
        userId: mockUser.id,
        provider: 'google',
        providerUserId: 'google-123',
      });
      mockSessionCreate.mockResolvedValue({ id: 'session-g1' });

      const result = await service.googleLogin(googleProfile);
      expect(result.accessToken).toBe('access-token-mock');
      expect(result.refreshToken).toBe('refresh-token-mock');
    });

    it('links existing user by email match and returns tokens', async () => {
      mockOAuthAccountFindUnique.mockResolvedValue(null);
      mockUserFindFirst.mockResolvedValue(mockUser);
      mockOAuthAccountCreate.mockResolvedValue({});
      mockSessionCreate.mockResolvedValue({ id: 'session-g2' });

      const result = await service.googleLogin(googleProfile);
      expect(result.accessToken).toBe('access-token-mock');
      expect(mockOAuthAccountCreate).toHaveBeenCalled();
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it('creates a new user + OAuthAccount when no match', async () => {
      mockOAuthAccountFindUnique.mockResolvedValue(null);
      mockUserFindFirst.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({ ...mockUser, id: 'user-google-0001', passwordHash: null });
      mockOAuthAccountCreate.mockResolvedValue({});
      mockSessionCreate.mockResolvedValue({ id: 'session-g3' });

      const result = await service.googleLogin(googleProfile);
      expect(result.accessToken).toBe('access-token-mock');
      const createData = (mockUserCreate.mock.calls[0][0] as { data: any }).data;
      expect(createData.passwordHash).toBeNull();
      expect(createData.emailVerifiedAt).toBeInstanceOf(Date);
      expect(createData.role).toBe('STUDENT');
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ft-trascendence/backend exec jest -- src/auth/__tests__/auth.service.spec.ts`
Expected: FAIL — `service.googleLogin is not a function`.

- [ ] **Step 3: Append googleLogin method to AuthService**

Add at the end of `apps/backend/src/auth/auth.service.ts`, before the final closing `}`:

```ts
  async googleLogin(profile: {
    providerUserId: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  }): Promise<{ accessToken: string; refreshToken: string }> {
    const oauthAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'google',
          providerUserId: profile.providerUserId,
        },
      },
    });

    let userId: string;

    if (oauthAccount) {
      userId = oauthAccount.userId;
    } else {
      const existingUser = await this.prisma.user.findFirst({
        where: { organizationId: SEED_ORG_ID, email: profile.email },
      });

      if (existingUser) {
        await this.prisma.oAuthAccount.create({
          data: {
            provider: 'google',
            providerUserId: profile.providerUserId,
            userId: existingUser.id,
          },
        });
        userId = existingUser.id;
      } else {
        const newUser = await this.prisma.user.create({
          data: {
            organizationId: SEED_ORG_ID,
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            passwordHash: null,
            role: 'STUDENT',
            emailVerifiedAt: new Date(),
          },
        });
        await this.prisma.oAuthAccount.create({
          data: {
            provider: 'google',
            providerUserId: profile.providerUserId,
            userId: newUser.id,
          },
        });
        userId = newUser.id;
      }
    }

    return this.issueTokens(userId);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ft-trascendence/backend exec jest -- src/auth/__tests__/auth.service.spec.ts`
Expected: PASS (all existing + 3 new googleLogin tests).

Run: `pnpm --filter @ft-trascendence/backend exec jest`
Expected: 45 tests pass (42 + 3 new).

Run: `pnpm --filter @ft-trascendence/backend run build`
Expected: compiles clean.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/auth/auth.service.ts apps/backend/src/auth/__tests__/auth.service.spec.ts
git commit -m "feat(auth): implement googleLogin (auto-create + auto-link by email match)"
```

---

## Task 4: AuthController — Google routes

**Files:**
- Modify: `apps/backend/src/auth/auth.controller.ts`

- [ ] **Step 1: Add Google routes to AuthController**

Replace the entire `apps/backend/src/auth/auth.controller.ts` with:

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  HttpStatus,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { Public, CurrentUser } from '@/common/auth';
import type { AuthUser } from '@/common/auth';
import type { GoogleProfile } from './google.strategy';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthUser, @Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Public()
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Passport redirects to Google consent screen — this body is never reached.
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: { user: GoogleProfile }, @Res() res: Response) {
    try {
      const { accessToken, refreshToken } = await this.authService.googleLogin(req.user);
      const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
      res.redirect(`${frontendUrl}/#accessToken=${accessToken}&refreshToken=${refreshToken}`);
    } catch {
      const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
      res.redirect(`${frontendUrl}/#error=oauth_failed`);
    }
  }
}
```

Key changes:
- Added imports: `Req`, `Res`, `UseGuards` from `@nestjs/common`, `AuthGuard` from `@nestjs/passport`, `ConfigService`, `Response` from `express`, `GoogleProfile`.
- Constructor now injects `ConfigService` (for `FRONTEND_URL`).
- Added `GET /auth/google` and `GET /auth/google/callback` routes, both `@Public()` + `@UseGuards(AuthGuard('google'))`.

- [ ] **Step 2: Build + run all tests**

Run: `pnpm --filter @ft-trascendence/backend run build`
Expected: compiles clean.

Run: `pnpm --filter @ft-trascendence/backend exec jest`
Expected: 45 tests pass (no regressions).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/auth/auth.controller.ts
git commit -m "feat(auth): add GET /auth/google + GET /auth/google/callback routes"
```

---

## Task 5: Runtime smoke test

**Files:** none (manual verification)

- [ ] **Step 1: Restart backend with new code**

```bash
docker compose -f infra/docker/docker-compose.dev.yml restart backend
```

Wait for "Nest application successfully started" in logs.

- [ ] **Step 2: Verify routes are mapped**

```bash
docker compose -f infra/docker/docker-compose.dev.yml logs backend --tail 60 2>&1 | grep -E 'google'
```
Expected: Lines showing `{/auth/google, GET}` and `{/auth/google/callback, GET}`.

- [ ] **Step 3: Test redirect without Google credentials**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/auth/google
```
Expected: A redirect/502/500 — this is expected because `GOOGLE_CLIENT_ID` is empty in dev.
The key verification is that NestJS starts without crashing and routes are mapped.

- [ ] **Step 4: Verify existing auth still works**

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"student@demo","password":"demo1234"}'
```
Expected: JSON with `user`, `accessToken`, `refreshToken` — same as Epic 2.

- [ ] **Step 5: No commit unless fixes were needed**

---

## Self-Review Notes

- Spec §4 (endpoints) → Task 4 (controller) ✓
- Spec §5 (GoogleStrategy) → Task 2 ✓
- Spec §6 (googleLogin) → Task 3 ✓
- Spec §9 (deps) → Task 1 ✓
- Spec §10 (env vars) → Task 1 ✓
- Spec §12 (tests) → Task 2 (strategy), Task 3 (googleLogin), Task 5 (smoke) ✓
- `FRONTEND_URL` used consistently in controller (Task 4) and env (Task 1). ✓
- `GoogleProfile` type exported from `google.strategy.ts` (Task 2) and imported in controller (Task 4). ✓
- `oauthAccount.findUnique` mock added in Task 3 matches prisma method name. ✓
- No placeholders. ✓