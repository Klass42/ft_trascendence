# Aloiki (@illia) — Content & UX

**Theme:** the *product surface* and the *learning content*. You build the frontend foundation
everyone else plugs into, plus the course/content/file backend.

**42 module points you own (~3, plus you enable the Web framework Major on the frontend):**
Web: File upload & management (1) · User Mgmt: Standard user management — profile/avatar (2, shared
with dacs on friends/presence). You also make the **Custom design system** minor claimable (10+
reusable components) as a stretch.

> Sprint 0 already created empty `CoursesModule` and `FilesModule` (registered in
> `app.module.ts`). Put sections/lessons/enrollments inside `courses/` and the StorageService
> inside `files/` — no need to touch `app.module.ts`.

**You own these directories:**
`apps/backend/src/{courses,files}` (+ sub-resources: sections/lessons/enrollments, storage) ·
`apps/frontend/src/app/` (shell, router, layout) · `apps/frontend/src/components/ui/` (design
system) · `apps/frontend/src/features/{courses,profile}`.

---

## Week 1 — Frontend shell + Storage + Courses API

- [ ] **(Day 1–2, unblocks everyone)** Frontend shell: router, protected-route guard, app layout
      (sidebar/navbar), API client (`/api` fetch wrapper with auth token handling), 3 base
      design-system components (Button, Input, Card) with a color palette + typography.
- [ ] **(Day 1–2)** `StorageService` (Garage/S3): `putObject`, `getObject`, `presignGet` — start
      against a Garage container (coordinate the compose service with dacs) or MinIO locally.
      Returns/consumes `File` rows. Unblocks avatars + submissions.
- [ ] Courses API: `GET/POST/PATCH/DELETE /courses` (org-scoped), `status` draft/published.
- [ ] Sections + Lessons API (CRUD, ordering).

## Week 2 — Enrollment, content viewer, file upload, profile

- [ ] Enrollment API: enroll (public / by `accessCode`), list my courses, `role` per course.
- [ ] Progress tracking: `LessonCompletion`, compute `Enrollment.progress` %.
- [ ] **File upload module** (mandatory-flavored): multi-type upload, **client + server validation**
      (type/size), progress indicator, file preview where possible, delete. Wire `LessonAttachment`.
      (module: File upload ✓)
- [ ] Frontend: course list + course detail, course editor (sections/lessons), lesson viewer
      (markdown + video + attachments), enrollment flow, upload component with progress bar.
- [ ] Profile page: view/edit profile, **avatar upload** (uses your StorageService). (part of User
      Mgmt Standard ✓ — friends/online status come from dacs' realtime.)

## Week 3 — Design system, responsive, polish

- [ ] Grow `components/ui/` to **10+ documented reusable components** (design-system minor stretch).
- [ ] Responsive pass (mobile) across all your screens; zero console warnings.
- [ ] Empty/loading/error states; accessibility basics (labels, focus, keyboard).
- [ ] Help other tracks skin their screens with the design system for a consistent UI.
- [ ] README "Features List" contributions for content/courses.

## You depend on / you unblock

- **Unblock:** everyone's frontend (shell + design system) and everyone's files (StorageService).
- **Depend on:** SrJorgeG's auth (User/session, auth token) for protected routes + course ownership.
- **Coordinate:** `schema.prisma` changes go through Jorge; Garage/MinIO compose service with dacs;
  `app.module.ts` registration.

## Reminders

- Every course/lesson/file query is **org-scoped** — filter by `organizationId` (via the course).
- **Validate uploads on both client and server** (mandatory). Reject by type/size before storing.
- Files are **references** — store bytes in Garage/S3, only the `File` row in Postgres.
- English identifiers; keep the design system tokens centralized (no hard-coded colors per screen).
