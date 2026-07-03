# ft_trascendence — MVP Master Plan

Full plan for the MVP phase. This is the **combined plan**; each person also has a deep,
task-level brief:

- [`Jorge.md`](./Jorge.md) — **Jorge** (`@SrJorgeG`) · Identity & Access · branch `jorge`
- [`Aloiki.md`](./Aloiki.md) — **Aloiki** (`@illia`) · Content & UX · branch `aloiki`
- [`David.md`](./David.md) — **David** (`@dacs-dev`) · Interaction · branch `david`
- [`Ale.md`](./Ale.md) — **Ale Pinto** · DevOps / Infra · branch `ale`

Product context: [`../../AGENTS.md`](../../AGENTS.md) (conventions) · [`../../MVP_DESIGN.md`](../../MVP_DESIGN.md).
Target: **14 module points** (planned ~16). Subject: `en.subject.pdf` (v21.1, free-choice).

---

## 1. Team & split

| Person | Handle | Role | Owns (code) |
|---|---|---|---|
| **Jorge** | `@SrJorgeG` | Tech Lead · Identity & Access | `auth`, `users`, `organizations`, `common/auth`, `prisma` (steward) + their frontend |
| **Aloiki** | `@illia` | Content & UX (frontend-lead) | frontend shell + design system, `courses`, `files`/storage + their frontend |
| **David** | `@dacs-dev` | Interaction | `assignments`, `forums`, `notifications`, `realtime` + their frontend |
| **Ale Pinto** | *(handle TBD)* | DevOps / Infra | `infra/**`, `.github/**`, `scripts/**`, `Makefile`, `flake.nix`, Dockerfiles, deploy, monitoring |

**The 3 developers (Jorge, Aloiki, David) write the application. Ale owns everything DevOps** —
Docker, HTTPS/proxy, S3/Garage, CI/CD, observability, deployment, backups. No app dev touches
`infra/`, `.github/`, `scripts/`, `Makefile` or `flake.nix` — open an issue/ask Ale instead.

## 2. Branching methodology

```
master ──────────────●───────────────●─────────►   (trunk = GitHub default; only via staging)
                     ▲               ▲
staging ──●──●──●────┴────●──●──●─────┴──────────►   (integration + testing before master)
          ▲  ▲            ▲
jorge ────┘  │            │   (personal branches, based on master)
aloiki ──────┘            │
david ───────────────────┘
ale ─────────────────────┘
```

Rules:
- **Everyone has a personal branch off `master`**: `jorge`, `aloiki`, `david`, `ale`.
- You may create sub-branches per task (`jorge/auth-jwt`) or commit straight to your branch —
  your call.
- **Nothing goes straight to `master`.** Flow is always **personal → `staging` → `master`**.
- `staging` is where branches integrate and get tested together. Merge your branch into `staging`
  (PR), verify the combined app works, then `staging → master` via PR (reviewed).
- Keep your branch synced: regularly merge `master` into your branch to avoid drift.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`.

> Recommended: an admin protects `master` and `staging` (require CI green + 1 review before merge).

## 3. Anti-blocking design — contracts delivered first

The plan is built so **no one's task blocks another's**. The trick: every shared capability is
delivered **Week 1 as a stable interface (with a stub/fallback)**, so consumers build against the
contract, not the full implementation.

| Contract | Provider | Consumers | Fallback so consumers never block |
|---|---|---|---|
| **Auth**: `@CurrentUser()`, `JwtAuthGuard`, `@Roles()`+`RolesGuard`, `AuthUser` type | Jorge (`common/auth/`) | everyone | `DevAuthGuard` reads `x-dev-user` header from the seed until real JWT lands |
| **DB seed**: 1 org + admin/teacher/student + sample course | Jorge (`prisma/seed.ts`) | everyone | run `make db-seed`; work with real rows immediately |
| **Storage**: `FilesService.createUpload()` / `getSignedUrl()` | Aloiki (`files/`) | David (submissions), Jorge (avatars) | local-disk driver in dev until Ale's Garage bucket is up |
| **Frontend shell + API client + UI kit** | Aloiki (`app/`, `lib/api`, `components/ui`) | everyone (frontend) | components land Week 1; others add their routes lazily |
| **Notifications**: `NotificationsService.emit(userId,type,payload)` + socket gateway | David (`notifications/`, `realtime/`) | everyone | `emit()` is a no-op if the gateway isn't running; nothing breaks |
| **Reverse proxy + Garage + CI** | Ale | everyone | app runs on direct ports without the proxy in dev |

**Rule of thumb:** if you need something another person owns, you code against its **interface**
(documented in their brief) and use the fallback until their real version merges to `staging`.

## 4. Module points (target 14, planned ~16)

| Module | Type | Pts | Owner |
|---|---|---|---|
| Web: framework front **and** back | Major | 2 | shared (Aloiki FE + Jorge/David BE) |
| Web: real-time (WebSockets) | Major | 2 | David |
| Web: notification system | Minor | 1 | David |
| Web: ORM | Minor | 1 | Jorge |
| Web: file upload & management | Minor | 1 | Aloiki |
| User Mgmt: Standard (profile/avatar/friends/status) | Major | 2 | Jorge (API) + Aloiki (UI) + David (presence) |
| User Mgmt: Organization system | Major | 2 | Jorge |
| User Mgmt: Advanced permissions (RBAC) | Major | 2 | Jorge |
| User Mgmt: OAuth 2.0 | Minor | 1 | Jorge |
| DevOps: Monitoring (Prometheus+Grafana) | Major | 2 | Ale |
| **Core total** | | **16** | |

Stretch/bonus (only after 14 is solid): custom design system (Aloiki, 1) · i18n (Aloiki, 1) ·
analytics dashboard (David, 2) · AI Tutor RAG/LLM (2 each) · public API w/ rate-limit (David+Ale, 2).

## 5. Timeline (3 weeks, parallel tracks)

- **Week 1 — Contracts + your backend.** Everyone ships their Week-1 contract (above) first, then
  builds their own domain's API. By end of week: seed works, shell renders, each API has CRUD.
- **Week 2 — Wire frontend + integrate on `staging`.** Connect UIs to APIs; first full flows
  (teacher creates course → student enrolls → submits → graded → notified). Daily `staging` merges.
- **Week 3 — Polish + mandatory gates + demo.** Multi-user testing, Privacy/ToS (Ale), a11y/responsive,
  zero console errors, README (roles + module justification), demo env (Ale).

## 6. Definition of Done (per task)

Works in Chrome with **no console errors** · validation **front + back** · reachable only by the
right role and **scoped by `organizationId`** · happy-path test · responsive · reviewed by ≥1
teammate · comes up clean under `make up`. (Full detail in `AGENTS.md` §8.)

## 7. Mandatory gates (subject — rejection if missing)

`docker compose up` single command (Ale) · HTTPS everywhere (Ale) · multi-user, no races (all) ·
email+password hashed+salted (Jorge) · Privacy Policy + ToS pages (Ale builds route, Aloiki styles) ·
validation front+back (all) · `.env`/`.env.example` (done) · README w/ team roles + modules (all).
