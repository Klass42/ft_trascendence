# Epic 7a — Frontend Auth Pages (Design Spec)

**Owner:** Jorge (@SrJorgeG) — Identity & Access, Tech Lead
**Branch:** `jorge` → `staging` → `master`
**Date:** 2026-07-13
**Status:** Draft
**Scope:** Sub-epic 7a of `docs/planning/Jorge.md` Epic 7. Epics 7b (admin) and 7c (org) are out of scope and will be separate specs.

---

## 1. Purpose

Wire the existing NestJS auth backend to the React frontend by building the
missing auth pages (register, verify-email, OAuth callback) and flipping
`VITE_USE_MOCK_AUTH=false`. The login page already exists and needs minimal
wiring. This completes the auth UX: register → login → dashboard, including
Google OAuth and email verification.

Also fixes the broken `<Link to="/register">` that currently 404s and the
missing Google OAuth hash-fragment token handler.

## 2. Constraints (hard)

- **Reuse Aloiki's design system** — `Button`, `Input`, `Card`, `Spinner` from
  `components/ui`. No new component primitives.
- **Reuse existing `AuthProvider`** — add `register` and `verifyEmail` to the
  context; don't refactor the provider.
- **Reuse existing `apiClient`** — all auth calls go through it (uses JWT or
  x-dev-user, handles 401 refresh).
- **No form library** — plain React `useState` + client-side validation, matching
  the `LoginPage` pattern.
- **Validation mirroring backend** — same rules as `RegisterDto` (email format,
  password ≥8 + upper/lower/digit, name ≥1 char).
- **Spanish UI text** — matches existing `LoginPage`.
- **No new backend code** — all endpoints already exist (`POST /auth/register`,
  `GET /auth/verify-email`, `GET /auth/me`, `POST /auth/login`).
- **Separate pages per route** — `/register`, `/verify-email`, `/auth/callback`,
  `/login`. No tab-based login+register combo.
- **All auth pages are `@Public`** — outside `ProtectedRoute`, no token gate.

## 3. Design decisions (from brainstorm)

| Topic | Decision | Rationale |
|---|---|---|
| Register layout | **B** — Separate `/register` page, mirror of LoginPage | URLs bookmarkable, fits existing `<Link to="/register">`, matches repo pattern (one page = one route) |
| Google OAuth callback | **B** — Dedicated `/auth/callback` route | Clean separation, standard OAuth pattern, easy to debug |
| Verify-email page | **Included** | Completeness. In dev auto-verify still works; page handles prod flow. |
| Form validation | **No new lib** — plain useState, same as LoginPage | YAGNI, matches existing convention |
| Mock auth | **Keep code, flip default** — `VITE_USE_MOCK_AUTH=false` in `.env.development` | Mock stays as Aloiki's dev tool; real auth is the default |

## 4. Routes

| Route | Component | Access | State |
|---|---|---|---|
| `/login` | `LoginPage` (exists, no changes needed) | Public | Existing |
| `/register` | `RegisterPage` | Public | New |
| `/verify-email` | `VerifyEmailPage` | Public (reads `?token=X` query param) | New |
| `/auth/callback` | `OAuthCallbackPage` | Public (reads `#accessToken=...&refreshToken=...` hash) | New |

All four go outside `ProtectedRoute` in `routes.tsx`.

## 5. Page specifications

### 5.1 RegisterPage (`/register`)

**Layout:** Mirror of `LoginPage` — centered card, K logo, title "Crea tu cuenta",
subtitle, form, Google button, footer link "¿Ya tienes cuenta? Inicia sesión".

**Form fields:**
1. `name` — `Input` type="text", label="Nombre completo", leftIcon `<User />`, required
2. `email` — `Input` type="email", label="Email", leftIcon `<Mail />`, required, autoComplete="email"
3. `password` — `Input` type="password", label="Contraseña", leftIcon `<Lock />`, required, hint="Mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 número"

**Submit:** `<Button type="submit" variant="primary" fullWidth loading={isLoading}>Crear cuenta</Button>`

**Google button:** same as LoginPage (calls `loginWithGoogle()`).

**Validation (client-side, before POST):**
- All fields non-empty
- Email: basic `@` check (or regex)
- Password: ≥8 chars, at least one upper, one lower, one digit
- Name: ≥1 char
- Errors surfaced per-field (not just generic banner). Use individual `error` prop on `Input`.

**On success (201):** store tokens (`tokenStorage.setTokens`), set user (`setUser`), `navigate('/dashboard')`.

**On failure:**
- 409 → "Este email ya está registrado" (on email field)
- 400 → backend validation errors (see §8 Error handling)

### 5.2 VerifyEmailPage (`/verify-email`)

**URL:** `/verify-email?token=XXXX`

**Layout:** Centered card with Spinner while verifying, then success/error message.

**Flow:**
1. On mount, read `token` from `useSearchParams()`
2. Call `GET /auth/verify-email?token=X` via apiClient (`skipAuth: true`)
3. On 200 → show "Email verificado correctamente." + `<Link to="/login">Iniciar sesión</Link>`
4. On 400/404 → show "Token inválido o expirado." + `<Link to="/login">Volver al inicio de sesión</Link>`

**No form, no button, no user interaction needed.**

### 5.3 OAuthCallbackPage (`/auth/callback`)

**URL:** `/auth/callback#accessToken=X&refreshToken=Y` (or `#error=oauth_failed`)

**Layout:** Centered Spinner with label "Iniciando sesión..."

**Flow:**
1. On mount, parse `window.location.hash`
2. If hash contains `accessToken` and `refreshToken`:
   - Extract values from hash
   - `tokenStorage.setTokens({ accessToken, refreshToken })`
   - `apiClient.get<AuthUser>('/auth/me')` to fetch user
   - `setUser(user)`
   - Clean URL: `window.location.hash = ''` or `navigate('/dashboard', { replace: true })`
3. If hash contains `error=oauth_failed`:
   - Show error message "Error al iniciar sesión con Google. Inténtalo de nuevo."
   - `<Link to="/login">Volver al inicio de sesión</Link>`
4. If no hash tokens → redirect to `/login`

**Strategy:** `OAuthCallbackPage` stores tokens in `tokenStorage`, then
`navigate('/dashboard', { replace: true })`. `AuthProvider`'s existing mount
logic already reads stored tokens and calls `refreshUser()`. No `AuthProvider`
changes needed — the page just stores and redirects.

### 5.4 LoginPage (`/login`) — minimal changes

Already exists and works. No structural changes needed. The `<Link to="/register">`
already points to `/register` — it works once the route exists. No other changes.

## 6. AuthProvider changes

Add `register` to `AuthContextValue` and `AuthProvider`. `verifyEmail` goes in a 
standalone hook (see §5.2 — it doesn't modify auth state):

```ts
interface AuthContextValue {
  // ... existing fields ...
  register: (name: string, email: string, password: string) => Promise<void>;
}
```

**`register(name, email, password)`**:
```ts
const register = useCallback(async (name: string, email: string, password: string) => {
  const response = await apiClient.post<LoginResponse>(
    '/auth/register',
    { name, email, password },
    { skipAuth: true }
  );
  const tokens: AuthTokens = { accessToken: response.accessToken, refreshToken: response.refreshToken };
  tokenStorage.setTokens(tokens);
  setUser(response.user);
}, []);

## 7. File layout

```
apps/frontend/src/features/auth/
├── LoginPage.tsx                   # UNCHANGED
├── LoginPage.module.css            # UNCHANGED
├── RegisterPage.tsx                # NEW
├── RegisterPage.module.css         # NEW (~mirrors LoginPage styles)
├── VerifyEmailPage.tsx             # NEW
├── OAuthCallbackPage.tsx           # NEW
└── index.ts                        # MODIFY: add exports

apps/frontend/src/lib/api/
└── auth-context.tsx                # MODIFY: add register method

apps/frontend/src/app/
└── routes.tsx                      # MODIFY: add 3 lazy routes

apps/frontend/
└── .env.development                # MODIFY: VITE_USE_MOCK_AUTH=false
```

## 8. Error handling

**Per-field validation (client-side):**
- Each `Input` has an `error` prop. On submit, validate all fields synchronously.
- On fail, set individual `error` strings per field.
- Errors clear when user types in the field (onChange).

**Server validation errors (400):**
- Backend returns `{ statusCode: 400, message: string[] }` (array of per-field errors).
- `ApiError.isValidationError` is true → `ApiError.errors` is the string array.
- Parse the array and map to field-level errors. If message contains field name
  (e.g., "email must be..."), show on that field. Otherwise, show as banner.

**Network/other errors:**
- Show a generic error banner above the form (same red box as LoginPage).

## 9. No new dependencies

No new npm packages. All imports from `react`, `react-router-dom`, `lucide-react`,
`@/lib/api`, `@/components/ui`.

## 10. Tests

Frontend has no test infrastructure yet (no vitest/jest for frontend). Manual
smoke test is the verification method:

- [ ] `/register` renders, validates fields, register succeeds with seed emails
- [ ] `/register` shows 409 on duplicate email
- [ ] `/register` shows per-field errors on weak password
- [ ] `/verify-email?token=invalid` shows error
- [ ] `/auth/callback` parses hash, stores tokens, redirects to dashboard
- [ ] `/login` → register link works (no more 404)
- [ ] `VITE_USE_MOCK_AUTH=false` → login with `student@demo`/`demo1234` works

## 11. Out of scope

- Forgot password / reset password flow (no backend endpoint exists)
- 2FA page (Epic 8, stretch)
- Admin dashboard pages (Epic 7b)
- Organization settings pages (Epic 7c)
- Profile page (already built by Aloiki, `features/profile/`)
- Email sending (no backend infra)
- Internationalization (all Spanish, matches existing)
- Toast/notification UI for errors (use inline form errors, same as LoginPage)
- Removing the mock auth code (keep it, just flip the flag)
