# Epic 3 — Google OAuth (Design Spec)

**Owner:** Jorge (@SrJorgeG) — Identity & Access, Tech Lead
**Branch:** `jorge` → `staging` → `master`
**Date:** 2026-07-10
**Status:** Approved
**Scope:** Only Epic 3 of `docs/planning/Jorge.md`. Epics 4–8 are out of scope.

---

## 1. Purpose

Add Google OAuth 2.0 as a second authentication method alongside email/password from
Epic 2. The flow is the standard "Sign in with Google": the frontend redirects to
`/api/auth/google`, Google shows its consent screen, the callback creates or links
the user, and the backend redirects to the frontend with tokens in the URL hash fragment.

This completes the **OAuth module** (Minor, 1 pt) from the subject's User Management
section.

## 2. Constraints (hard)

- **Reuse Epic 2 infrastructure.** `AuthService.issueTokens()`, `Session`, `mapUser()`
  already exist. Google OAuth reuses them — no new token logic.
- **`OAuthAccount` model already in Prisma schema** (`provider`, `providerUserId`,
  `@@unique([provider, providerUserId])`). No schema change needed.
- **Frontend contract unchanged.** `loginWithGoogle()` in
  `auth-context.tsx:171-175` does `window.location.href = '/api/auth/google'`. The
  backend redirects back with `#accessToken=...&refreshToken=...`. The frontend in
  Epic 7 will parse the hash; for now the backend just redirects.
- **`@Public()` on both Google endpoints** — they must not require authentication.
- **Dev callback URL:** `http://localhost:3000/auth/google/callback` (the callback
  hits the backend, not the frontend).
- **org-scoped:** new users auto-assigned to seeded org (`org-klass-0001`), same as
  Epic 2 register.

## 3. Design decisions (from brainstorm)

| Topic | Decision | Rationale |
|---|---|---|
| Token passing | **B** — Redirect with hash fragment: `http://localhost:5173/#accessToken=...&refreshToken=...`. | Not sent to server in referrer, not in browser history URL params. Frontend storage stays `localStorage` (no cookie refactor). |
| New user creation | **A** — Auto-create on first Google login. | Standard "Sign in with Google" UX. Email is already verified by Google (`emailVerifiedAt = now()`). No extra registration step. |
| Existing email match | **A** — Auto-vincular. If a `User` with the same email exists in the same org, create `OAuthAccount` pointing to it. | Prevents duplicate users. User can then login with either email/password or Google. |
| Org assignment | Seeded org (`org-klass-0001`), same as Epic 2 register. | No org-selection UI exists yet (Epic 4). |

## 4. Endpoints

| Method | Route | Guard | Response |
|---|---|---|---|
| `GET` | `/auth/google` | `@Public()` | 302 redirect to Google consent screen |
| `GET` | `/auth/google/callback` | `@Public()` | 302 redirect to `FRONTEND_URL#accessToken=...&refreshToken=...` (or `#error=...` on failure) |

### Redirect shape

**Success:**
```
http://localhost:5173/#accessToken=<jwt>&refreshToken=<jwt>
```

**Error (e.g. Google returns an error):**
```
http://localhost:5173/#error=oauth_failed
```

The frontend (Epic 7) will parse `window.location.hash`, extract `accessToken` /
`refreshToken`, store them via `tokenStorage.setTokens()`, and call `refreshUser()`.
For Epic 3, the backend only needs to redirect correctly.

## 5. GoogleStrategy

New file: `apps/backend/src/auth/google.strategy.ts`.

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';

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
}
```

- Registered as a provider in `CommonModule` (alongside `JwtStrategy`).
- Passport uses the `'google'` strategy name to match `AuthGuard('google')`.

## 6. AuthService — googleLogin

New method on `AuthService`: `googleLogin(profile): { accessToken, refreshToken }`.

```ts
interface GoogleProfile {
  providerUserId: string;  // Google ID
  email: string;
  name: string;
  avatarUrl: string | null;
}

async googleLogin(profile: GoogleProfile): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  // 1. Find existing OAuthAccount
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
    // Already linked → use that user
    userId = oauthAccount.userId;
  } else {
    // 2. Auto-vincular: find user by email in seeded org
    const existingUser = await this.prisma.user.findFirst({
      where: { organizationId: SEED_ORG_ID, email: profile.email },
    });

    if (existingUser) {
      // Link Google to existing account
      await this.prisma.oAuthAccount.create({
        data: {
          provider: 'google',
          providerUserId: profile.providerUserId,
          userId: existingUser.id,
        },
      });
      userId = existingUser.id;
    } else {
      // 3. Auto-crear: new user + OAuthAccount
      const newUser = await this.prisma.user.create({
        data: {
          organizationId: SEED_ORG_ID,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          passwordHash: null,  // OAuth-only account
          role: 'STUDENT',
          emailVerifiedAt: new Date(),  // Google verified the email
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

Key points:
- `passwordHash: null` for OAuth-only accounts (the schema allows it — `passwordHash String?`).
- `emailVerifiedAt: now()` — Google already verified the email.
- Reuses `issueTokens()` from Epic 2 (creates Session, signs JWTs, hashes refresh).

## 7. AuthController — Google routes

Add to existing `AuthController`:

```ts
import { AuthGuard } from '@nestjs/passport';

// ... existing endpoints ...

@Public()
@Get('google')
@UseGuards(AuthGuard('google'))
async googleAuth() {
  // Passport handles the redirect to Google consent screen.
  // This body is never reached — passport intercepts before the handler.
}

@Public()
@Get('google/callback')
@UseGuards(AuthGuard('google'))
async googleCallback(@Req() req: any, @Res() res: Response) {
  const profile = req.user as GoogleProfile;
  const { accessToken, refreshToken } = await this.authService.googleLogin(profile);
  const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
  res.redirect(
    `${frontendUrl}/#accessToken=${accessToken}&refreshToken=${refreshToken}`,
  );
}
```

Notes:
- `@UseGuards(AuthGuard('google'))` on both endpoints: the first triggers the redirect
  to Google; the callback receives the authenticated profile on `req.user`.
- `FRONTEND_URL` env var (new, added to `.env.example`). Default `http://localhost:5173`
  for dev; staging/prod would set it to the real frontend URL.
- On error, redirect to `${frontendUrl}/#error=oauth_failed`.

## 8. Error handling

- **Google returns an error** (user denies consent, Google is down): passport throws
  → the guard returns 401. To improve UX, wrap the callback in a try/catch that
  redirects to `${frontendUrl}/#error=oauth_failed` instead of returning a JSON error.
- **Email match across orgs**: currently only one org (seeded), so no risk. When
  multi-org is added (Epic 4), `googleLogin` must scope by `organizationId`.
- **Missing GOOGLE_CLIENT_ID/SECRET**: `ConfigService.getOrThrow` throws at startup —
  fail-fast, same as JWT secrets.

## 9. Dependencies

New:
- `passport-google-oauth20` (runtime)
- `@types/passport-google-oauth20` (dev)

Already installed (from Epic 1/2):
- `@nestjs/passport`, `passport`, `@nestjs/jwt`, `argon2`, all testing deps.

## 10. Environment

New env var:
| Var | Dev default | Notes |
|---|---|---|
| `FRONTEND_URL` | `http://localhost:5173` | Where to redirect after OAuth callback |

Already present (`.env.example`):
| Var | Notes |
|---|---|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console → Credentials → OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Same |
| `GOOGLE_CALLBACK_URL` | Dev: `http://localhost:3000/auth/google/callback` |

Update `.env.example` to add `FRONTEND_URL` and clarify the dev callback URL.

`infra/docker/docker-compose.dev.yml` should add `FRONTEND_URL` to the backend env.
For dev, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are empty — Google OAuth
won't work locally without real credentials. That's expected: devs can still login
with email/password. Google is tested with real credentials or mocked in unit tests.

## 11. File layout

```
apps/backend/src/
  auth/
    google.strategy.ts          # GoogleStrategy (PassportStrategy)
    auth.service.ts             # + googleLogin(profile) method
    auth.controller.ts          # + GET /auth/google, GET /auth/google/callback
  common/
    common.module.ts            # + GoogleStrategy to providers
  auth/
    __tests__/
      google.strategy.spec.ts   # Unit: strategy config
      auth.service.spec.ts      # Append: googleLogin tests
      auth.e2e.spec.ts          # Append: GET /auth/google → 302
.env.example                    # + FRONTEND_URL, clarify GOOGLE_CALLBACK_URL dev value
infra/docker/docker-compose.dev.yml  # + FRONTEND_URL
```

## 12. Tests (Definition of Done)

### Unit tests

- **`google.strategy.spec.ts`**:
  - Constructs with correct `clientID`, `clientSecret`, `callbackURL`, `scope` from
    `ConfigService`.

- **`auth.service.spec.ts`** (append to existing):
  - `googleLogin` with existing `OAuthAccount` → loads user, returns tokens.
  - `googleLogin` without `OAuthAccount` but email match → creates `OAuthAccount`,
    returns tokens, does NOT create a new user.
  - `googleLogin` without `OAuthAccount` and no email match → creates `User` +
    `OAuthAccount`, returns tokens. Verify `passwordHash` is null,
    `emailVerifiedAt` is set.

- **Existing tests**: all 40 from Epic 2 must still pass.

### E2E tests

- **`auth.e2e.spec.ts`** (append):
  - `GET /auth/google` without Google credentials → 302 (or 500 if credentials
    missing — acceptable, since dev doesn't have real Google creds). In practice
    this test is hard to run without real Google credentials; document it as
    requiring `GOOGLE_CLIENT_ID`/`SECRET` set.

### Smoke

- Manual: set real Google credentials, visit `http://localhost:3000/auth/google`,
  complete Google consent, verify redirect to `localhost:5173/#accessToken=...`.
- Alternatively: mock the entire GoogleStrategy in a test to simulate the callback.

## 13. Out of scope

- Frontend UI changes (parsing hash fragment, Google button styling) — Epic 7.
- Link/unlink Google from user profile — future.
- Other OAuth providers (GitHub, Facebook) — out of MVP scope.
- Multi-org Google login (OAuth user joins a specific org) — Epic 4.
- Google OAuth in CI (no real credentials in CI; only unit tests with mocks).

## 14. Open items / hand-offs

- Ale: add `FRONTEND_URL` and `GOOGLE_CLIENT_ID/SECRET` to the dev compose and
  staging/prod env. Real Google credentials must come from the team's Google Cloud
  Console project.
- Aloiki: the frontend `loginWithGoogle()` already redirects to `/api/auth/google`.
  In Epic 7, add logic to parse `window.location.hash` for tokens after the redirect.
- David: no impact — Google OAuth is transparent to other modules.