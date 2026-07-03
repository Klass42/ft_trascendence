# Aloiki (@illia) — Content & UX

> **Your file.** Working brief. Read `../../AGENTS.md` for shared conventions and `./README.md`
> for the methodology. Work on branch **`aloiki`** (based on `main`); merge to `staging` before
> `main`.

**Theme:** the product surface (frontend shell + design system) and the learning content
(courses, lessons, files). You own the frontend foundation everyone plugs into.

**Prisma models you own:** `Course`, `Section`, `Lesson`, `LessonAttachment`, `LessonCompletion`,
`Enrollment`, `File`.

**Directories you own:**
`apps/backend/src/{courses,files}` (courses contains `sections/`, `lessons/`, `enrollments/`;
files contains `storage/`) · `apps/frontend/src/app/` (shell/router/layout) ·
`apps/frontend/src/components/ui/` (design system) · `apps/frontend/src/lib/api/` (API client) ·
`apps/frontend/src/features/{courses,profile}`.

**Contracts YOU provide (Week 1, unblock everyone — do these first):**
- Frontend shell: router, protected-route wrapper, app layout, and `lib/api/client.ts`
  (fetch wrapper with auth token + error handling) + 4 base UI components. → unblocks all frontend.
- `FilesService.createUpload(file, {ownerId, orgId})` / `getSignedUrl(fileId)` — the storage
  contract David (submissions) and Jorge (avatars) call. → unblocks uploads.

**Contracts you consume:** Jorge's `@CurrentUser()`/`JwtAuthGuard` (protect your routes) + seed;
Ale's Garage bucket (storage backend — use local-disk driver until it's up).

---

## Epic 1 — Frontend shell + design system (Week 1, TOP PRIORITY, unblocks all frontend)

- [ ] `apps/frontend/src/lib/api/client.ts` — typed fetch wrapper hitting `/api`, attaches access
      token, refreshes on 401, normalizes errors.
- [ ] `apps/frontend/src/app/` — router (`react-router`), `AppLayout` (sidebar + navbar),
      `ProtectedRoute` (redirects to `/login` using Jorge's `/auth/me`), a lazy route registry so
      teammates add routes without touching a central switch.
- [ ] `apps/frontend/src/components/ui/` — design tokens (`tokens.css`: colors, typography,
      spacing) + `Button`, `Input`, `Card`, `Spinner`. (Grow to 10+ in Epic 7.)
- [ ] Role-aware dashboard shell (`features/dashboard/`) with slots each person fills.
- [ ] Document the component API in `components/ui/README.md`.

## Epic 2 — Storage service + Files API (Week 1, unblocks uploads)

- [ ] `apps/backend/src/files/storage/storage.service.ts` — interface `putObject`, `getSignedUrl`,
      `deleteObject`. Two drivers: `S3StorageDriver` (Garage/MinIO via `@aws-sdk/client-s3`) and
      `LocalStorageDriver` (dev fallback to `./uploads`). Pick via `S3_ENDPOINT` presence.
- [ ] `apps/backend/src/files/files.service.ts` — `createUpload()` (validate type/size, put object,
      insert `File` row), `getSignedUrl()`, `delete()`.
- [ ] `apps/backend/src/files/files.controller.ts` — `POST /files` (multipart, **server-side
      validation**), `GET /files/:id/url`, `DELETE /files/:id`. Org-scoped.
- [ ] `apps/frontend/src/components/ui/FileUpload.tsx` — drag-drop, **client-side validation**
      (type/size), progress bar, preview, delete. (module: File upload ✓)

## Epic 3 — Courses API + UI

- [ ] `apps/backend/src/courses/` — module/controller/service + `dto/{create,update}-course.dto.ts`.
- [ ] `GET/POST/PATCH/DELETE /courses` (org-scoped), `status` DRAFT/PUBLISHED/ARCHIVED, `accessCode`.
- [ ] `apps/frontend/src/features/courses/` — course list (filter/search), course detail,
      course editor (owner/teacher only).

## Epic 4 — Sections + Lessons

- [ ] `apps/backend/src/courses/sections/` — CRUD + ordering (`PATCH /courses/:id/sections/reorder`).
- [ ] `apps/backend/src/courses/lessons/` — CRUD, `contentMd`, `videoUrl`, attachments via Files.
- [ ] Frontend: section/lesson editor inside the course editor; lesson viewer (render markdown +
      video + attachment list).

## Epic 5 — Enrollment + progress

- [ ] `apps/backend/src/courses/enrollments/` — `POST /courses/:id/enroll` (public / by `accessCode`),
      `GET /users/me/courses`, `role` per course.
- [ ] Progress: `POST /lessons/:id/complete` → upsert `LessonCompletion`, recompute
      `Enrollment.progress` %. `GET /courses/:id/progress`.
- [ ] Frontend: enroll button/flow, progress bar on course cards + lesson checkmarks.

## Epic 6 — Profile UI (consumes Jorge's users API)

- [ ] `apps/frontend/src/features/profile/` — view/edit profile, **avatar upload** (uses your
      `FileUpload` + Jorge's `PATCH /users/me/avatar`), friends list + online status.

## Epic 7 — Design system depth + polish (Week 3)

- [ ] Grow `components/ui` to **10+ documented reusable components** (Button, Input, Card, Modal,
      Toast, Tabs, Table, Avatar, Badge, Dropdown, Spinner…). (module: Custom design system, stretch)
- [ ] Responsive + a11y pass (labels, focus, keyboard) across your screens; zero console warnings.
- [ ] Optional i18n scaffolding (`i18n/`, ES/EN/PT) if time — Minor stretch.

## Module points you carry
File upload (1) · Standard user mgmt — profile/avatar UI (part of 2) · framework front (part of 2) ·
Custom design system (1, stretch) · i18n (1, stretch).

## Reminders
- Every course/lesson/file query is **org-scoped** (filter by `organizationId`, directly or via
  the course). Files are **references** — bytes go to storage, only the `File` row in Postgres.
- **Validate uploads on both client and server** — mandatory.
- Keep design tokens centralized; no hard-coded colors per screen.
- Don't touch `infra/` — if you need a Garage bucket or an env var, ask Ale.
