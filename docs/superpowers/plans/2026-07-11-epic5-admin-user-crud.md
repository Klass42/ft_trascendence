# Epic 5 — Admin User CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** Admin CRUD over users (5 endpoints) with role management, org-scoped, `@Roles('ADMIN')`.

**Architecture:** `UsersModule` (already skeleton in app.module.ts) gets controller + service + 2 DTOs. Reuses auth infra from Epics 1-4. Same patterns as Epic 4.

**Tech Stack:** NestJS 10, Prisma 6, argon2, class-validator, Jest 30.

**Spec:** `docs/superpowers/specs/2026-07-11-epic5-admin-user-crud-design.md`

---

## File Structure

### New files
| File | Responsibility |
|---|---|
| `apps/backend/src/users/dto/create-user.dto.ts` | Email, password, name, role validation |
| `apps/backend/src/users/dto/update-user.dto.ts` | Name, email, role, bio optional fields |
| `apps/backend/src/users/users.service.ts` | Prisma queries (org-scoped, argon2, no passwordHash) |
| `apps/backend/src/users/users.controller.ts` | 5 endpoints |
| `apps/backend/src/users/__tests__/users.service.spec.ts` | Unit tests (9 tests) |
| `apps/backend/src/users/__tests__/users.controller.spec.ts` | Unit tests (6 tests) |

### Modified files
| File | Change |
|---|---|
| `apps/backend/src/users/users.module.ts` | Wire controller + service |

---

## Task 1: DTOs — CreateUserDto + UpdateUserDto

**Files:**
- Create: `apps/backend/src/users/dto/create-user.dto.ts`
- Create: `apps/backend/src/users/dto/update-user.dto.ts`

- [ ] **Step 1: Create DTO files**

```ts
// apps/backend/src/users/dto/create-user.dto.ts
import { GlobalRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail({ require_tld: false })
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(GlobalRole)
  @IsOptional()
  role?: GlobalRole;
}
```

```ts
// apps/backend/src/users/dto/update-user.dto.ts
import { GlobalRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsEmail({ require_tld: false })
  @IsOptional()
  email?: string;

  @IsEnum(GlobalRole)
  @IsOptional()
  role?: GlobalRole;

  @IsString()
  @IsOptional()
  bio?: string;
}
```

- [ ] **Step 2: Build + commit**

```bash
pnpm --filter @ft-trascendence/backend run build
git add apps/backend/src/users/dto/
git commit -m "feat(users): add CreateUserDto + UpdateUserDto"
```

---

## Task 2: UsersService — TDD (9 tests)

**Files:**
- Create: `apps/backend/src/users/__tests__/users.service.spec.ts`
- Create: `apps/backend/src/users/users.service.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/users/__tests__/users.service.spec.ts`:

```ts
import { ConflictException, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG_ID = 'org-klass-0001';
const OTHER_ORG = 'org-other-0001';
const ADMIN_ID = 'user-admin-0001';

const mockUser = {
  id: 'user-student-0001',
  organizationId: ORG_ID,
  email: 'student@demo', name: 'Sam', passwordHash: 'secret',
  avatarUrl: null, bio: null, role: 'STUDENT', onlineAt: null,
  emailVerifiedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
};

const mkPrisma = () => ({
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}) as unknown as PrismaService;

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof mkPrisma>;

  beforeEach(() => { jest.clearAllMocks(); prisma = mkPrisma(); service = new UsersService(prisma); });

  describe('findAll', () => {
    it('returns org-scoped users without passwordHash', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUser]);
      const r = await service.findAll(ORG_ID);
      expect(r).toHaveLength(1);
      const args = (prisma.user.findMany as jest.Mock).mock.calls[0][0];
      expect(args.where.organizationId).toBe(ORG_ID);
      expect(args.select.passwordHash).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('returns user if belongs to org', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      const r = await service.findOne('user-student-0001', ORG_ID);
      expect(r.id).toBe('user-student-0001');
    });
    it('throws NotFoundException if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('ghost', ORG_ID)).rejects.toThrow(NotFoundException);
    });
    it('throws ForbiddenException if org mismatch', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await expect(service.findOne('user-student-0001', OTHER_ORG)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('creates user with hashed password', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      process.env.NODE_ENV = 'development';
      const r = await service.create({ email: 'n@demo', password: 'Password1', name: 'N' }, ORG_ID);
      const cd = (prisma.user.create as jest.Mock).mock.calls[0][0].data;
      expect(cd.passwordHash).not.toBe('Password1');
      expect(cd.role).toBe('STUDENT');
      process.env.NODE_ENV = 'test';
    });
    it('throws 409 on duplicate email', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      await expect(
        service.create({ email: 'student@demo', password: 'Password1', name: 'N' }, ORG_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates fields', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser, name: 'New' });
      const r = await service.update('user-student-0001', { name: 'New' }, ORG_ID, ADMIN_ID);
      expect(r.name).toBe('New');
    });
    it('throws 403 org mismatch', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await expect(
        service.update('user-student-0001', { name: 'New' }, OTHER_ORG, ADMIN_ID),
      ).rejects.toThrow(ForbiddenException);
    });
    it('throws 400 on self-role-change', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await expect(
        service.update(ADMIN_ID, { role: 'STUDENT' as any }, ORG_ID, ADMIN_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.delete as jest.Mock).mockResolvedValue({});
      await service.remove('user-student-0001', ORG_ID, ADMIN_ID);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-student-0001' } });
    });
    it('throws 403 org mismatch', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await expect(service.remove('user-student-0001', OTHER_ORG, ADMIN_ID)).rejects.toThrow(ForbiddenException);
    });
    it('throws 400 self-delete', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, id: ADMIN_ID });
      await expect(service.remove(ADMIN_ID, ORG_ID, ADMIN_ID)).rejects.toThrow(BadRequestException);
    });
  });
});
```

- [ ] **Step 3: Run test → FAIL, implement service → PASS**

Run: `pnpm --filter @ft-trascendence/backend exec jest -- src/users/__tests__/users.service.spec.ts`

Create `apps/backend/src/users/users.service.ts`:

```ts
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const selectUser = { id: true, email: true, name: true, avatarUrl: true, role: true, bio: true, onlineAt: true, emailVerifiedAt: true, organizationId: true, createdAt: true, updatedAt: true, } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.user.findMany({ where: { organizationId }, select: selectUser, orderBy: { name: 'asc' } });
  }

  async findOne(id: string, organizationId: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: selectUser });
    if (!user) throw new NotFoundException('User not found');
    if (user.organizationId !== organizationId) throw new ForbiddenException('User belongs to another organization');
    return user;
  }

  async create(dto: CreateUserDto, organizationId: string) {
    const existing = await this.prisma.user.findFirst({ where: { organizationId, email: dto.email } });
    if (existing) throw new ConflictException('Email already registered in this organization');
    const isDev = process.env.NODE_ENV !== 'production';
    return this.prisma.user.create({
      data: { organizationId, email: dto.email, name: dto.name, passwordHash: await argon2.hash(dto.password), role: dto.role ?? 'STUDENT', emailVerifiedAt: isDev ? new Date() : null },
      select: selectUser,
    });
  }

  async update(id: string, dto: UpdateUserDto, organizationId: string, callerUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { ...selectUser, passwordHash: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.organizationId !== organizationId) throw new ForbiddenException('User belongs to another organization');
    if (dto.role !== undefined && id === callerUserId) throw new BadRequestException('Cannot change your own role');
    return this.prisma.user.update({ where: { id }, data: dto, select: selectUser });
  }

  async remove(id: string, organizationId: string, callerUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { organizationId: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.organizationId !== organizationId) throw new ForbiddenException('User belongs to another organization');
    if (id === callerUserId) throw new BadRequestException('Cannot delete yourself');
    await this.prisma.user.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Run all tests + build**

```bash
pnpm --filter @ft-trascendence/backend exec jest
pnpm --filter @ft-trascendence/backend run build
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/users/users.service.ts apps/backend/src/users/__tests__/users.service.spec.ts
git commit -m "feat(users): implement UsersService with TDD (admin CRUD + role management)"
```

---

## Task 3: UsersController + module

**Files:**
- Create: `apps/backend/src/users/__tests__/users.controller.spec.ts`
- Create: `apps/backend/src/users/users.controller.ts`
- Modify: `apps/backend/src/users/users.module.ts`

- [ ] **Step 1: Create controller test → FAIL, implement → PASS**

Create `apps/backend/src/users/__tests__/users.controller.spec.ts`:

```ts
import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@/common/auth/roles.decorator';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';

const mkService = () => ({ findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() }) as unknown as UsersService;
const admin = { userId: 'user-admin-0001', organizationId: 'org-klass-0001', role: 'ADMIN' as const } as any;

describe('UsersController', () => {
  const reflector = new Reflector();

  ['findAll', 'findOne', 'create', 'update', 'remove'].forEach(method => {
    it(`${method} requires ADMIN role`, () => {
      const ctrl = new UsersController(mkService());
      const roles = reflector.getAllAndOverride(ROLES_KEY, [(ctrl as any)[method], UsersController]);
      expect(roles).toEqual(['ADMIN']);
    });
  });

  it('findAll calls service with user.organizationId', async () => {
    const svc = mkService(); await new UsersController(svc).findAll(admin);
    expect(svc.findAll).toHaveBeenCalledWith('org-klass-0001');
  });
  it('create calls service with dto + user.organizationId', async () => {
    const svc = mkService(); await new UsersController(svc).create({ email: 'n@demo', password: 'Pw1', name: 'N' } as any, admin);
    expect(svc.create).toHaveBeenCalledWith(expect.any(Object), 'org-klass-0001');
  });
});
```

Create `apps/backend/src/users/users.controller.ts`:

```ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser, AuthUser, Roles, RolesGuard } from '@/common/auth';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get() @UseGuards(RolesGuard) @Roles('ADMIN')
  async findAll(@CurrentUser() user: AuthUser) { return this.usersService.findAll(user.organizationId); }

  @Get(':id') @UseGuards(RolesGuard) @Roles('ADMIN')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.usersService.findOne(id, user.organizationId); }

  @Post() @UseGuards(RolesGuard) @Roles('ADMIN')
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) { return this.usersService.create(dto, user.organizationId); }

  @Patch(':id') @UseGuards(RolesGuard) @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) { return this.usersService.update(id, dto, user.organizationId, user.userId); }

  @Delete(':id') @UseGuards(RolesGuard) @Roles('ADMIN') @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) { await this.usersService.remove(id, user.organizationId, user.userId); }
}
```

Update `apps/backend/src/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
```

- [ ] **Step 2: Run all tests + build + commit**

```bash
pnpm --filter @ft-trascendence/backend exec jest
pnpm --filter @ft-trascendence/backend run build
git add apps/backend/src/users/users.controller.ts apps/backend/src/users/__tests__/users.controller.spec.ts apps/backend/src/users/users.module.ts
git commit -m "feat(users): add UsersController with 5 endpoints + wire module"
```

---

## Task 4: Runtime smoke test

- [ ] Restart backend with `docker compose -f infra/docker/docker-compose.dev.yml up -d backend`
- [ ] Test: `curl -s http://localhost:3000/users -H 'x-dev-user: user-admin-0001' | python3 -m json.tool`
- [ ] Test: `curl -s -X POST http://localhost:3000/users -H 'Content-Type: application/json' -H 'x-dev-user: user-admin-0001' -d '{"email":"test@demo","password":"Password1","name":"Test"}' | python3 -m json.tool`
- [ ] Verify no `passwordHash` in response

---

## Self-Review

- Spec §4 (endpoints) → Task 3 ✓
- Spec §5 (DTOs) → Task 1 ✓
- Spec §6 (service) → Task 2 ✓
- Spec §7 (controller) → Task 3 ✓
- Spec §9 (tests) → Task 2 (13 tests) + Task 3 (6 tests) ✓
- No placeholders. ✓