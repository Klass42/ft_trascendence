# Epic 7a — Frontend Auth Pages Implementation Plan

> **Goal:** Build 3 pages (/register, /verify-email, /auth/callback) + add register method to AuthProvider + flip mock auth off. Wire existing backend auth to React frontend.

**Architecture:** New pages mirror LoginPage pattern (centered card, useAuth/useState, apiClient). OAuthCallbackPage stores hash tokens and redirects. AuthProvider gains `register` method.

**Tech Stack:** React 19, react-router-dom, existing apiClient, existing components/ui (Button, Input, Card, Spinner).

---

### Task 1: Add `register` to AuthProvider

**Modify:** `apps/frontend/src/lib/api/auth-context.tsx`

Extend `AuthContextValue` interface and `AuthProvider` with `register(name, email, password)` following same pattern as `login`.

### Task 2: RegisterPage

**Create:** `apps/frontend/src/features/auth/RegisterPage.tsx`
**Create:** `apps/frontend/src/features/auth/RegisterPage.module.css`

Mirror of LoginPage. Form with name, email, password. Client-side per-field validation. Google button. Link to /login.

### Task 3: VerifyEmailPage

**Create:** `apps/frontend/src/features/auth/VerifyEmailPage.tsx`

Reads `?token=` from URL, calls `GET /auth/verify-email?token=X`, shows success/error.

### Task 4: OAuthCallbackPage

**Create:** `apps/frontend/src/features/auth/OAuthCallbackPage.tsx`

Reads `window.location.hash`, parses `accessToken`/`refreshToken`, stores in tokenStorage, navigates to /dashboard. Handles error fragment.

### Task 5: Routes + exports

**Modify:** `apps/frontend/src/app/routes.tsx`
**Modify:** `apps/frontend/src/features/auth/index.ts`

Add 3 lazy-loaded public routes. Export new pages.

### Task 6: Flip mock auth

**Modify:** `apps/frontend/.env.development`

`VITE_USE_MOCK_AUTH=false`

### Task 7: Build + smoke test

Verify `pnpm -r run build` clean. Manual test: /register renders, /register link works from /login, OAuth callback parses tokens.
