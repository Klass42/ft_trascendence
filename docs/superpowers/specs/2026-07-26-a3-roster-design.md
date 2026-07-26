# A3 — Roster / Inscripciones (Design Spec)

**Owner:** Jorge (@SrJorgeG) — Identity & Access, Tech Lead
**Branch:** `jorge` → `staging` → `master`
**Date:** 2026-07-26
**Status:** Draft
**Scope:** Épica A3 de `docs/planning/Jorge-2.md` (Plan 2, Fase A del rediseño LMS). Segunda de
las tres épicas restantes (A5 ✅ → A3 → A4-admin).

---

## 1. Purpose

Teachers and course staff need to see who is enrolled in their course, manage roles,
add new students, and remove students — the "roster" or "Alumnos" tab that every LMS has.
The backend already has all the endpoints; this epic wires them into the frontend and adds
one small lookup endpoint.

The page reuses the patterns from `OrgMembersPage` (Epic 7c): a data-driven `Table`,
role changes via `Select`, and double-press delete for expelling students.

---

## 2. Constraints (hard)

- **Do NOT touch the enrollments module** (`courses/enrollments`) — it's Aloiki's, still on
  the `@Query(organizationId, userId)` pattern (temporary, documented in David's D0). The
  frontend passes `organizationId` and `userId` as query params when calling enroll/expel.
- **Compose the Épica 0 design system** (`@/components/ui`): `Table`, `Modal`, `Select`,
  `Input`, `Button`, `Spinner`, `EmptyState`, `useToast()`, `ConfirmDialog`, `Badge`.
- **No new UI primitives** — all existing components suffice.
- **The lookup + batch endpoints are in Jorge's users module** — auto-contenido, sin
  dependencias. `GET /users/lookup?email=` (single, for the add modal) and
  `GET /users/by-ids?ids=` (batch, for the table — needed because enrollments.findAll
  doesn't include user data).
- **Spanish UI text** — matches existing pages.
- **No new dependencies** — React, react-router-dom, lucide-react, design system only.
- **Student view:** students should NOT see the "Alumnos" tab (they don't need a roster).

---

## 3. Design decisions (from brainstorm, 2026-07-26)

| Topic | Decision | Rationale |
|---|---|---|
| Tab navigation | Wrap `ContentEditor` + `RosterPage` in `<Tabs>` | Tabs component already exists; JSDoc even uses "Alumnos" as example |
| Tab visibility | Only for staff — **global TEACHER/ADMIN via `useIsTeacher()`** | Same gate as the page's existing staff features (ContentEditor). Course-level ASSISTANT gating out of scope |
| Add student | Modal with email search + preview + confirm | Clear UX, reuses Modal component. Inline row too cramped for email+result+action |
| Lookup endpoint | `GET /users/lookup?email=` in users module (Jorge's) | No external dependency. Org-scoped, roles TEACHER/ADMIN |
| Roster user data | **`GET /users/by-ids?ids=` batch endpoint (users module)** | `enrollments.findAll` returns NO user data (just userId) and can't be touched (Aloiki's module). Batch fetch avoids N+1. Staff context justifies email visibility (management view, like Moodle) |
| Teacher scope | Teacher cannot enroll ADMIN users | 403 if lookup returns an ADMIN; teachers manage only students/assistants |
| Bulk add | Out of scope (YAGNI) | Single-student add is the common case; CSV/email-list is Phase 2 |
| Progress column | **`enrollment.progress` (0-100) — viene gratis en cada fila de findAll** | El backend mantiene el porcentaje vía `recalculateProgress` (en enroll + cada lección completada). Sin endpoint extra, sin N+1 |
| Role change | Inline `<Select>` in table row | Same pattern as status changes; fires PATCH immediately |
| Expel | Double-press delete (5s window, same as OrgMembersPage) | Consistent with Epic 7b/7c; prevents accidental expulsion |

---

## 4. Architecture

```
CourseDetailPage (refactor)
  └─ <Tabs>
       ├─ Contenido → <ContentEditor ... />  (always visible)
       └─ Alumnos  → <RosterPage courseId={courseId} />  (staff only)

RosterPage
  ├─ useEnrollments(courseId)    GET /courses/:id/enrollments → [{id, userId, role, progress, ...}]
  │                                (enrollment.progress 0-100 ya viene en cada fila — lo mantiene
  │                                 el backend vía recalculateProgress; NO hace falta endpoint aparte)
  ├─ useUsersByIds(userIds)      GET /users/by-ids?ids=a,b,c (NEW, batch)
  ├─ useEnroll()                 POST /courses/:courseId/enroll?organizationId=X&userId=Y (exists)
  │
  ├─ Table (data-driven, merged by userId):
  │   └─ per row: [avatar+name, email, Select(rol), progress %, expel button]
  │
  ├─ Modal: "Añadir alumno"
  │    ├─ Input email + "Buscar" → GET /users/lookup?email=
  │    ├─ Result preview (avatar + name + email)
  │    └─ "Añadir al curso" button → POST enroll → toast + refresh
  │
  └─ States: loading, empty ("No hay alumnos inscritos"), error + retry

New backend (both in Jorge's users module):
  ┌─ GET /users/by-ids?ids=a,b,c  (@Roles TEACHER/ADMIN)
  │   └─ UsersService.findByIds(ids, organizationId)
  │       → [{ id, name, email, avatarUrl }]  (org-scoped, no passwordHash)
  └─ GET /users/lookup?email=      (@Roles TEACHER/ADMIN)
      └─ UsersService.lookupByEmail(email, organizationId, role)
          → { userId, name, email, avatarUrl } | 404 | 403
```

---

## 5. Backend design

### 5.1 `GET /users/by-ids?ids=id1,id2,id3` (new — batch fetch for the roster)

**Why it exists:** `enrollments.findAll` returns enrollment rows WITHOUT user data (no
`include: { user }`), and the enrollments module is off-limits (Aloiki's, temporary pattern).
Fetching each user individually (`GET /users/:id`) would be N requests AND hides `email` from
non-ADMIN callers (role-aware privacy from Epic 6). This batch endpoint solves both in one
call, in Jorge's domain. Returning `email` to course staff is deliberate: the roster is a
management view (teachers contact their students), same as Moodle.

`apps/backend/src/users/users.controller.ts`:

```ts
@Get('by-ids')
@UseGuards(RolesGuard)
@Roles('TEACHER', 'ADMIN')
async findByIds(@Query('ids') ids: string, @CurrentUser() user: AuthUser) {
  const idList = ids ? ids.split(',').map((s) => s.trim()).filter(Boolean) : [];
  return this.usersService.findByIds(idList, user.organizationId);
}
```

`apps/backend/src/users/users.service.ts`:

```ts
async findByIds(ids: string[], organizationId: string) {
  if (ids.length === 0) return [];
  return this.prisma.user.findMany({
    where: { id: { in: ids }, organizationId },   // org-scoped: cross-org ids silently dropped
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: { name: 'asc' },
  });
}
```

### 5.2 `GET /users/lookup?email=` (new — single lookup for the add modal)

No new schema models. No new Prisma queries beyond `findFirst`.

`apps/backend/src/users/users.controller.ts`:

```ts
@Get('lookup')
@UseGuards(RolesGuard)
@Roles('TEACHER', 'ADMIN')
async lookupByEmail(
  @Query('email') email: string,
  @CurrentUser() user: AuthUser,
) {
  return this.usersService.lookupByEmail(email, user.organizationId, user.role);
}
```

`apps/backend/src/users/users.service.ts`:

```ts
async lookupByEmail(email: string, organizationId: string, callerRole: GlobalRole) {
  const user = await this.prisma.user.findFirst({
    where: { organizationId, email },
    select: { id: true, name: true, email: true, avatarUrl: true, role: true },
  });
  if (!user) throw new NotFoundException('User not found');
  // TEACHER cannot look up ADMIN users
  if (callerRole === 'TEACHER' && user.role === 'ADMIN') {
    throw new ForbiddenException('Cannot look up admin users');
  }
  return { userId: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl };
}
```

No new DTO needed — `email`/`ids` are plain `@Query()` strings. The validation pipe
rejects non-string types.

### 5.3 Backend tests

In `apps/backend/src/users/__tests__/users.service.spec.ts`, new describes:

`findByIds`:
1. **Returns matching users org-scoped:** 3 ids, 2 in org → returns those 2 with
   `{id, name, email, avatarUrl}` and NO `passwordHash` in select.
2. **Empty ids → empty array** (no Prisma call).

`lookupByEmail`:
3. **Found (teacher):** returns `{ userId, name, email, avatarUrl }` with correct fields.
4. **Not found:** throws `NotFoundException`.
5. **Teacher looks up ADMIN:** throws `ForbiddenException`.

---

## 6. Frontend design

### 6.1 New hooks: `useEnrollments` + `useUsersByIds`

`apps/frontend/src/lib/api/hooks/useEnrollments.ts`:

```ts
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../client';
import { useAuth } from '../auth-context';
import type { EnrollmentDTO } from '../types';

interface UseEnrollmentsResult {
  data: EnrollmentDTO[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useEnrollments(courseId: string): UseEnrollmentsResult {
  const { user } = useAuth();
  const [data, setData] = useState<EnrollmentDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setIsLoading(true);
    // Enrollments module uses the temporary @Query pattern — pass org explicitly.
    apiClient
      .get<EnrollmentDTO[]>(
        `/courses/${courseId}/enrollments?organizationId=${user.organizationId}`,
      )
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e as Error); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [courseId, nonce, user]);

  return { data, isLoading, error, refetch };
}
```

`apps/frontend/src/lib/api/hooks/useUsersByIds.ts`:

```ts
import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import type { RosterUserDTO } from '@/features/courses/types';

interface UseUsersByIdsResult {
  data: RosterUserDTO[] | null;
  isLoading: boolean;
  error: Error | null;
}

/** Batch-fetch user display data for the roster. Empty ids → empty array, no request. */
export function useUsersByIds(ids: string[]): UseUsersByIdsResult {
  const [data, setData] = useState<RosterUserDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const key = ids.join(',');

  useEffect(() => {
    if (ids.length === 0) {
      setData([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    apiClient
      .get<RosterUserDTO[]>(`/users/by-ids?ids=${encodeURIComponent(key)}`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e as Error); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, isLoading, error };
}
```

Also barrel-export both in `hooks/index.ts` and `lib/api/index.ts`.

### 6.2 Types

`EnrollmentDTO` already exists in `lib/api/types/course.ts` (verify at implementation time —
the backend's `findAll` returns ALL enrollment fields without a select). Expected shape:

```ts
export interface EnrollmentDTO {
  id: string;
  userId: string;
  courseId: string;
  role: 'TEACHER' | 'ASSISTANT' | 'STUDENT';
  progress: number;         // 0-100, maintained by backend recalculateProgress
  createdAt: string;
}
```

New roster-specific type in `apps/frontend/src/features/courses/types.ts`:

```ts
/** Minimal user display data for the roster table (from GET /users/by-ids). */
export interface RosterUserDTO {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

/** Row model after merging enrollment + user data. */
export interface RosterRow {
  enrollmentId: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'TEACHER' | 'ASSISTANT' | 'STUDENT';
  progress: number; // 0-100 — comes from enrollment.progress directly
}
```

### 6.3 `CourseDetailPage` refactor — add Tabs

Current file renders `ContentEditor` directly. Replace the output section with:

```tsx
import { Tabs } from '@/components/ui';

// In the component body — the page already uses useIsTeacher() (global TEACHER/ADMIN)
// to gate its staff features (edit course, ContentEditor). The roster tab uses the
// SAME gate for consistency. Course-level ASSISTANT gating is out of scope (the page
// doesn't distinguish it today).
const tabs: TabItem[] = [
  { id: 'content', label: 'Contenido', content: <ContentEditor ... /> },
];
if (isTeacher) {
  tabs.push({ id: 'students', label: 'Alumnos', content: <RosterPage courseId={courseId!} /> });
}

// The ContentEditor was the main content; now it's wrapped in Tabs:
<Tabs tabs={tabs} />
```

### 6.4 `RosterPage` component (new)

`apps/frontend/src/features/courses/RosterPage.tsx` + `RosterPage.module.css`.

Props: `{ courseId: string }`.

**Data:** `useEnrollments(courseId)` → extract `userId`s → `useUsersByIds(userIds)` → merge by
`userId` → build `RosterRow[]`. Total **2 requests**, no N+1. `enrollment.progress` (0-100)
comes directly from the enrollment row — no progress endpoint needed.

**Table columns:**

| Column | Render | Notes |
|---|---|---|
| Alumno | Avatar circle + name | Reuse identity pattern from ProfilePage |
| Email | Plain text | From batch by-ids response |
| Rol | `<Select>` with STUDENT/ASSISTANT | Fires PATCH `/enrollments/:id/role?organizationId=X` on change, loading state while saving, toast on success/error |
| Progreso | `"75 %"` or mini bar | Direct from `enrollment.progress` (0-100) |
| Acción | Expulsar button (double-press) | Same pattern: first click shows "Confirmar expulsión" text, 5s countdown, then fires DELETE `/courses/:courseId/enroll?organizationId=X&userId=Y` |

**Add-student Modal (state-driven in RosterPage):**

```tsx
const [addOpen, setAddOpen] = useState(false);
const [searchEmail, setSearchEmail] = useState('');
const [lookupResult, setLookupResult] = useState<{userId: string; name: string; email: string; avatarUrl: string | null} | null>(null);
const [lookupLoading, setLookupLoading] = useState(false);
const [lookupError, setLookupError] = useState<string>();
const [enrolling, setEnrolling] = useState(false);
```

Flow:
1. Click "Añadir alumno" → Modal opens, email input focused.
2. Type email → "Buscar" → `GET /api/users/lookup?email=X` → show preview + "Añadir al curso".
3. "Añadir al curso" → `POST /courses/:courseId/enroll?organizationId=X&userId=Y` → toast + refresh enrollments + close modal.
4. Errors: 404 → inline message "No se encontró un usuario con ese email"; 409 → toast "Ya está inscrito"; 403 → toast (not enough perms).

**States:** loading (Spinner in the table area), empty (`EmptyState` with "No hay alumnos inscritos"), error (`EmptyState` with retry button), stale-while-refetch (non-blocking refetch via `refetch()`).

---

## 6. Testing & DoD

- **Backend tests:** 5 unit tests (`findByIds` ×2 + `lookupByEmail` ×3) in `users.service.spec.ts`.
- **Frontend E2E** `e2e/roster.spec.ts`:
  1. Staff views course → "Alumnos" tab visible → table shows enrolled students.
  2. Staff changes a student's role to ASSISTANT → table updates.
  3. Staff expels a student (double-press) → student disappears from table.
  4. Screenshot per flow.
- **DoD:** `pnpm -r run build` clean · backend `pnpm test` green · components from design system · responsive · estados vacío/carga/error · validación front+back · a11y · cero errores de consola · E2E verde.

---

## 7. Files touched

**Backend**
- `apps/backend/src/users/users.controller.ts` — add `GET /lookup` + `GET /by-ids` routes
- `apps/backend/src/users/users.service.ts` — add `lookupByEmail` + `findByIds` methods
- Test: `apps/backend/src/users/__tests__/users.service.spec.ts` — 5 new tests

**Frontend**
- `apps/frontend/src/lib/api/hooks/useEnrollments.ts` — **new**
- `apps/frontend/src/lib/api/hooks/useUsersByIds.ts` — **new**
- `apps/frontend/src/lib/api/hooks/index.ts` — barrels
- `apps/frontend/src/lib/api/index.ts` — barrels
- `apps/frontend/src/features/courses/types.ts` — **new**: `RosterUserDTO`, `RosterRow`
- `apps/frontend/src/features/courses/CourseDetailPage.tsx` — refactor: add `<Tabs>`, wrap ContentEditor, conditionally add "Alumnos" tab
- `apps/frontend/src/features/courses/RosterPage.tsx` — **new**
- `apps/frontend/src/features/courses/RosterPage.module.css` — **new**
- `apps/frontend/e2e/roster.spec.ts` — **new**
