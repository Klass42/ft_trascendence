# David (@dacs-dev) — Interaction

> **Your file.** Working brief. Read `../../AGENTS.md` for shared conventions and `./README.md`
> for the methodology. Work on branch **`david`** (based on `main`); merge to `staging` before
> `main`.
>
> Note: DevOps/infra is now **Ale's** job. You are a full-stack app developer — you no longer own
> Docker/CI/monitoring. Focus on the interaction features below.

**Theme:** how users interact around the content — assignments & grading, forums, and everything
real-time (notifications, live updates, presence).

**Prisma models you own:** `Assignment`, `Submission`, `SubmissionFile`, `ForumThread`,
`ForumPost`, `Notification`.

**Directories you own:**
`apps/backend/src/{assignments,forums,notifications,realtime}` (submissions live inside
`assignments/`) · `apps/frontend/src/features/{gradebook,forums,notifications}`.

**Contracts YOU provide (Week 1, unblock everyone — do these first):**
- `NotificationsService.emit(userId, type, payload)` + persistence — everyone calls this to notify.
- `RealtimeGateway` (Socket.io) with JWT handshake — pushes notifications/live events. `emit()`
  no-ops safely if the gateway isn't connected, so callers never block.

**Contracts you consume:** Jorge's `@CurrentUser()`/`JwtAuthGuard` + seed; Aloiki's `FilesService`
(submission files); Jorge's `Course`/`Enrollment` (assignments belong to a course).

---

## Epic 1 — Notifications + real-time gateway (Week 1, TOP PRIORITY, unblocks all)

- [ ] `apps/backend/src/notifications/` — module/service/controller. `emit(userId, type, payload)`
      inserts a `Notification` and pushes it over the socket if the user is connected.
- [ ] `GET /notifications` (mine, paginated), `PATCH /notifications/:id/read`,
      `POST /notifications/read-all`.
- [ ] `apps/backend/src/realtime/realtime.gateway.ts` — Socket.io gateway, **JWT handshake auth**
      (reuse Jorge's token verification), per-user rooms, graceful connect/disconnect.
- [ ] Presence: on connect/disconnect update `User.onlineAt`; broadcast presence to friends.
- [ ] Publish the `emit()` signature + notification `type` enum in this file so others can call it.

## Epic 2 — Assignments + submissions

- [ ] `apps/backend/src/assignments/` — module/controller/service + `dto/`.
- [ ] `GET/POST/PATCH/DELETE /courses/:courseId/assignments` (teacher), `dueAt`, `maxScore`.
- [ ] Submissions (in `assignments/submissions/`): `POST /assignments/:id/submissions` (text +
      files via Aloiki's `FilesService`), one per `(assignment,user)`, status DRAFT/SUBMITTED/LATE.
- [ ] `GET /assignments/:id/submissions` (teacher), `GET /assignments/:id/submissions/me` (student).
- [ ] On submit → `emit()` a `NEW_ASSIGNMENT`/deadline notification appropriately.

## Epic 3 — Grading + gradebook (evaluations)

- [ ] `PATCH /submissions/:id/grade` — `score` + `feedback` + `gradedBy`, status GRADED; `emit()`
      a `GRADE_PUBLISHED` notification.
- [ ] `GET /courses/:id/gradebook` — matrix of students × assignments with scores.
- [ ] `GET /courses/:id/gradebook.csv` — **CSV export**.
- [ ] Frontend `features/gradebook/`: gradebook table (teacher), grading panel, student "my grades".

## Epic 4 — Forums

- [ ] `apps/backend/src/forums/` — threads + posts + nested replies + pin.
- [ ] `GET/POST /courses/:id/forum/threads`, `GET/POST /threads/:id/posts`, `PATCH /threads/:id/pin`,
      `GET /courses/:id/forum/search?q=` (search within a course).
- [ ] On new thread/reply → `emit()` a `FORUM_REPLY` notification to relevant users.
- [ ] Frontend `features/forums/`: thread list, thread view with replies, new-post form, search.

## Epic 5 — Live updates + notification center UI (module: real-time ✓, notifications ✓)

- [ ] `apps/frontend/src/features/notifications/` — a socket client hook, notification center
      dropdown + navbar unread badge, toast on new notification.
- [ ] Live updates: new grade appears without refresh; new forum reply appears live; friend
      online/offline reflected. **Handle reconnect gracefully.**

## Epic 6 — Stretch: analytics dashboard (Major, 2) — only after 14 solid
- [ ] `features/analytics/` + backend aggregates: interactive charts (submissions over time, grade
      distribution), date filters, CSV/PDF export.

## Module points you carry
Real-time WebSockets (2) · Notification system (1) · Standard user mgmt — presence (part of 2) ·
framework back (part of 2) · Analytics dashboard (2, stretch).

## Reminders
- Assignments/forums/notifications are **org-scoped via their course/user** — filter by
  `organizationId`.
- Real-time must **handle connect/disconnect gracefully** and broadcast efficiently (module req).
- Submission files go through Aloiki's `FilesService` — don't write your own storage.
- You don't own infra anymore: need a queue, a port, an env var, or a socket-friendly proxy config?
  **Ask Ale.**
