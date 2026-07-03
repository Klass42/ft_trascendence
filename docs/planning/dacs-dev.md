# dacs-dev — Ops & Interaction

**Theme:** the platform runs, is secure and observable (**DevOps**), and users *interact* around
the content (evaluations, forums, real-time). You already built the infra/observability — now
harden it and own the interactive features.

**42 module points you own (~5):** DevOps: Monitoring Prometheus+Grafana (2, mostly done) ·
Web: real-time WebSockets (2) · Web: notification system (1). You keep the "single command" +
HTTPS mandatory gates green.

> Sprint 0 already created empty `AssignmentsModule`, `ForumsModule`, `NotificationsModule`,
> `RealtimeModule` (registered in `app.module.ts`). Put submissions/grading inside `assignments/`.

**You own these directories:**
`apps/backend/src/{assignments,forums,notifications,realtime}` (+ submissions inside assignments) ·
`apps/frontend/src/features/{gradebook,forums,notifications}` · **all of** `infra/**`,
`.github/**`, `scripts/**`, `Makefile`, `flake.nix`.

---

## Week 1 — Fix the platform gates + real-time skeleton

- [x] **(Day 1, unblocks CI)** ~~Create `scripts/ci.sh`~~ ✅ **done** — infra linters + build +
      prisma validate (blocking), semgrep/trivy (informational). `make ci` and the Action pass.
      Follow-up: add a shared ESLint flat config so CI also lints (build is the only code gate now).
- [ ] **(Day 1–2)** Add **Caddy** (or nginx-TLS) reverse proxy in front of frontend+backend so all
      external traffic is **HTTPS** (mandatory). Route `/` → frontend, `/api` → backend.
- [ ] **(Day 1–2)** Add the **Garage** (S3) service to `docker-compose.dev.yml` (coordinate with
      illia's StorageService: bucket, keys → `.env.dev`).
- [ ] **Socket.io gateway** skeleton in `realtime/` with JWT handshake auth (reuses Jorge's JWT).
      Unblocks notifications + presence.

## Week 2 — Evaluations, forums, notifications, real-time

- [ ] **Evaluations**: Assignments API (CRUD, due dates), Submissions API (text + files via illia's
      upload), grading (`score`/`feedback`/`gradedBy`), gradebook per course, **CSV export**.
- [ ] **Forums**: threads + posts + nested replies + pin, plus search within a course forum.
- [ ] **Notification system** (module ✓): persist `Notification` for create/update/delete events
      (new assignment, grade published, forum reply, enrollment, deadline); mark read/unread.
- [ ] **Real-time** (module ✓): push notifications over Socket.io; live updates (new grade, new
      forum reply); **presence / online status** (updates `User.onlineAt`) + friends
      accept/online — the social half of User Mgmt Standard (illia owns profile/avatar).
- [ ] Frontend: gradebook table + grading UI, submission UI (upload + text), forum UI (threads +
      replies), notification center + navbar badge.

## Week 3 — Security, monitoring polish, deploy, legal pages

- [ ] Security hardening: rate limiting, CORS, security headers (helmet), input sanitization —
      pair with Jorge on the auth surface.
- [ ] **Privacy Policy + Terms of Service** pages with real content + footer links (mandatory —
      project rejected if missing/placeholder).
- [ ] Grafana dashboards + alert rules polished; verify traces/logs/metrics flow end-to-end.
- [ ] Clean `docker compose up` from zero on a fresh machine (the graded path); deploy/demo env.
- [ ] Multi-user concurrency testing (no races/data corruption) with the team.
- [ ] README "Project Management" + "Instructions" (run steps, prerequisites) sections.

## You depend on / you unblock

- **Unblock:** everyone (green CI, HTTPS, Garage) and all real-time consumers (gateway, notifications).
- **Depend on:** SrJorgeG's JWT (socket auth) + User/course models; illia's upload for submission files.
- **Coordinate:** `app.module.ts` registration; Garage service + `.env` keys with illia.

## Reminders

- Real-time must **handle connect/disconnect gracefully** and broadcast efficiently (module req).
- Evaluations/forums are **org-scoped via their course** — filter by `organizationId`.
- Keep the dev stack single-command; don't let k8s manifests become the required path.
- English identifiers; schema changes go through Jorge (steward).
