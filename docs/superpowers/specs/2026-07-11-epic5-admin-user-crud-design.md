# Epic 5 — Admin User CRUD + Role Management (Design Spec)

**Owner:** Jorge (@SrJorgeG) — Identity & Access, Tech Lead
**Branch:** `jorge` → `staging` → `master`
**Date:** 2026-07-11
**Status:** Approved
**Scope:** Only Epic 5 of `docs/planning/Jorge.md`. Epics 6–8 are out of scope.

---

## 1. Purpose

Deliver the **Advanced permissions** module (Major, 2 pts): full admin CRUD over
users within the admin's organization, plus role management (`GlobalRole` changes).
Complements Epic 4 (Organizations — membership perspective) with entity-level
user administration. Together they complete the organization + permissions
backbone.

## 2. Constraints (hard)

- **Reuse Epic 2–4 auth infrastructure.** `AppAuthGuard`, `@Roles('ADMIN')`,
  `RolesGuard`, `@CurrentUser()`, `argon2` all exist.
- **`organizationId` isolation = security bug if missing.**
- **Never return `passwordHash`.** Use Prisma `select` to exclude it.
- **Prisma schema unchanged.**
- **English-only identifiers**; comments in English.

## 3. Design decisions (from brainstorm)

| Topic | Decision | Rationale |
|---|---|---|
| DELETE on /users | **A** — Duplicate endpoint for REST coherence. Same implementation as Epic 4's membership delete. | `/users` CRUD should have its own DELETE. Trivial implementation. |

## 4. Endpoints

| Method | Route | Guard | Roles | Response |
|---|---|---|---|---|
| `GET` | `/users` | `AppAuthGuard` + `@Roles('ADMIN')` | ADMIN | `User[]` (no `passwordHash`, org-scoped) |
| `GET` | `/users/:id` | `AppAuthGuard` + `@Roles('ADMIN')` | ADMIN | `User` (no `passwordHash`, 403 if other org) |
| `POST` | `/users` | `AppAuthGuard` + `@Roles('ADMIN')` | ADMIN | `User` created (201, no `passwordHash`) |
| `PATCH` | `/users/:id` | `AppAuthGuard` + `@Roles('ADMIN')` | ADMIN | `User` updated (no `passwordHash`) |
| `DELETE` | `/users/:id` | `AppAuthGuard` + `@Roles('ADMIN')` | ADMIN | `204 No Content` |

### Route details

**`GET /users`**
- Returns all `User` rows where `organizationId === user.organizationId`.
- Excludes `passwordHash` via Prisma `select`.
- Sorted by `name` ascending.

**`GET /users/:id`**
- Finds user by `id`. Returns 404 if not found.
- 403 if `foundUser.organizationId !== user.organizationId` (org mismatch).
- Excludes `passwordHash`.

**`POST /users`**
- Creates user in the admin's org: `organizationId = user.organizationId`.
- `email` unique within org via `@@unique([organizationId, email])` → 409 on conflict.
- Password hashed with `argon2`. Dev: `emailVerifiedAt = now()` (same as Epic 2 register). Prod: `emailVerifiedAt = null` + logs verification link.
- `role` defaults to `STUDENT` if not provided.

**`PATCH /users/:id`**
- Editable fields: `name`, `email`, `role`, `bio`.
- NOT editable: `passwordHash`, `organizationId`, `emailVerifiedAt`.
- 403 if target user belongs to another org.
- 400 if admin changes their own `role` (prevent accidental demotion).
- If `email` changed, validates uniqueness within org (409 on conflict).

**`DELETE /users/:id`**
- 403 if target user belongs to another org.
- 400 if admin tries to delete themselves.
- Hard delete via `prisma.user.delete`. Cascade handles related rows (`Session`,
  `OAuthAccount`, etc.).

## 5. DTOs

```ts
// dto/create-user.dto.ts
export class CreateUserDto {
  @IsEmail({ require_tld: false })
  email: string;

  @IsString() @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  password: string;

  @IsString() @MinLength(1)
  name: string;

  @IsEnum(GlobalRole) @IsOptional()
  role?: 'ADMIN' | 'TEACHER' | 'STUDENT';
}

// dto/update-user.dto.ts
export class UpdateUserDto {
  @IsString() @MinLength(1) @IsOptional()
  name?: string;

  @IsEmail({ require_tld: false }) @IsOptional()
  email?: string;

  @IsEnum(GlobalRole) @IsOptional()
  role?: 'ADMIN' | 'TEACHER' | 'STUDENT';

  @IsString() @IsOptional()
  bio?: string;
}
```

## 6. UsersService

```ts
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // findMany(orgId) — all users in org, no passwordHash
  // findOne(id, orgId) — single user with 403 org check, 404 not found
  // create(dto, orgId) — hash password, auto-verify in dev, 409 dup email
  // update(id, dto, orgId, callerUserId) — 403 org check, 400 self-role-change
  // delete(id, orgId, callerUserId) — 403 org check, 400 self-delete, hard delete
}
```

Uses the same `select` pattern as Epic 4's `OrganizationsService.findMembers` for
excluding `passwordHash`. Uses `argon2.hash` for password (same as Epic 2's
`AuthService.register`).

## 7. UsersController

```ts
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // All endpoints: @UseGuards(RolesGuard) @Roles('ADMIN') + @CurrentUser()
  @Get()            findAll(orgId) → users
  @Get(':id')       findOne(id, orgId) → user
  @Post()           create(dto, orgId) → 201 user
  @Patch(':id')     update(id, dto, orgId, self) → user
  @Delete(':id')    delete(id, orgId, self) → 204
}
```

## 8. UsersModule

Already imported in `app.module.ts` (empty skeleton). Wire controller + service.

## 9. Tests

### Service (9 tests)
- `findAll`: returns users org-scoped, no passwordHash.
- `findOne`: returns user; 404; 403 org mismatch.
- `create`: creates with hashed password + default STUDENT; 409 dup email.
- `update`: changes name/email/role/bio; 403 org mismatch; 400 self-role-change.
- `delete`: deletes user; 403 org mismatch; 400 self-delete.

### Controller (6 tests)
- Verify `@Roles('ADMIN')` on all 5 endpoints.
- Verify `GET /users` not `@Roles` on findMine? All admin. Just verify decorator metadata.

### Existing
All 78 tests from Epics 1-4 must still pass.

## 10. Out of scope
- Changing user password from admin panel.
- Soft-delete / deactivation.
- Bulk operations.
- Frontend admin panel (Epic 7).
- Upgrading `DevAuthGuard` pattern — all admin endpoints use `@Roles('ADMIN')`.

## 11. Open items / hand-offs
- Epic 6 (profile + friends) will add non-admin user endpoints (`GET /users/:id`
  for profile view, `PATCH /users/me` for self-profile editing).
- Frontend admin panel in Epic 7 consumes these endpoints.