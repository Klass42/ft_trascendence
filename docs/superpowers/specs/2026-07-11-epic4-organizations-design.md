# Epic 4 — Organizations (Design Spec)

**Owner:** Jorge (@SrJorgeG) — Identity & Access, Tech Lead
**Branch:** `jorge` → `staging` → `master`
**Date:** 2026-07-11
**Status:** Approved
**Scope:** Only Epic 4 of `docs/planning/Jorge.md`. Epics 5–8 are out of scope.

---

## 1. Purpose

Deliver the **Organization system** module (Major, 2 pts): CRUD on the tenant
organization + membership management (list/remove members). In the MVP there is
exactly one org (seeded `org-klass-0001`); every user belongs to it via
`User.organizationId` FK. No new orgs are created, no join table, no invitations —
those are Phase 2 (billing, subdomains, multi-org).

This unblocks Epic 5 (admin user CRUD + roles) by providing the org-scoped
membership surface, and Epic 7 (frontend org settings page).

## 2. Constraints (hard)

- **Reuse Epic 2 auth infrastructure.** `AppAuthGuard` (global), `@Public()`,
  `@Roles()`, `RolesGuard`, `@CurrentUser()` already exist. This epic uses
  `@Roles('ADMIN')` on admin-only endpoints. No new guards.
- **`organizationId` isolation = security bug if missing** (AGENTS.md §5). Every
  query over tenant data MUST filter by `organizationId`. The authenticated
  user's `organizationId` (from `@CurrentUser()`) is the scope — never trust a
  client-supplied `:id` without verifying it matches the caller's org.
- **Prisma schema unchanged.** `Organization { id, name, slug @unique, logoUrl?,
  createdAt, updatedAt }`. `User.organizationId` FK. No new models.
- **Never return `passwordHash`** in any user-facing response.
- **No soft-delete.** `DELETE /organizations/:id/members/:userId` physically
  deletes the `User` row. This is acceptable for the MVP (no audit requirements
  in scope). Elasticsearch-style tombstones are Phase 2.
- **English-only identifiers**; comments in English; commit bodies may be Spanish.
- **`import './telemetry/otel-sdk'` stays the first line of `main.ts`.**

## 3. Design decisions (from brainstorm)

| Topic | Decision | Rationale |
|---|---|---|
| Org creation scope | **A** — Admin only manages the seeded org. No `POST /organizations`. | Schema doesn't support multi-org per user (FK simple). Billing/subdomains are Phase 2. 2 pts for the module are earned with CRUD + membership on existing org. |
| Membership model | **A** — `User.organizationId` FK. "List members" = query users by org. "Remove member" = delete user. | No join table needed (FK is enough for single-org MVP). Epic 5 will add `/users` CRUD + role management separately. |
| Admin roles | **A** — Only `ADMIN` global role can edit org, list members, remove members. `TEACHER` and `STUDENT` can only `GET /organizations/me`. | Aligns with `@Roles('ADMIN')` from Epic 1. Simplest correct RBAC. |

## 4. Endpoints

| Method | Route | Guard | Roles | Response |
|---|---|---|---|---|
| `GET` | `/organizations/me` | `AppAuthGuard` | any | `Organization` (the caller's org) |
| `PATCH` | `/organizations/:id` | `AppAuthGuard` + `@Roles('ADMIN')` | ADMIN | `Organization` updated |
| `GET` | `/organizations/:id/members` | `AppAuthGuard` + `@Roles('ADMIN')` | ADMIN | `Member[]` (no `passwordHash`) |
| `DELETE` | `/organizations/:id/members/:userId` | `AppAuthGuard` + `@Roles('ADMIN')` | ADMIN | `204 No Content` |

### Route details

**`GET /organizations/me`**
- Returns the `Organization` row where `id === user.organizationId`.
- No `:id` param — the org is inferred from the authenticated user.
- Available to all authenticated users (no `@Roles`).

**`PATCH /organizations/:id`**
- Editable fields: `name`, `logoUrl`. `slug` is NOT editable (used in URLs).
- Security check: `:id` must equal `user.organizationId`. If mismatch → `403`.
- `UpdateOrganizationDto` with class-validator.

**`GET /organizations/:id/members`**
- Returns all `User` rows where `organizationId === :id`.
- Security check: `:id` must equal `user.organizationId`. If mismatch → `403`.
- Response shape: array of `Member` objects — `User` minus `passwordHash`:
  `{ id, email, name, avatarUrl, role, bio, onlineAt, emailVerifiedAt, createdAt, updatedAt }`.
- Uses Prisma `select` to exclude `passwordHash` at the query level (not just
  strip it after — defence in depth).

**`DELETE /organizations/:id/members/:userId`**
- Deletes the `User` row with `id === :userId`.
- Security checks:
  1. `:id` must equal `user.organizationId`. If mismatch → `403`.
  2. `:userId` must NOT equal `user.userId` (no self-deletion). If match → `400`.
- Returns `204 No Content`.
- Cascade: `Session`, `OAuthAccount`, `Enrollment`, `Friendship` etc. are
  deleted via Prisma `onDelete: Cascade` (already in the schema).

## 5. DTOs

```ts
// dto/update-organization.dto.ts
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateOrganizationDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;
}
```

## 6. Member response type

```ts
// organizations.service.ts
interface Member {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  bio: string | null;
  onlineAt: Date | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

This is `User` minus `passwordHash` and `organizationId` (redundant — the
caller already knows the org). Defined inline in the service, not exported
as a separate type file (YAGNI).

## 7. OrganizationsService

```ts
@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMyOrganization(organizationId: string): Promise<Organization> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto, callerOrgId: string): Promise<Organization> {
    if (id !== callerOrgId) {
      throw new ForbiddenException('Cannot edit an organization you do not belong to');
    }
    return this.prisma.organization.update({
      where: { id },
      data: dto,
    });
  }

  async findMembers(id: string, callerOrgId: string): Promise<Member[]> {
    if (id !== callerOrgId) {
      throw new ForbiddenException('Cannot list members of another organization');
    }
    return this.prisma.user.findMany({
      where: { organizationId: id },
      select: {
        id: true, email: true, name: true, avatarUrl: true, role: true,
        bio: true, onlineAt: true, emailVerifiedAt: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async removeMember(
    id: string,
    userId: string,
    callerOrgId: string,
    callerUserId: string,
  ): Promise<void> {
    if (id !== callerOrgId) {
      throw new ForbiddenException('Cannot remove members from another organization');
    }
    if (userId === callerUserId) {
      throw new BadRequestException('Cannot remove yourself');
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
```

Key points:
- `id !== callerOrgId` check in every method that takes `:id` — the caller
  can only act on their own org.
- `select` in `findMembers` excludes `passwordHash` at the Prisma level.
- `removeMember` checks self-deletion and proceeds with a hard delete.
  Cascade rules from the schema handle `Session`, `OAuthAccount`, etc.

## 8. OrganizationsController

```ts
// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  async findMine(@CurrentUser() user: AuthUser) {
    return this.organizationsService.findMyOrganization(user.organizationId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizationsService.update(id, dto, user.organizationId);
  }

  @Get(':id/members')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async findMembers(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizationsService.findMembers(id, user.organizationId);
  }

  @Delete(':id/members/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.organizationsService.removeMember(id, userId, user.organizationId, user.userId);
  }
}
```

Key points:
- `@UseGuards(RolesGuard)` is needed on admin routes because `RolesGuard` is
  NOT registered as a global guard (only `AppAuthGuard` is `APP_GUARD`). The
  `AppAuthGuard` runs first (auth), then `RolesGuard` checks the role metadata.
- `@Roles('ADMIN')` from `common/auth/roles.decorator.ts`.
- `GET /organizations/me` has NO `@Roles` — any authenticated user can call it.
- `@HttpCode(HttpStatus.NO_CONTENT)` on `DELETE` returns 204 with empty body.

## 9. OrganizationsModule

```ts
@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
```

Already imported in `app.module.ts` (empty skeleton from Epic 1). No change
needed in `app.module.ts`.

## 10. Tests (Definition of Done)

### Unit tests — `organizations.service.spec.ts`

- `findMyOrganization`: returns org when found; throws `NotFoundException` when
  org doesn't exist.
- `update`: updates name; throws `ForbiddenException` when `id !== callerOrgId`.
- `findMembers`: returns members excluding `passwordHash`; throws
  `ForbiddenException` when org mismatch.
- `removeMember`: deletes user; throws `ForbiddenException` when org mismatch;
  throws `BadRequestException` on self-deletion.

### Unit tests — `organizations.controller.spec.ts`

- Verifies `@Roles('ADMIN')` is present on `update`, `findMembers`,
  `removeMember`.
- Verifies `GET /organizations/me` has no `@Roles`.
- Verifies `@CurrentUser()` is used on all endpoints.

### Existing tests

All 45 tests from Epics 1+2+3 must still pass (no regressions).

## 11. Out of scope

- Creating new organizations (`POST /organizations`) — Phase 2 (billing,
  subdomains, multi-org).
- Join table `OrganizationMember(userId, organizationId, role)` — Phase 2.
- Email invitations to join an org — Phase 2.
- Soft-delete / deactivation of members — Phase 2.
- Transfer org ownership — Phase 2.
- Frontend org settings UI — Epic 7.
- User CRUD (`/users` endpoints) + role management — Epic 5.
- File scoping by `organizationId` (`GET /files/:id/url`, `DELETE /files/:id`) —
  tracked as existing security debt, not part of this epic.

## 12. Open items / hand-offs

- Epic 5 will add `/users` CRUD + role management. The `findMembers` and
  `removeMember` methods here overlap conceptually with Epic 5's admin user
  list, but the endpoints are different: `/organizations/:id/members` (this
  epic) vs `/users` (Epic 5, org-scoped admin CRUD). Coordinate to avoid
  duplication.
- Ale: no new env vars required.
- Aloiki / David: no impact — organizations endpoints are new and
  self-contained.