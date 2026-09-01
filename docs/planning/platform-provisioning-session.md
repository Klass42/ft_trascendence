# Platform provisioning — next-session brief

## Goal

Turn the current single-organization LMS into a provisioned multi-tenant product:

```text
Platform superadmin (no organization)
  -> provisions Organization + first organization admin
    -> organization admin invites teachers/students
      -> invited member chooses a password and signs in to that organization
```

This is deliberately an application-layer tenant model: no subdomains, billing,
PostgreSQL RLS, or per-tenant databases for this scope.

## Current state

- `User.organizationId` is mandatory and all public registration/login/OAuth flows use
  `DEFAULT_ORG_ID` in `apps/backend/src/auth/auth.service.ts`.
- Organization admins can currently create users at `POST /users`, but must assign a password.
- Organization settings and membership UI already exist under `/org` and `/admin/users`.
- The backend now derives tenant scope from the authenticated user. Do not reintroduce
  `organizationId` query parameters.
- Current uncommitted security changes are in enrollment, sections, lessons and files controllers/services.

## Required data model

Update `apps/backend/prisma/schema.prisma` and create a Prisma migration. Keep Prisma as the
only schema source of truth.

1. Make `User.organizationId` nullable, but retain the relation and tenant-scoped composite
   uniqueness for normal users.
2. Add `User.platformRole PlatformRole @default(NONE)`.
3. Add enums:

   ```prisma
   enum PlatformRole { NONE SUPERADMIN }
   enum OrganizationStatus { ACTIVE SUSPENDED ARCHIVED }
   enum InvitationStatus { PENDING ACCEPTED REVOKED EXPIRED }
   ```

4. Add to `Organization`: `status`, `primaryColor?`, `defaultLanguage` and `timezone`.
5. Add `OrganizationInvitation`: `id`, `organizationId`, `email`, tenant `role`,
   `tokenHash`, `status`, `expiresAt`, `acceptedAt`, `invitedById`, timestamps.
   A pending invitation must be unique per `(organizationId, email)`.
6. Add `AuditLog` for platform operations: actor, action, target organization/user, metadata,
   timestamp. Never put raw invitation tokens in it.

Do **not** add billing, plans, tenant subdomains or raw SQL/RLS as part of this block.

## Authorization contract

- Keep `User.role` as the organization role: `ADMIN | TEACHER | STUDENT`.
- `platformRole` is separate. Do not place `SUPERADMIN` inside `GlobalRole`.
- Extend `AuthUser` and the frontend API user contract with `platformRole` and nullable
  `organizationId`.
- Add `@PlatformRoles()` and `PlatformRolesGuard`; it must be independent from `RolesGuard`.
- Tenant endpoints must reject accounts with no `organizationId` (prefer a small shared
  `TenantContext`/guard over scattered non-null assertions).
- A platform superadmin must use a platform layout, never the ordinary `AppLayout`.

## Backend API to implement

All DTOs need `class-validator` validation and backend tests.

- `POST /platform/organizations` — `SUPERADMIN`; transactionally create active organization,
  first admin invitation and audit entry.
- `GET /platform/organizations`, `GET /platform/organizations/:id` — `SUPERADMIN`.
- `PATCH /platform/organizations/:id` — `SUPERADMIN`; update safe configuration.
- `POST /platform/organizations/:id/suspend` — `SUPERADMIN`; suspend and revoke sessions.
- `POST /organizations/me/invitations` — organization `ADMIN`; invite `ADMIN`, `TEACHER` or
  `STUDENT` without exposing a password.
- `POST /organizations/me/invitations/:id/revoke` — organization `ADMIN`.
- `GET /auth/invitations/:token` — public, returns only safe invitation/org branding metadata.
- `POST /auth/invitations/:token/accept` — public; consume token once, create user/password,
  issue normal tokens and write audit log.
- `POST /auth/resolve-organization` — public, accepts a slug and returns safe branding/status.
- Login and registration must require a resolved organization slug; remove `DEFAULT_ORG_ID`.
  Google OAuth needs a tenant-aware entry point and must never silently create an account in a
  default tenant.

Token rules: generate with `crypto.randomBytes`, persist only a SHA-256 hash, expire in 7 days,
make acceptance transactional and return generic errors for invalid/expired/revoked tokens.

## Frontend API/UI

- Create `PlatformRoute`, `/platform`, `/platform/organizations`,
  `/platform/organizations/new`, `/platform/organizations/:id`.
- Build a separate `PlatformLayout`; it must not render courses, tenant settings or tenant nav.
- Change `/admin/users` wording and flow from direct password creation to member invitations.
- Login starts with organization slug/code. When resolved, show organization name/logo/color,
  then show credential form. Preserve tenant context only for UX; the backend remains authoritative.
- Add invitation acceptance route and password validation matching backend policy.
- Handle suspended organizations with a clear sign-in error.

## Security and acceptance checks

- A superadmin cannot call a tenant endpoint; a tenant user cannot call `/platform/**`.
- No caller can select another tenant through URL, body or query string.
- A pending invitation cannot be accepted twice, after expiry, or after revoke.
- A tenant admin cannot invite a user into another organization.
- Prevent removal/demotion of the final active organization admin.
- Suspend must revoke all organization sessions and block new login/token refresh.
- Add unit tests for guards/services and E2E happy paths: provision -> invite -> accept -> login.
- Run `pnpm --filter backend exec tsc --noEmit --incremental false`, frontend equivalent,
  `prisma validate`, and the relevant test suites.

## Suggested execution order

1. First commit and integrate the existing tenant-isolation fixes.
2. Prisma schema + migration + generated client + seed one superadmin.
3. Auth contract and platform guard.
4. Provisioning API and audit log tests.
5. Invitation API and acceptance flow.
6. Tenant-aware login/register/OAuth.
7. Platform UI, invitation UI and E2E tests.

## Prompt to paste into the next Codex session

```text
Implement the full platform-provisioning block described in
docs/planning/platform-provisioning-session.md. Read AGENTS.md first and follow it.

Start by checking git status and preserving existing uncommitted tenant-isolation changes.
This is a NestJS + Prisma + Vite React monorepo. Implement the feature end to end: Prisma
migration, platform superadmin without organization membership, separate platform RBAC/guard,
transactional organization provisioning with first-admin invitation, secure invitations and
acceptance, tenant-aware login by organization slug, platform UI and tenant-admin invitation UI.

Do not use DEFAULT_ORG_ID, client-supplied organizationId for authorization, subdomains, RLS or
billing. Keep platform roles distinct from tenant roles. Add backend/frontend validation and
tests. Work in small verified steps, do not overwrite unrelated user changes, and report exact
files changed plus commands/tests run. If the build cannot clean dist because it belongs to
another user, verify with `tsc --noEmit --incremental false` and state that limitation.
```
