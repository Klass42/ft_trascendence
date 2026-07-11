# Epic 6 — Users Profile API + Friends (Design Spec)

**Owner:** Jorge (@SrJorgeG) — Identity & Access, Tech Lead
**Branch:** `jorge` → `staging` → `master`
**Date:** 2026-07-11
**Status:** Approved
**Scope:** Only Epic 6 of `docs/planning/Jorge.md`. Epics 7–8 are out of scope.

---

## 1. Purpose

Deliver the public-facing user profile (view, self-edit, avatar upload) and the
friends system (request, accept, block, list). Completes the **Standard user
management** module (Major, 2 pts — profile/avatar/friends/status). Integrates
with David's `NotificationsService` (event bus) for friend request notifications
and with Aloiki's `FilesService` for avatar storage.

## 2. Constraints (hard)

- **Reuse Epic 2–5 auth infrastructure.** `AppAuthGuard`, `@Roles()`, `RolesGuard`,
  `@CurrentUser()` all exist. New endpoints use NO role restrictions (any
  authenticated user) except where noted.
- **Modify existing `UsersController`/`UsersService`** from Epic 5 — make
  `GET /users/:id` role-aware instead of admin-only.
- **Never return `passwordHash`.** Prisma `select` excludes it.
- **Prisma schema unchanged.** `Friendship` model already exists with
  `requesterId`, `addresseeId`, `status: FriendStatus(PENDING/ACCEPTED/BLOCKED)`,
  `@@unique([requesterId, addresseeId])`.
- **`FilesService.createUpload(file, organizationId, uploaderId)`** is the contract
  from Aloiki (already implemented in `apps/backend/src/files/files.service.ts`).
- **`NotificationsService`** uses `EventEmitter2` event bus. Inject with
  `@Optional()` — if unavailable, friends still work without notifications.
- **Org-scoped:** users can only view/friend users within their own org.

## 3. Design decisions (from brainstorm)

| Topic | Decision | Rationale |
|---|---|---|
| Profile vs admin GET | **C** — Single `GET /users/:id` endpoint, role-aware response. Remove `@Roles('ADMIN')`. Admin sees full fields, non-admin sees public profile. | Avoids duplicate routes. Backward-compatible for admin. |
| Avatar upload | **A** — Dedicated `PATCH /users/me/avatar` (multipart). Calls `FilesService.createUpload`, updates `user.avatarUrl`. | Single responsibility, one frontend call. |
| Blocking | **A** — Only block from received request (`PENDING→BLOCKED`). Only addressee can block. No preemptive block. | MVP simplicity. Covers real use case (spam rejection). |

## 4. Endpoints

| Method | Route | Auth | Response |
|---|---|---|---|
| `GET` | `/users/:id` | any authenticated | `PublicProfile` or `AdminProfile` (role-dependent) |
| `PATCH` | `/users/me` | any authenticated | `PublicProfile` updated |
| `PATCH` | `/users/me/avatar` | any authenticated (multipart) | `PublicProfile` with new `avatarUrl` |
| `POST` | `/users/:id/friend` | any authenticated | `Friendship` created (201) |
| `GET` | `/users/me/friends` | any authenticated | `PublicProfile[]` (accepted friends) |
| `PATCH` | `/friendships/:id` | any authenticated (addressee only) | `Friendship` updated |

### Response shapes

**PublicProfile** (non-admin sees this, also used for friend lists):
```ts
{ id, name, avatarUrl, role, bio, onlineAt }
```

**AdminProfile** (admin sees this — same as Epic 5):
```ts
{ id, email, name, avatarUrl, role, bio, onlineAt, emailVerifiedAt, organizationId, createdAt, updatedAt }
```

**Friendship:**
```ts
{ id, requesterId, addresseeId, status, createdAt }
```

## 5. Route details

### `GET /users/:id` (MODIFIED from Epic 5)

- Remove `@Roles('ADMIN')` and `@UseGuards(RolesGuard)`.
- If caller is ADMIN → return `AdminProfile` (full select).
- If caller is non-admin → return `PublicProfile` (limited select).
- 404 if user not found.
- 403 if user belongs to another org (org-scoped).

### `PATCH /users/me`

- Editable fields: `name`, `bio`.
- Updates the caller's own user record.
- Returns `PublicProfile`.

### `PATCH /users/me/avatar`

- `@UseInterceptors(FileInterceptor('file'))`.
- Calls `FilesService.createUpload(file, user.organizationId, user.userId)`.
- Gets the file record back, constructs avatar URL (or stores the file ID).
- Updates `user.avatarUrl` with the result.
- Returns `PublicProfile` with updated `avatarUrl`.

### `POST /users/:id/friend`

- Creates `Friendship(requesterId=caller.userId, addresseeId=:id, status=PENDING)`.
- 409 if friendship already exists (either direction).
- 400 if `:id === caller.userId` (can't friend yourself).
- 403 if target user belongs to another org.
- Emits `FRIEND_REQUEST` notification to addressee via `NotificationsService`
  (injected `@Optional()` — no-op if unavailable).
- Returns 201 with the `Friendship` object.

### `GET /users/me/friends`

- Returns all users where a `Friendship` with status `ACCEPTED` exists and the
  caller is either `requesterId` or `addresseeId`.
- Returns `PublicProfile[]` (the friend's profile, not the Friendship row).
- Org-scoped by the caller's org (friendships are implicitly same-org since
  friend requests are org-scoped).

### `PATCH /friendships/:id`

- Body: `{ status: 'ACCEPTED' | 'BLOCKED' }`.
- Only the `addressee` of the friendship can call this. If caller is not the
  addressee → 403.
- Valid transitions: `PENDING → ACCEPTED`, `PENDING → BLOCKED`.
- Any other transition (e.g., `ACCEPTED → BLOCKED`, `BLOCKED → ACCEPTED`) → 400.
- Returns updated `Friendship` object.

## 6. DTOs

```ts
// dto/update-profile.dto.ts
export class UpdateProfileDto {
  @IsString() @MinLength(1) @IsOptional()
  name?: string;

  @IsString() @IsOptional()
  bio?: string;
}

// friendships/dto/update-friendship.dto.ts
export class UpdateFriendshipDto {
  @IsEnum(FriendStatus)
  status: 'ACCEPTED' | 'BLOCKED';
}
```

## 7. Service changes

### UsersService (modify existing)

- `findOne(id, callerOrgId, callerRole)` → role-aware select.
- `updateProfile(callerUserId, dto)` → update name/bio, return public profile.
- `uploadAvatar(callerUserId, callerOrgId, file)` → call FilesService, update
  avatarUrl, return public profile.
- `sendFriendRequest(callerId, targetId, callerOrgId)` → create Friendship, emit
  notification, return Friendship.
- `listFriends(callerId)` → query Friendships(ACCEPTED) bidirectional, return
  public profiles.

### FriendshipsService (new)

- `updateStatus(friendshipId, newStatus, callerUserId)` → validate addressee,
  validate transition, update, return Friendship.

## 8. File layout

```
apps/backend/src/users/
  users.controller.ts          # MODIFY: remove @Roles on GET /:id, add PATCH /me, /me/avatar, POST /:id/friend, GET /me/friends
  users.service.ts             # MODIFY: findOne role-aware, add updateProfile, uploadAvatar, sendFriendRequest, listFriends
  users.module.ts              # MODIFY: import FriendshipsController, FriendshipsService, FilesModule
  dto/
    update-profile.dto.ts      # NEW
  friendships/
    friendships.controller.ts  # NEW: PATCH /friendships/:id
    friendships.service.ts     # NEW: updateStatus
    dto/
      update-friendship.dto.ts # NEW
    __tests__/
      friendships.service.spec.ts  # NEW
  __tests__/
    users.service.spec.ts      # APPEND: profile + avatar + friends tests
```

## 9. Dependencies

- `FilesService` from `FilesModule` — need to import `FilesModule` in `UsersModule`
  (or make FilesService available globally, but it's not @Global).
- `NotificationsService` from `NotificationsModule` — inject with `@Optional()`.
  Use `EventEmitter2` directly (already global via `EventEmitterModule.forRoot()`)
  to fire the event instead of importing the module. This avoids circular deps.

Actually, looking at David's pattern: the `RealtimeGateway` listens on
`@OnEvent('notification.created')`. The `NotificationsService` fires this event.
So the cleanest integration is:
1. Import `NotificationsModule` in `UsersModule` (or use `@Optional()` inject).
2. Call `notificationsService.emit(userId, 'FRIEND_REQUEST', { ... })`.

OR — fire the event directly on `EventEmitter2` (already global). This decouples
completely. Let's use `EventEmitter2` directly — same pattern David uses.

## 10. Tests

### UsersService (append, ~8 tests)
- `findOne` as ADMIN → full fields.
- `findOne` as STUDENT → public fields only.
- `updateProfile` → updates name/bio.
- `uploadAvatar` → calls FilesService, updates avatarUrl.
- `sendFriendRequest` → creates Friendship PENDING; 409 dup; 400 self-friend.
- `listFriends` → returns accepted friends bidirectional.

### FriendshipsService (~5 tests)
- `updateStatus` accept → PENDING→ACCEPTED.
- `updateStatus` block → PENDING→BLOCKED.
- 403 if not addressee.
- 400 invalid transition (ACCEPTED→BLOCKED).
- 404 if friendship not found.

### Existing
All 100 tests from Epics 1-5 must still pass.

## 11. Out of scope
- Preemptive blocking (Phase 2).
- Unfriend / unblock.
- Online/offline presence broadcast (David — only expose `onlineAt` in profile).
- Frontend profile page (Epic 7).
- Friend count / mutual friends.
- Pagination on friends list.

## 12. Open items / hand-offs
- David: `onlineAt` is already updated by `RealtimeGateway.touchOnline()`. Jorge
  just exposes it in the profile response.
- Aloiki: `FilesService.createUpload` is called for avatar. The service returns a
  `File` row — Jorge stores the file ID or constructs a URL via `getSignedUrl`.
- Epic 7 (frontend): will consume `GET /users/:id`, `PATCH /users/me`,
  `PATCH /users/me/avatar`, friends endpoints.