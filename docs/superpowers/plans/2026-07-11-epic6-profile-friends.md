# Epic 6 — Users Profile + Friends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public profile (role-aware GET, self-edit, avatar upload) + friends system (request, accept/block, list) with notification integration.

**Architecture:** Modify existing `UsersController`/`UsersService` for profile endpoints. New `FriendshipsController`/`FriendshipsService` sub-module for friendship status management. Uses `FilesService` for avatar and `EventEmitter2` for friend-request notifications.

**Tech Stack:** NestJS 10, Prisma 6, multer (already installed), EventEmitter2 (already global), Jest 30.

**Spec:** `docs/superpowers/specs/2026-07-11-epic6-profile-friends-design.md`

---

## File Structure

### New files
| File | Responsibility |
|---|---|
| `apps/backend/src/users/dto/update-profile.dto.ts` | name?, bio? validation |
| `apps/backend/src/users/friendships/friendships.controller.ts` | PATCH /friendships/:id |
| `apps/backend/src/users/friendships/friendships.service.ts` | Accept/block logic |
| `apps/backend/src/users/friendships/dto/update-friendship.dto.ts` | status validation |
| `apps/backend/src/users/friendships/__tests__/friendships.service.spec.ts` | 5 tests |

### Modified files
| File | Change |
|---|---|
| `apps/backend/src/users/users.controller.ts` | Remove @Roles on GET /:id; add PATCH /me, /me/avatar, POST /:id/friend, GET /me/friends |
| `apps/backend/src/users/users.service.ts` | findOne role-aware; add updateProfile, uploadAvatar, sendFriendRequest, listFriends |
| `apps/backend/src/users/users.module.ts` | Import FilesModule, add FriendshipsController + FriendshipsService |
| `apps/backend/src/users/__tests__/users.service.spec.ts` | Append ~8 tests for new methods |

---

## Task 1: DTOs

**Files:**
- Create: `apps/backend/src/users/dto/update-profile.dto.ts`
- Create: `apps/backend/src/users/friendships/dto/update-friendship.dto.ts`

- [ ] **Step 1: Create UpdateProfileDto**

```ts
// apps/backend/src/users/dto/update-profile.dto.ts
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  bio?: string;
}
```

- [ ] **Step 2: Create UpdateFriendshipDto**

```ts
// apps/backend/src/users/friendships/dto/update-friendship.dto.ts
import { IsEnum } from 'class-validator';
import { FriendStatus } from '@prisma/client';

export class UpdateFriendshipDto {
  @IsEnum(FriendStatus)
  status: 'ACCEPTED' | 'BLOCKED';
}
```

- [ ] **Step 3: Build + commit**

```bash
pnpm --filter @ft-trascendence/backend run build
git add apps/backend/src/users/dto/update-profile.dto.ts apps/backend/src/users/friendships/dto/update-friendship.dto.ts
git commit -m "feat(users): add UpdateProfileDto + UpdateFriendshipDto"
```

---

## Task 2: Modify UsersService — profile + friends (TDD)

**Files:**
- Modify: `apps/backend/src/users/users.service.ts`
- Modify: `apps/backend/src/users/__tests__/users.service.spec.ts`

- [ ] **Step 1: Append failing tests for new methods**

Append to existing `users.service.spec.ts`. Add mocks for `prisma.friendship` and `FilesService`. Tests:

1. `findOne` as ADMIN returns full fields (organizationId, email, etc.)
2. `findOne` as STUDENT returns only public fields (id, name, avatarUrl, role, bio, onlineAt)
3. `updateProfile` updates name/bio and returns public profile
4. `sendFriendRequest` creates PENDING friendship; 409 if exists; 400 self-friend; 403 other org
5. `listFriends` returns accepted friends bidirectional (as requester and as addressee)

- [ ] **Step 2: Implement new methods**

Modify `users.service.ts`:
- Change `findOne(id, organizationId)` → `findOne(id, organizationId, callerRole)` with role-aware select
- Add `updateProfile(userId, dto)` → update + return public select
- Add `sendFriendRequest(callerId, targetId, callerOrgId)` → create Friendship, fire event
- Add `listFriends(userId)` → query bidirectional accepted friendships, return public profiles

Note: `uploadAvatar` will be added in Task 3 (needs FilesModule wiring first).

- [ ] **Step 3: Run tests + build + commit**

```bash
pnpm --filter @ft-trascendence/backend exec jest -- src/users/__tests__/users.service.spec.ts
pnpm --filter @ft-trascendence/backend exec jest
pnpm --filter @ft-trascendence/backend run build
git add apps/backend/src/users/users.service.ts apps/backend/src/users/__tests__/users.service.spec.ts
git commit -m "feat(users): add profile (role-aware findOne) + friends (sendRequest, listFriends)"
```

---

## Task 3: Avatar upload + FilesModule integration

**Files:**
- Modify: `apps/backend/src/users/users.service.ts` (add uploadAvatar method)
- Modify: `apps/backend/src/users/users.module.ts` (import FilesModule)
- Modify: `apps/backend/src/users/__tests__/users.service.spec.ts` (add avatar test)

- [ ] **Step 1: Wire FilesModule into UsersModule**

```ts
// users.module.ts
import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FriendshipsController } from './friendships/friendships.controller';
import { FriendshipsService } from './friendships/friendships.service';

@Module({
  imports: [FilesModule],
  controllers: [UsersController, FriendshipsController],
  providers: [UsersService, FriendshipsService],
})
export class UsersModule {}
```

Note: `FilesModule` must export `FilesService` for this to work. Check if it does; if not, add `exports: [FilesService]` to `FilesModule`.

- [ ] **Step 2: Add uploadAvatar to UsersService**

```ts
async uploadAvatar(userId: string, organizationId: string, file: Express.Multer.File) {
  const fileRecord = await this.filesService.createUpload(file, organizationId, userId);
  const { url } = await this.filesService.getSignedUrl(fileRecord.id);
  await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } });
  return this.getPublicProfile(userId);
}
```

Inject `FilesService` in the constructor:
```ts
constructor(
  private readonly prisma: PrismaService,
  @Optional() private readonly filesService?: FilesService,
) {}
```

- [ ] **Step 3: Test + build + commit**

```bash
pnpm --filter @ft-trascendence/backend exec jest
pnpm --filter @ft-trascendence/backend run build
git add apps/backend/src/users/
git commit -m "feat(users): add avatar upload via FilesService integration"
```

---

## Task 4: FriendshipsService (TDD)

**Files:**
- Create: `apps/backend/src/users/friendships/friendships.service.ts`
- Create: `apps/backend/src/users/friendships/__tests__/friendships.service.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
// friendships.service.spec.ts
describe('FriendshipsService', () => {
  // updateStatus: PENDING→ACCEPTED OK
  // updateStatus: PENDING→BLOCKED OK
  // updateStatus: 403 if caller is not addressee
  // updateStatus: 400 invalid transition (ACCEPTED→BLOCKED)
  // updateStatus: 404 friendship not found
});
```

- [ ] **Step 2: Implement FriendshipsService**

```ts
@Injectable()
export class FriendshipsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateStatus(friendshipId: string, newStatus: 'ACCEPTED' | 'BLOCKED', callerUserId: string) {
    const friendship = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship) throw new NotFoundException('Friendship not found');
    if (friendship.addresseeId !== callerUserId) throw new ForbiddenException('Only the addressee can accept/block');
    if (friendship.status !== 'PENDING') throw new BadRequestException(`Cannot transition from ${friendship.status} to ${newStatus}`);
    return this.prisma.friendship.update({ where: { id: friendshipId }, data: { status: newStatus } });
  }
}
```

- [ ] **Step 3: Run tests + build + commit**

```bash
pnpm --filter @ft-trascendence/backend exec jest -- src/users/friendships/__tests__/friendships.service.spec.ts
pnpm --filter @ft-trascendence/backend exec jest
pnpm --filter @ft-trascendence/backend run build
git add apps/backend/src/users/friendships/
git commit -m "feat(friends): implement FriendshipsService with TDD (accept/block transitions)"
```

---

## Task 5: Update UsersController + FriendshipsController

**Files:**
- Modify: `apps/backend/src/users/users.controller.ts`
- Create: `apps/backend/src/users/friendships/friendships.controller.ts`

- [ ] **Step 1: Modify UsersController**

Changes to existing controller:
1. Remove `@UseGuards(RolesGuard)` and `@Roles('ADMIN')` from `GET /users/:id` (findOne).
2. Pass `user.role` to `service.findOne()`.
3. Add new endpoints:
   - `@Patch('me')` → `updateProfile(dto, user)`
   - `@Patch('me/avatar') @UseInterceptors(FileInterceptor('file'))` → `uploadAvatar(file, user)`
   - `@Post(':id/friend')` → `sendFriendRequest(user, :id)`
   - `@Get('me/friends')` → `listFriends(user)`

IMPORTANT: Route order matters! `GET /users/me/friends` must come BEFORE `GET /users/:id` or NestJS will match `me` as `:id`. Place all `/users/me/*` routes before `/:id` routes.

- [ ] **Step 2: Create FriendshipsController**

```ts
@Controller('friendships')
export class FriendshipsController {
  constructor(private readonly friendshipsService: FriendshipsService) {}

  @Patch(':id')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateFriendshipDto, @CurrentUser() user: AuthUser) {
    return this.friendshipsService.updateStatus(id, dto.status, user.userId);
  }
}
```

- [ ] **Step 3: Run all tests + build + commit**

```bash
pnpm --filter @ft-trascendence/backend exec jest
pnpm --filter @ft-trascendence/backend run build
git add apps/backend/src/users/users.controller.ts apps/backend/src/users/friendships/friendships.controller.ts apps/backend/src/users/users.module.ts
git commit -m "feat(users): add profile + friends endpoints to UsersController + FriendshipsController"
```

---

## Task 6: Runtime smoke test

- [ ] Restart backend: `docker compose -f infra/docker/docker-compose.dev.yml restart backend`
- [ ] `GET /users/:id` as student → public profile (no email)
- [ ] `GET /users/:id` as admin → full profile (with email)
- [ ] `PATCH /users/me` → updates bio
- [ ] `POST /users/:id/friend` → 201, Friendship created
- [ ] `PATCH /friendships/:id` → ACCEPTED
- [ ] `GET /users/me/friends` → friend list

---

## Self-Review Notes

- Spec §4 (endpoints) → Tasks 2,3,4,5 ✓
- Spec §5 (route details) → Task 5 (controller) ✓
- Spec §6 (DTOs) → Task 1 ✓
- Spec §7 (service changes) → Tasks 2,3 ✓
- Spec §8 (file layout) → all tasks ✓
- Spec §10 (tests) → Tasks 2,4 ✓
- Route ordering (`/me/*` before `/:id`) documented in Task 5 ✓
- `@Optional()` for FilesService injection documented ✓
- EventEmitter2 for notifications documented ✓
- No placeholders ✓