# Epic 4 — Organizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver CRUD + membership management for the seeded organization (4 endpoints) reusing Epic 2's auth infrastructure.

**Architecture:** `OrganizationsModule` (already empty skeleton in `app.module.ts`) gets a controller + service + DTO. `@Roles('ADMIN')` + `RolesGuard` on admin routes. `@CurrentUser()` provides org scope. No schema changes, no new guards.

**Tech Stack:** NestJS 10, Prisma 6, class-validator, Jest 30.

**Spec:** `docs/superpowers/specs/2026-07-11-epic4-organizations-design.md`

---

## File Structure

### New files
| File | Responsibility |
|---|---|
| `apps/backend/src/organizations/dto/update-organization.dto.ts` | Validate name/logoUrl |
| `apps/backend/src/organizations/organizations.service.ts` | Prisma queries (org-scoped, member queries without passwordHash) |
| `apps/backend/src/organizations/organizations.controller.ts` | 4 endpoints |
| `apps/backend/src/organizations/__tests__/organizations.service.spec.ts` | Unit tests for service |
| `apps/backend/src/organizations/__tests__/organizations.controller.spec.ts` | Unit tests for controller |

### Modified files
| File | Change |
|---|---|
| `apps/backend/src/organizations/organizations.module.ts` | Wire controller + service |

---

## Task 1: DTO — UpdateOrganizationDto

**Files:**
- Create: `apps/backend/src/organizations/dto/update-organization.dto.ts`

- [ ] **Step 1: Create the DTO**

```ts
// apps/backend/src/organizations/dto/update-organization.dto.ts
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

- [ ] **Step 2: Build**

Run: `pnpm --filter @ft-trascendence/backend run build`
Expected: compiles clean.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/organizations/dto/update-organization.dto.ts
git commit -m "feat(org): add UpdateOrganizationDto"
```

---

## Task 2: OrganizationsService — TDD

**Files:**
- Create: `apps/backend/src/organizations/__tests__/organizations.service.spec.ts`
- Create: `apps/backend/src/organizations/organizations.service.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/organizations/__tests__/organizations.service.spec.ts`:

```ts
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationsService } from '../organizations.service';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG_ID = 'org-klass-0001';
const OTHER_ORG = 'org-other-0001';

const mockOrg = {
  id: ORG_ID,
  name: 'Klass Academy',
  slug: 'klass',
  logoUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMembers = [
  {
    id: 'user-admin-0001',
    email: 'admin@demo',
    name: 'Ada Admin',
    avatarUrl: null,
    role: 'ADMIN' as const,
    bio: null,
    onlineAt: null,
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-student-0001',
    email: 'student@demo',
    name: 'Sam Student',
    avatarUrl: null,
    role: 'STUDENT' as const,
    bio: null,
    onlineAt: null,
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mkPrisma = () =>
  ({
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  }) as unknown as PrismaService;

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: ReturnType<typeof mkPrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = mkPrisma();
    service = new OrganizationsService(prisma);
  });

  // ── findMyOrganization ──
  describe('findMyOrganization', () => {
    it('returns the org when found', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
      const result = await service.findMyOrganization(ORG_ID);
      expect(result).toEqual(mockOrg);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({ where: { id: ORG_ID } });
    });

    it('throws NotFoundException when org does not exist', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.findMyOrganization('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ──
  describe('update', () => {
    it('updates the org when caller belongs to it', async () => {
      (prisma.organization.update as jest.Mock).mockResolvedValue({ ...mockOrg, name: 'New Name' });
      const result = await service.update(ORG_ID, { name: 'New Name' }, ORG_ID);
      expect(result.name).toBe('New Name');
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: ORG_ID },
        data: { name: 'New Name' },
      });
    });

    it('throws ForbiddenException when id !== callerOrgId', async () => {
      await expect(
        service.update(OTHER_ORG, { name: 'Hack' }, ORG_ID),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });
  });

  // ── findMembers ──
  describe('findMembers', () => {
    it('returns members without passwordHash', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockMembers);
      const result = await service.findMembers(ORG_ID, ORG_ID);
      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('passwordHash');
    });

    it('uses select to exclude passwordHash at query level', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockMembers);
      await service.findMembers(ORG_ID, ORG_ID);
      const args = (prisma.user.findMany as jest.Mock).mock.calls[0][0];
      expect(args.select).toBeDefined();
      expect(args.select.passwordHash).toBeUndefined();
    });

    it('throws ForbiddenException when org mismatch', async () => {
      await expect(service.findMembers(OTHER_ORG, ORG_ID)).rejects.toThrow(ForbiddenException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  // ── removeMember ──
  describe('removeMember', () => {
    it('deletes the user when caller is admin of same org', async () => {
      (prisma.user.delete as jest.Mock).mockResolvedValue({});
      await service.removeMember(ORG_ID, 'user-student-0001', ORG_ID, 'user-admin-0001');
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-student-0001' } });
    });

    it('throws ForbiddenException when org mismatch', async () => {
      await expect(
        service.removeMember(OTHER_ORG, 'user-student-0001', ORG_ID, 'user-admin-0001'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('throws BadRequestException on self-deletion', async () => {
      await expect(
        service.removeMember(ORG_ID, 'user-admin-0001', ORG_ID, 'user-admin-0001'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ft-trascendence/backend exec jest -- src/organizations/__tests__/organizations.service.spec.ts`
Expected: FAIL — `OrganizationsService is not defined`.

- [ ] **Step 3: Write the implementation**

Create `apps/backend/src/organizations/organizations.service.ts`:

```ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)

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

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMyOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto, callerOrgId: string) {
    if (id !== callerOrgId) {
      throw new ForbiddenException(
        'Cannot edit an organization you do not belong to',
      );
    }
    return this.prisma.organization.update({
      where: { id },
      data: dto,
    });
  }

  async findMembers(id: string, callerOrgId: string): Promise<Member[]> {
    if (id !== callerOrgId) {
      throw new ForbiddenException(
        'Cannot list members of another organization',
      );
    }
    return this.prisma.user.findMany({
      where: { organizationId: id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        bio: true,
        onlineAt: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
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
      throw new ForbiddenException(
        'Cannot remove members from another organization',
      );
    }
    if (userId === callerUserId) {
      throw new BadRequestException('Cannot remove yourself');
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ft-trascendence/backend exec jest -- src/organizations/__tests__/organizations.service.spec.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Run all tests to verify no regressions**

Run: `pnpm --filter @ft-trascendence/backend exec jest`
Expected: 54 tests pass (45 existing + 9 new).

- [ ] **Step 6: Build**

Run: `pnpm --filter @ft-trascendence/backend run build`
Expected: compiles clean.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/organizations/organizations.service.ts apps/backend/src/organizations/__tests__/organizations.service.spec.ts
git commit -m "feat(org): implement OrganizationsService with TDD (findMine, update, findMembers, removeMember)"
```

---

## Task 3: OrganizationsController + wire module — TDD

**Files:**
- Create: `apps/backend/src/organizations/__tests__/organizations.controller.spec.ts`
- Create: `apps/backend/src/organizations/organizations.controller.ts`
- Modify: `apps/backend/src/organizations/organizations.module.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/organizations/__tests__/organizations.controller.spec.ts`:

```ts
import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { Roles } from '@/common/auth/roles.decorator';
import { ROLES_KEY } from '@/common/auth/roles.decorator';
import { OrganizationsController } from '../organizations.controller';
import { OrganizationsService } from '../organizations.service';

const mkService = () => ({
  findMyOrganization: jest.fn(),
  update: jest.fn(),
  findMembers: jest.fn(),
  removeMember: jest.fn(),
}) as unknown as OrganizationsService;

const adminUser = {
  userId: 'user-admin-0001',
  email: 'admin@demo',
  name: 'Ada Admin',
  avatarUrl: null,
  organizationId: 'org-klass-0001',
  role: 'ADMIN' as const,
};

const studentUser = {
  userId: 'user-student-0001',
  email: 'student@demo',
  name: 'Sam Student',
  avatarUrl: null,
  organizationId: 'org-klass-0001',
  role: 'STUDENT' as const,
};

describe('OrganizationsController', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('route metadata', () => {
    let controller: OrganizationsController;

    beforeEach(() => {
      controller = new OrganizationsController(mkService());
    });

    it('GET /me has no @Roles decorator', () => {
      const roles = reflector.getAllAndOverride(ROLES_KEY, [
        controller.findMine,
        OrganizationsController,
      ]);
      expect(roles).toBeUndefined();
    });

    it('PATCH :id requires ADMIN role', () => {
      const roles = reflector.getAllAndOverride(ROLES_KEY, [
        controller.update,
        OrganizationsController,
      ]);
      expect(roles).toEqual(['ADMIN']);
    });

    it('GET :id/members requires ADMIN role', () => {
      const roles = reflector.getAllAndOverride(ROLES_KEY, [
        controller.findMembers,
        OrganizationsController,
      ]);
      expect(roles).toEqual(['ADMIN']);
    });

    it('DELETE :id/members/:userId requires ADMIN role', () => {
      const roles = reflector.getAllAndOverride(ROLES_KEY, [
        controller.removeMember,
        OrganizationsController,
      ]);
      expect(roles).toEqual(['ADMIN']);
    });
  });

  describe('endpoint behavior', () => {
    it('GET /me calls findMyOrganization with user.organizationId', async () => {
      const service = mkService();
      const controller = new OrganizationsController(service);
      await controller.findMine(adminUser);
      expect(service.findMyOrganization).toHaveBeenCalledWith('org-klass-0001');
    });

    it('PATCH :id calls update with id, dto, user.organizationId', async () => {
      const service = mkService();
      const controller = new OrganizationsController(service);
      await controller.update('org-klass-0001', { name: 'New' }, adminUser);
      expect(service.update).toHaveBeenCalledWith('org-klass-0001', { name: 'New' }, 'org-klass-0001');
    });

    it('GET :id/members calls findMembers with id, user.organizationId', async () => {
      const service = mkService();
      const controller = new OrganizationsController(service);
      await controller.findMembers('org-klass-0001', adminUser);
      expect(service.findMembers).toHaveBeenCalledWith('org-klass-0001', 'org-klass-0001');
    });

    it('DELETE :id/members/:userId calls removeMember with all params', async () => {
      const service = mkService();
      const controller = new OrganizationsController(service);
      await controller.removeMember('org-klass-0001', 'user-student-0001', adminUser);
      expect(service.removeMember).toHaveBeenCalledWith(
        'org-klass-0001', 'user-student-0001', 'org-klass-0001', 'user-admin-0001',
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ft-trascendence/backend exec jest -- src/organizations/__tests__/organizations.controller.spec.ts`
Expected: FAIL — `OrganizationsController is not defined`.

- [ ] **Step 3: Write the controller**

Create `apps/backend/src/organizations/organizations.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CurrentUser, AuthUser, Roles, RolesGuard } from '@/common/auth';

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
  async findMembers(@Param('id') id: string, @CurrentUser() user: AuthUser) {
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
    await this.organizationsService.removeMember(
      id,
      userId,
      user.organizationId,
      user.userId,
    );
  }
}
```

- [ ] **Step 4: Wire the module**

Replace `apps/backend/src/organizations/organizations.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ft-trascendence/backend exec jest -- src/organizations/__tests__/organizations.controller.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Run all tests + build**

Run: `pnpm --filter @ft-trascendence/backend exec jest`
Expected: 62 tests pass (54 + 8 new).

Run: `pnpm --filter @ft-trascendence/backend run build`
Expected: compiles clean.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/organizations/organizations.controller.ts apps/backend/src/organizations/organizations.module.ts apps/backend/src/organizations/__tests__/organizations.controller.spec.ts
git commit -m "feat(org): add OrganizationsController with 4 endpoints + wire module"
```

---

## Task 4: Runtime smoke test

**Files:** none (manual verification)

- [ ] **Step 1: Restart backend with new code**

```bash
docker compose -f infra/docker/docker-compose.dev.yml restart backend
```

Wait for "Nest application successfully started" in logs.

- [ ] **Step 2: Verify routes are mapped**

```bash
docker compose -f infra/docker/docker-compose.dev.yml logs backend --tail 80 2>&1 | grep -E 'organizations'
```
Expected: Lines showing `{/organizations/me, GET}`, `{/organizations/:id, PATCH}`, `{/organizations/:id/members, GET}`, `{/organizations/:id/members/:userId, DELETE}`.

- [ ] **Step 3: Test GET /organizations/me with dev header**

```bash
curl -s http://localhost:3000/organizations/me \
  -H 'x-dev-user: user-student-0001' | python3 -m json.tool
```
Expected: JSON with `id: org-klass-0001`, `name`, `slug`.

- [ ] **Step 4: Test GET /organizations/:id/members as admin**

```bash
curl -s http://localhost:3000/organizations/org-klass-0001/members \
  -H 'x-dev-user: user-admin-0001' | python3 -m json.tool
```
Expected: Array of users (without `passwordHash`).

- [ ] **Step 5: Test PATCH /organizations/:id as admin**

```bash
curl -s -X PATCH http://localhost:3000/organizations/org-klass-0001 \
  -H 'Content-Type: application/json' \
  -H 'x-dev-user: user-admin-0001' \
  -d '{"name":"Klass Academy Updated"}' | python3 -m json.tool
```
Expected: JSON with updated name.

- [ ] **Step 6: Test 403 org mismatch**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:3000/organizations/org-other-0001/members \
  -H 'x-dev-user: user-admin-0001'
```
Expected: `403`.

- [ ] **Step 7: No commit unless fixes were needed**

---

## Self-Review Notes

- Spec §4 (endpoints) → Task 3 (controller) ✓
- Spec §5 (DTO) → Task 1 ✓
- Spec §7 (service) → Task 2 ✓
- Spec §8 (controller) → Task 3 ✓
- Spec §10 (tests) → Task 2 (9 service tests), Task 3 (8 controller tests) = 17 new tests ✓
- `findMyOrganization`, `update`, `findMembers`, `removeMember` — names consistent across spec, service, controller, tests. ✓
- `Member` interface defined in service (Task 2) and used in `findMembers` return type. ✓
- `UpdateOrganizationDto` created in Task 1, imported in service (Task 2) and controller (Task 3). ✓
- `ROLES_KEY` imported from `@/common/auth/roles.decorator` in controller test (Task 3). ✓
- No placeholders. ✓