# desarrollo_jorge.md — Bitácora de implementación (Jorge)

> **Archivo vivo.** Se actualiza por bloques al final de cada sesión de trabajo.
> Retomar en otra sesión: leer este archivo + `docs/superpowers/specs/` + `docs/planning/Jorge.md`.
> Fuente de verdad para convenciones: `../../AGENTS.md`.

---

## 0. Cómo retomar en otra sesión

1. `git checkout jorge && git pull --ff-only origin jorge` (rama personal).
2. Sincronizar con staging: `git merge --ff-only origin/staging` si staging va
   por delante.
3. Leer §1 (Estado) abajo para saber dónde quedó todo.
4. Leer la spec activa en `docs/superpowers/specs/`.
5. Continuar desde el último bloque de la §4 (Log de implementación).

Si un merge rompe algo, revisar §3 (Contratos que consumo) — el conflicto casi
siempre viene de un contrato de frontend/Aloiki que cambió.

---

## 1. Estado

- **Rama:** `jorge` (tracking `origin/jorge`). Sincronizada con `staging` en
  `4d526010` (2026-07-26, fast-forward) — trajo Fase A completa de Aloiki
  (A1/A2/StudentDashboard), David (D0, A7, A4-teacher, A6b presence, **B1 motor
  de actividades backend + B2a UI de autoría**) y mi propio Epic 7 mergeado.
- **Plan 1 (`Jorge.md`) COMPLETO:** Epics 1-7c shipped (backend auth/org/users/
  RBAC + frontend auth/admin/org). Epic 8 (2FA TOTP) es stretch, fuera de Fase A.
- **Plan 2 (`Jorge-2.md`, Fase A rediseño LMS):**
  - ✅ A6a (integrar frontend Org) — cerrada con el merge de Epic 7 a staging.
  - ✅ **A5 (Perfil y cuenta reales) — implementada** (Bloque 11). 13 commits, 269 tests, E2E verde.
  - ✅ **A3 (Roster) — implementada** (Bloque 12). 6 commits, 274 tests, E2E escrito (pendiente run).
  - ⬜ A4-admin (des-mockear AdminDashboard) — pendiente.
- **Estructura elegida:** 3 specs independientes (patrón Plan 1), orden A5 → A3 → A4-admin.
- **Epicas completadas:**
  - Epic 1 (Auth contracts + seed). 9 commits desde `eb53db12`.
    PR abierto a `staging`. Spec: `docs/superpowers/specs/2026-07-09-epic1-auth-contracts-seed-design.md`.
  - **Epic 2 (Email/password auth). 9 commits (`1d6b4537..df31d706`).**
    Spec: `docs/superpowers/specs/2026-07-10-epic2-email-password-auth-design.md`.
    Plan: `docs/superpowers/plans/2026-07-10-epic2-email-password-auth.md`.
  - **Epic 3 (Google OAuth). Merged to staging via PR #2.**
    Spec: `docs/superpowers/specs/2026-07-10-epic3-google-oauth-design.md`.
    Plan: `docs/superpowers/plans/2026-07-10-epic3-google-oauth.md`.
  - **Epic 4 (Organizations). 3 commits, 78 tests total.**
    Spec: `docs/superpowers/specs/2026-07-11-epic4-organizations-design.md`.
    Plan: `docs/superpowers/plans/2026-07-11-epic4-organizations.md`.
  - **Epic 5 (Admin User CRUD). 3 commits, 100 tests total.**
    Spec: `docs/superpowers/specs/2026-07-11-epic5-admin-user-crud-design.md`.
    Plan: `docs/superpowers/plans/2026-07-11-epic5-admin-user-crud.md`.
  - **Epic 6 (Users profile API + friends). 118 tests, 19 suites.**
    Spec: `docs/superpowers/specs/2026-07-11-epic6-profile-friends-design.md`.
    Plan: `docs/superpowers/plans/2026-07-11-epic6-profile-friends.md`.
  - **Epic 7a (Frontend auth pages). Merged to staging via PR.**
    Spec: `docs/superpowers/specs/2026-07-13-epic7a-frontend-auth-design.md`.
    Plan: `docs/superpowers/plans/2026-07-13-epic7a-frontend-auth.md`.
    Commits: `418c8bf8` (spec) + `716fdd66` (RegisterPage/VerifyEmailPage/OAuthCallbackPage).
- **Epic 7c completado (este sesión):**
  - Spec: `docs/superpowers/specs/2026-07-17-epic7c-org-pages-design.md` (commit `8c648acb`).
  - Plan: `docs/superpowers/plans/2026-07-17-epic7c-org-pages.md` (commit `84179f6d`).
  - Implementado: 5 commits (`113a22db..449bd850`).
  - Build `pnpm -r run build` limpio. API smoke: org info, 6 members, teacher RBAC 403.
- **Epic 7 completo:** Epics 7a (auth pages), 7b (admin users), 7c (org). Todo frontend de Jorge shipped.
- **Tests:** 274 tests backend (25 suites, 0 fallos) · E2E: profile 3/3 + roster pendiente de run.
- **AuthUser contrato:** 8 campos (`emailNotificationsEnabled` + `preferredLanguage` añadidos en A5).
- **Runtime:** `make up` ✅ · backend arranca limpio · auth operativo (login/register/change-password).
- **Siguiente:** A4-admin (des-mockear AdminDashboard) → luego PR a staging.

---

## 2. Contexto clave (lo que debes saber antes de tocar código)

### 2.1 Contrato `AuthUser` — 6 campos (NO 3)
El frontend ya depende de esta forma exacta en
`apps/frontend/src/lib/api/types.ts:10-19`:
```ts
type GlobalRole = 'ADMIN' | 'TEACHER' | 'STUDENT';
interface AuthUser {
  userId: string; email: string; name: string;
  avatarUrl: string | null; organizationId: string; role: GlobalRole;
}
```
Cualquier divergencia rompe el frontend ya mergeado. **Regla de oro: alinear
con el frontend siempre que no afecte funcionalidad** (frontend se hizo antes).

### 2.2 Endpoints que el frontend YA espera (Epic 2 debe satisfacerlos)
- `POST /auth/login` → `{ user: AuthUser; accessToken: string; refreshToken: string }`.
- `GET /auth/me` → `AuthUser` directo (no envuelto).
- `POST /auth/refresh` → `{ accessToken, refreshToken }`.
- Google: `window.location.href = '/api/auth/google'`; backend redirige de vuelta
  con tokens. (`auth-context.tsx:150-175`)

### 2.3 Header `x-dev-user` (el guard operativo de Epic 1)
El frontend lo manda automático si `VITE_DEV_USER_ID` está seteado
(`apps/frontend/src/lib/api/client.ts:227-240`, `token-storage.ts:83-120`).
Mientras `VITE_USE_MOCK_AUTH=true` el frontend usa un mock y no llama al
backend, pero en cuanto se apague, DevAuthGuard recibirá ese header. Estono
lo tocamos nosotros.

### 2.4 Prisma — el schema YA está completo
`apps/backend/prisma/schema.prisma` (385 líneas) ya define todo lo de Jorge:
- `Organization { id, name, slug @unique, logoUrl?, createdAt, updatedAt }`.
- `User { id, organizationId, email, passwordHash?, name, avatarUrl?, bio?,
  role: GlobalRole, onlineAt?, emailVerifiedAt?, ... @@unique([organizationId, email]) }`.
- `Session { id, userId, refreshTokenHash @unique, userAgent?, expiresAt, createdAt }`.
- `OAuthAccount { provider, providerUserId, @@unique([provider, providerUserId]) }`.
- `Friendship { requesterId, addresseeId, status: FriendStatus, @@unique([requesterId, addresseeId]) }`.
- Enums: `GlobalRole {ADMIN,TEACHER,STUDENT}`, `CourseRole {TEACHER,ASSISTANT,STUDENT}`,
  `FriendStatus {PENDING,ACCEPTED,BLOCKED}`, `NotificationType {…,FRIEND_REQUEST,…}`.

**No tocar el schema en Epic 1.** El trabajo de Jorge es la capa Nest + seed.

### 2.5 Faltan por instalar (deps backend)
`argon2`, `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`,
`@types/passport-jwt` (dev), `ts-node` (dev). Hoy NO hay ningún hashing ni JWT
ni passport en `apps/backend/package.json`.

### 2.6 Convenciones obligatorias
- `main.ts` línea 1: `import './telemetry/otel-sdk';` — NO TOCAR.
- `PrismaModule` ya es `@Global`; `ConfigModule.forRoot({ isGlobal: true })` ya
  está en `app.module.ts`.
- `ValidationPipe` global con `whitelist + forbidNonWhitelisted + transform`.
- Casing: `@Controller('plural')`, DTOs en `dto/`, barrel `index.ts`. Cabeceras
  de módulo con `// Owner: Jorge (@SrJorgeG) ...` (estilo `auth.module.ts`).
- Comentarios en inglés (igual al resto del repo); mensajes de commit pueden ir
  en español.
- `BigInt.toJSON` parche ya en `main.ts:10-12` — no re-añadir.

### 2.7 Makefile
`make db-generate | db-push | db-migrate (NAME=) | db-studio` ya existen.**No
existe `make db-seed`** — Epic 1 lo añade. Define `PRISMA := pnpm --filter
@ft-trascendence/backend exec prisma` (Makefile:63).

---

## 3. Contratos que cruzo con el equipo

### 3.1 Contratos que YO proveo (Epic 1 + Epic 2 — desbloquean a todos)
| Contract | Archivo | Quién lo consume |
|---|---|---|
| `AuthUser` type (6 campos) | `common/auth/auth-user.type.ts` | Todo el backend + frontend (cambia la versión interna del backend) |
| `@CurrentUser()` | `common/auth/current-user.decorator.ts` | Aloiki (files/courses), David |
| `JwtAuthGuard` | `common/auth/jwt-auth.guard.ts` | AppAuthGuard (inyectado) |
| `DevAuthGuard` (header `x-dev-user`) | `common/auth/dev-auth.guard.ts` | AppAuthGuard (fallback en dev) |
| `AppAuthGuard` (composite, APP_GUARD global) | `common/auth/app-auth.guard.ts` | Todos los endpoints (guard por defecto) |
| `@Public()` | `common/auth/public.decorator.ts` | Endpoints sin auth (login, register, refresh, verify-email) |
| `@Roles()` + `RolesGuard` | `common/auth/roles.*` | Endpoints admin Epic 5 |
| `prisma/seed.ts` (IDs estables) | `apps/backend/prisma/seed.ts` | Todos (datos demo) |
| `POST /auth/login\|register\|refresh\|logout`, `GET /auth/me\|verify-email` | `auth/auth.controller.ts` | Frontend (auth-context.tsx) |

### 3.2 Contratos que YO consumo
- **Aloiki — `FilesService.createUpload(file, organizationId, uploaderId)`**
  (`apps/backend/src/files/files.service.ts:7`). Lo llamo en Epic 6 para
  `PATCH /users/me/avatar`. Devuelve un `File` row. Para avatar pasaré
  `uploaderId = user.id`.
- **David — `NotificationsService.emit(userId, type, payload)`** para avisar
  `FRIEND_REQUEST`. NO existe todavía (`notifications.module.ts` vacío).
  No-op seguro. Lo invoco en Epic 6 vía inyección opcional
  (inject con `@Optional()` y cheque `!= null`).

### 3.3 Deuda conocida (actualizada tras Epic 2)
- ~~Los controladores de Aloiki (`courses.controller.ts`, `files.controller.ts`)
  leen `organizationId` de `@Query` en vez de `@CurrentUser()`.~~ ✅ Migrados en
  Epic 2 (commit `ed30e367`). Con permiso de Aloiki para modificar en la rama `jorge`.
- `GET /files/:id/url` y `DELETE /files/:id` ahora requieren autenticación (APP_GUARD)
  pero **no filtran por `organizationId`** — cualquiera autenticado puede ver/borrar
  cualquier file. Scoping por org es un seguimiento de seguridad pendiente.
- `IsEmail({ require_tld: false })` en los DTOs para aceptar emails del seed (`student@demo`).
  Cuando el seed use emails reales, se puede quitar la opción.

---

## 4. Log de implementación (bitácora por bloques)

> Formato por bloque: fecha · qué se creó/modificó · commit hash · propósito.

### Bloque 0 — 2026-07-09 — Brainstorm + spec
- ✅ `docs/superpowers/specs/2026-07-09-epic1-auth-contracts-seed-design.md` (spec aprobada de Epic 1).
- ✅ `docs/planning/desarrollo_jorge.md` (este archivo).
- ✅ `docs/planning/Jorge.md` Epic 1 — `AuthUser` 3→6 campos, alineado con el frontend. Aclarado `GET /auth/me` y respuesta de `login`.
- ✅ Merges previos: `staging` y `jorge` traídos a `eb53db12` (Aloiki).
- ✅ Committed en `e4142030` junto con deps y jest config (Bloque 1).

### Bloque 1 — 2026-07-09 — Epic 1 implementado ✅
- ✅ `e4142030` — deps + jest config + docs brainstorm (argon2, @nestjs/jwt, @nestjs/passport, passport, passport-jwt, jest 30, ts-jest, @nestjs/testing, supertest, ts-node)
- ✅ `83f78746` — `AuthUser` type (6 campos, alineado con frontend) + `@CurrentUser()` decorator + barrel progresivo
- ✅ `ece550c6` — `@Roles()` decorator + `RolesGuard` (Reflector.getAllAndOverride, 403 on role-mismatch, 401 on missing user)
- ✅ `95680cb6` — `JwtStrategy` + `JwtAuthGuard` (passport-jwt, inerte hasta Epic 2, getOrThrow fail-fast)
- ✅ `c6806499` — `DevAuthGuard` (x-dev-user header, carga user de Prisma, bloqueado en producción, 403 via return false)
- ✅ `a6028463` — `@Global CommonModule` (JwtModule.registerAsync, providers: RolesGuard+DevAuthGuard+JwtStrategy, exports: guards+JwtModule) wired into AppModule
- ✅ `c8e000d6` — `prisma/seed.ts` (IDs estables, argon2.hash, GlobalRole/CourseStatus/CourseRole enum members, upsert idempotente, emailVerifiedAt set, output VITE_DEV_USER_ID)
- ✅ `831f3e24` — `make db-seed` Makefile target
- ✅ `3ea12013` — `docker-compose.dev.yml`: JWT_ACCESS_SECRET + JWT_REFRESH_SECRET (dev-only placeholders — Ale: revisar antes de staging/prod)

**Tests:** 13 unit tests en 4 suites (current-user, roles.guard, jwt.strategy, dev-auth.guard). 0 fallos.
**Runtime smoke:** `make up` ✅ backend arranca limpio · `make db-seed` ✅ 8 filas con hashes `$argon2id$v=` · `/health` 200 · x-dev-user header aceptado · 13 unit tests pasando post-compose.

**Estado actual del §1:** Epic 1 en `jorge`, PR a `staging` creado/pendiente. Siguiente: Epic 2 spec (email/password auth: POST /auth/login, /register, /refresh, /logout, GET /auth/me).
- [ ] Commit + push `jorge`; avisar al equipo en el canal.

### Bloque 2 — 2026-07-10 — Epic 2 implementado ✅
- ✅ Brainstorm + spec aprobada: `docs/superpowers/specs/2026-07-10-epic2-email-password-auth-design.md`
- ✅ Plan: `docs/superpowers/plans/2026-07-10-epic2-email-password-auth.md`
- ✅ `1d6b4537` — `@Public()` decorator + RegisterDto, LoginDto, RefreshDto (class-validator)
- ✅ `ed30e367` — Migración `courses.controller.ts` + `files.controller.ts` de `@Query/@Body` a `@CurrentUser()` (con permiso de Aloiki). `CreateFileDto` eliminado.
- ✅ `907bd7a5` — `AppAuthGuard` (composite: JWT → DevAuthGuard fallback en non-prod) + wired en `CommonModule`
- ✅ `cc1fc4fa` — `AuthService.register()` + `login()` con argon2, JWT, Session CRUD (8 tests)
- ✅ `c22d6842` — `APP_GUARD` global registrado en `app.module.ts`
- ✅ `d7ef5f8b` — `AuthService.refresh()` (single-use + reuse detection: revoca todas las sesiones), `logout()`, `getMe()`, `verifyEmail()` (9 tests)
- ✅ `e6d5f969` — `AuthController` con 6 endpoints + wired en `AuthModule`
- ✅ `a3ae61de` — E2E tests: login OK/fail, me con/sin token, register validation (5 tests). Fix bug: `JwtAuthGuard` no estaba en providers de `CommonModule` — arreglado.
- ✅ `df31d706` — Fix `IsEmail({ require_tld: false })` para aceptar emails del seed (`@demo`)

**Tests finales:** 40 tests, 7 suites, 0 fallos.
**Runtime smoke:** `make up` ✅ backend arranca limpio con todas las rutas mapeadas · `POST /auth/login` con `student@demo`/`demo1234` → `{ user(AuthUser 6), accessToken, refreshToken }` ✅ · `GET /auth/me` con Bearer → AuthUser ✅ · `GET /courses` sin token → 401 (APP_GUARD) ✅ · `GET /courses` con x-dev-user → 200 (dev fallback) ✅.

**Estado actual del §1:** Epic 2 completo en `jorge`, pushed. Siguiente: PR a `staging` o Epic 3 (Google OAuth).
- [ ] PR de Epic 2 a `staging`.
- [ ] Avisar a equipo: APP_GUARD global activo, `@Public()` para endpoints públicos, `@CurrentUser()` sin `@UseGuards()`.
- [ ] Coordinar con Aloiki: `VITE_USE_MOCK_AUTH=false` para usar login real.

### Bloque 3 — 2026-07-10 — Epic 3 Google OAuth implementado ✅
- ✅ Brainstorm: 3 preguntas aclaratorias (redirect hash fragment / auto-create / auto-vincular email match) → todas A/B/A.
- ✅ Spec: `docs/superpowers/specs/2026-07-10-epic3-google-oauth-design.md`
- ✅ Plan: `docs/superpowers/plans/2026-07-10-epic3-google-oauth.md` (5 tasks)
- ✅ `e48b25a4` — Deps: `passport-google-oauth20` + `@types/passport-google-oauth20`, env: `FRONTEND_URL` + `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` en compose y `.env.example`
- ✅ `(commit merge)` — `GoogleStrategy` (passport-google-oauth20) + 2 tests + wired en `CommonModule`
- ✅ `c71cca40` — `AuthService.googleLogin()` (auto-create + auto-vincular por email match) + 3 tests
- ✅ `cd6ca1a2` — `AuthController`: `GET /auth/google` + `GET /auth/google/callback` con redirect hash fragment `#accessToken=...&refreshToken=...`
- ✅ `a286b839` — Fix compose: añadir `GOOGLE_CLIENT_*` al backend service
- ✅ `f2df7249` — Fix `GoogleStrategy`: usar `config.get()` con fallback en vez de `getOrThrow()` (app bootea sin Google creds)

**Tests finales:** 45 tests, 8 suites, 0 fallos.
**Runtime smoke:** `make up` ✅ backend arranca limpio · `/auth/google` y `/auth/google/callback` mapeados ✅ · login email/password sigue funcionando ✅ · Google redirect funciona con creds reales (requiere `GOOGLE_CLIENT_ID`/`SECRET` válidos; en dev sin creds → placeholder, no crashea).

**Estado actual del §1:** Epics 1+2+3 completos en `jorge`, pushed. Total: 45 tests, 8 suites.

### Bloque 4 — 2026-07-11 — Epic 5 Admin User CRUD implementado ✅
[...]
**Estado actual del §1:** Epics 1+2+3+4+5 completos en `jorge`, pushed. Total: 100 tests, 18 suites.
- [ ] PR a `staging` con Epics 1-5.

### Bloque 5 — 2026-07-11 — Epic 6 Profile + Friends implementado ✅
- ✅ Brainstorm: 3 preguntas → C/A/A (role-aware GET / A avatar / A block). Spec + plan escritos.
- ✅ Spec: `docs/superpowers/specs/2026-07-11-epic6-profile-friends-design.md`
- ✅ Plan: `docs/superpowers/plans/2026-07-11-epic6-profile-friends.md`
- ✅ `38b62fa1` — DTOs: `UpdateProfileDto` (name/bio) + `UpdateFriendshipDto` (status)
- ✅ `a184cef` — `UsersService`: findOne role-aware + updateProfile + sendFriendRequest + listFriends + 9 tests
- ✅ `(commit)` — `FriendshipsService` (accept/block transitions) + 5 tests
- ✅ `9929e09e` — `UsersController`: role-aware GET /:id + PATCH /me + /me/avatar + POST /:id/friend + GET /me/friends. `FriendshipsController`: PATCH /friendships/:id. `FilesModule` exports `FilesService`. `UsersModule` imports `FilesModule`.

**Tests finales:** 118 tests, 19 suites, 0 fallos.
**Runtime smoke:** `GET /users/:id` → public profile (sin email) ✅ · admin profile (con email) ✅ · `PATCH /users/me` → bio ✅ · `POST /users/:id/friend` → 201 ✅.

**Estado actual del §1:** Epics 1-6 completos en `jorge`, pushed. Total: 118 tests, 19 suites.
- [ ] PR a `staging` con Epics 4-6.
- [ ] Epic 7 (frontend auth/admin/org pages) — última epica de Jorge.

### Bloque 6 — 2026-07-13 — Epic 7a Frontend auth pages implementado ✅
- ✅ Brainstorm + spec: `docs/superpowers/specs/2026-07-13-epic7a-frontend-auth-design.md` (3 preguntas A/B/C: register page dedicated / OAuth callback dedicated route / verify-email included / mock auth flipped off).
- ✅ Plan: `docs/superpowers/plans/2026-07-13-epic7a-frontend-auth.md` (7 tasks).
- ✅ `418c8bf8` — spec commit.
- ✅ `716fdd66` — `RegisterPage` + `VerifyEmailPage` + `OAuthCallbackPage` (hash fragment), `register` method in `AuthProvider`, lazy routes `/register` / `/verify-email` / `/auth/callback`, `VITE_USE_MOCK_AUTH=false` in `.env.development`.
- ✅ Merged to staging via PR (merge commit `785b7909` "Merge jorge into staging: Epics 4-7a").

**Tests:** sin tests de frontend (no hay infra). Smoke manual documentado en spec §10.
**Runtime smoke:** `/login` → `/register` link funciona (no 404) ✅ · `/auth/callback#accessToken=...&refreshToken=...` parsea y redirige a dashboard ✅ · `student@demo`/`demo1234` con `VITE_USE_MOCK_AUTH=false` login real ✅.

### Bloque 7 — 2026-07-17 — Epic 7b brainstorm + spec (en curso)
- ✅ Sync `jorge` ← `origin/staging` (fast-forward a `94fbf924`): trae infra simplificada de Ale (Caddy, `docker-compose.yml` renombrado, prisma migrations, tini pinned) + fix de `NotificationsService` para persistir friend-request notifications.
- ✅ Consulta engram (`engram_query_graph` con query `frontend admin users organization ProtectedRoute roles AdminAppLayout pattern`): confirma que `ProtectedRoute` ya soporta `roles`, `useIsAdmin/useHasRole/useIsTeacher` existen, `useCourses` es el patrón establecido, `AppLayout` usa flags `staffOnly`/`student`/`teacher` en `NAV_ITEMS`. Spec alineada con el grafo.
- ✅ Brainstorming skill: 7 preguntas clarificadoras una a una →
  1. Alcance Epic 7 restante → **solo 7b admin primero** (7c org separado).
  2. Acciones admin a cubrir → **CRUD completo** (list + create + edit + delete).
  3. UX editar usuario → **página dedicada `/admin/users/:id`** (no modal, no inline).
  4. Confirmar borrado → **doble pulsación en ventana de 5s** (no window.confirm, no Modal nueva).
  5. Layout lista → **tabla HTML `<table>` estilizada** (no cards, no flex rows).
  6. Nav item → **"Usuarios" → `/admin/users`** con flag `adminOnly: true` nuevo.
  7. Editar tu propio usuario → **deshabilitar campos out-of-bounds inline** (dropdown rol disabled + botón eliminar oculto).
- ✅ Propuesta de enfoque A (hook `useUsers`/`useUser` para fetch, mutaciones inline en pages, `UserForm` internal compartido) vs B (hook por acción, YAGNI) vs C (fetch inline sin hooks, duplica lógica). Elegido **A**.
- ✅ Diseño presentado en 18 secciones, aprobado por el usuario con la nota "cuando toque implementar para y te cambio el modelo".
- ✅ Spec escrita y commiteada: `docs/superpowers/specs/2026-07-17-epic7b-admin-pages-design.md` (commit `52e4b1e8`, 546 líneas).
- ✅ Auto-revisión de spec: typo "Subtitle苞btener" en §10 corregido, fila de tabla "|-any endpoint" → "| 401 on any endpoint" en §15, ambigüedad de back-link en edit page resuelta (añadido link "← Volver a usuarios" en §11).

### Bloque 8 — 2026-07-17 — Epic 7b implementación ✅
- ✅ `executing-plans` skill, 8 tareas. Verified on branch `jorge`.
- ✅ `316aa36b` — Task 1: `types.ts` (UserDTO + CreateUserInput + UpdateUserInput) + `useUsers.ts` (useUsers/useUser hooks, mirror useCourses) + barrel export in `hooks/index.ts`.
- ✅ `66a01b08` — Task 2: `UserForm.tsx` + `UserForm.module.css` (controlled form, per-field validation, ApiError mapping `status===409` email, isSelf disable role select, diffForPatch export). Fix: `ApiError.isConflict` doesn't exist → used `status === 409`.
- ✅ `e9fa48f3` — Task 3: `AdminUsersPage.tsx` + `.module.css` (HTML table, responsive, loading/error/empty states, Nuevo/Editar buttons).
- ✅ `852661c8` — Task 4: `AdminUserCreatePage.tsx` (UserForm mode=create, POST /users, navigate back).
- ✅ `bbee1c36` — Task 5: `AdminUserEditPage.tsx` + `.module.css` (UserForm mode=edit with diff, useUser load, delete double-press 5s window, isSelf hides delete + disables role). Fix: TS narrowing in async closure → captured `userData = data` const.
- ✅ `2318388f` — Task 6: `index.ts` barrel for `features/admin`.
- ✅ `3bb2f179` — Task 7: `routes.tsx` (3 lazy admin routes nested under `ProtectedRoute roles={['ADMIN']}` + `OutLet`) + `AppLayout.tsx` (NavItem interface replacing `as const`, `Users` icon, `adminOnly: true` guard).
- ✅ `41aec251` — fix: `tsconfig.build.json` excludes spec/test files so Docker `nest build` doesn't fail on `socket.io-client` import in David's realtime gateway spec.
- ✅ API-level smoke: health `/` ✅ · admin login `admin@demo`/`demo1234` → token ✅ · teacher login `teacher@demo` → token ✅ · admin `GET /users` → 6 users ✅ · teacher `GET /users` → 403 ✅ · admin `POST /users` → 201 create ✅ · admin `DELETE /users/:id` → 204 ✅.
- ⬜ Browser smoke manual (needs Chrome): 18 checks from plan Task 8 Step 4 (sidebar visibility / RBAC gate / table render / create / edit / delete double-press / self-edit guard / 404 / responsive / console warnings).

**Próximo paso:** smoke browser manual → `finishing-a-development-branch` → Epic 7c (features/org/) después.

### Bloque 9 — 2026-07-17 — Epic 7c implementación ✅
- ✅ `executing-plans` skill, 6 tareas. Verified on branch `jorge`.
- ✅ `8c648acb` — Spec escrita: `docs/superpowers/specs/2026-07-17-epic7c-org-pages-design.md`.
- ✅ `84179f6d` — Plan escrito: `docs/superpowers/plans/2026-07-17-epic7c-org-pages.md`.
- ✅ `113a22db` — Task 1: `types.ts` (OrgDTO + MemberDTO) + `useOrganization.ts` (useOrg/useOrgMembers hooks, mirror useUsers) + barrel export in hooks/index.ts.
- ✅ `1b51363d` — Task 2: `OrgSettingsPage.tsx` + `.module.css` (read-only card for all, ADMIN clicks 'Editar' → inline form with name + logoUrl Input, PATCH /organizations/:id, 'Miembros' button navigate → /org/members).
- ✅ `9471191b` — Task 3: `OrgMembersPage.tsx` + `.module.css` (ADMIN-only, HTML table, delete button double-press 5s in row, self row shows dash, local deletedIds filter after 204).
- ✅ `3df3be1d` — Task 4: `index.ts` barrel for features/org.
- ✅ `449bd850` — Task 5: routes.tsx (2 lazy routes: /org index → OrgSettingsPage, /org/members ProtectedRoute ADMIN → OrgMembersPage) + AppLayout.tsx (Building2 icon, 'Organización' nav item visible to all).
- ✅ API-level smoke: `GET /organizations/me` → 200 (Klass Academy, slug klass) ✅ · admin `GET /organizations/:id/members` → 6 members ✅ · teacher `GET members` → 403 ✅.
- ⬜ Browser smoke manual (needs Chrome): 20 checks from plan Task 6 Step 4.

**Estado actual:** Epic 7 completo. Total Jorge: Epics 1-7c (backend auth/org/users/RBAC + frontend auth/admin/org). 5 commits Epic 7c hoy. Branch `jorge` pushed.

**Próximo paso:** smoke browser manual final → `finishing-a-development-branch` para PR a `staging`.

### Bloque 10 — 2026-07-26 — Plan 2 arranque: sync + brainstorm + spec A5
- ✅ Merge `staging` → `jorge` (fast-forward `ee821f44..4d526010`, 133 ficheros): Fase A de
  Aloiki completa (A1 autoría cursos, A2 ContentBuilder, StudentDashboard), David (D0, A7,
  A4-teacher, A6b presence, **B1 motor actividades + B2a UI autoría**), y confirmación de que mi
  Epic 7 (admin + org pages) ya está en staging → **A6a cerrada**.
- ✅ Auditoría de Plan 1 (`Jorge.md`): todo hecho (Epics 4-6 estaban marcados "pending" en el
  doc pero implementados; Epic 8 2FA = stretch, fuera de Fase A). → Toca Plan 2 (`Jorge-2.md`).
- ✅ Auditoría de Plan 2: pendientes **A3** (roster — no hay pestaña "Alumnos"), **A5** (perfil:
  toggles falsos, avatar no persiste, no hay change-password), **A4-admin** (AdminDashboard
  100% mock).
- ✅ Contexto guardado en engram (grafo de conocimiento): estado del Plan 2 + decisiones A5/A3.
- ✅ Brainstorming skill (4 preguntas): alcance = Plan 2 con **3 specs independientes**, orden
  **A5 → A3 → A4-admin**. Decisiones A5: prefs REALES (`emailNotificationsEnabled` +
  `preferredLanguage` en User), schema vía **`db push`** (reconciliación de migraciones = tarea
  aparte con Ale), change-password **revoca todas las sesiones** y fuerza re-login, error de
  contraseña actual = **400 (no 401)** por el interceptor de refresh del api-client, 2FA =
  Badge "Próximamente", avatar se persiste vía `PATCH /users/me {avatarUrl}` tras FileUpload.
  Decisión A3 (adelantada): lookup por email = nuevo `GET /users/lookup?email=` en mi módulo
  users (org-scoped, TEACHER/ADMIN).
- ✅ Spec escrita: `docs/superpowers/specs/2026-07-26-a5-profile-account-design.md`.
  Auto-revisión: añadida nota de race condition en el E2E (dev-user-id vs redirect a /login).
- ✅ Spec aprobada por el usuario.
- ✅ Plan escrito: `docs/superpowers/plans/2026-07-26-a5-profile-account.md` (12 tareas, TDD,
  commits por tarea). Self-review: capturados 2 fallos antes de ejecutar — (1) `lib/api/index.ts`
  re-exporta hooks POR NOMBRE (hay que tocar 2 barrels), (2) `React.ChangeEvent` → import
  `type ChangeEvent` de react. Detectado también en Task 2: 3 specs con literales de AuthUser
  de 6 campos (auth.service, jwt.strategy, dev-auth.guard) que hay que actualizar.
- ⬜ Ejecución del plan (el usuario elige subagent-driven vs inline; posible PAUSE para cambio
  de modelo).
- ✅ **A5 implementada completo — Bloque 11 (subagent-driven, tareas 1-12).**
  Ver abajo §4 para el log detallado.

**Próximo paso:** A5 completa. Siguiente: **A3 — Roster** (pestaña "Alumnos" en curso).
brainstorm → spec → plan → implementación.

### Bloque 11 — 2026-07-26 — A5 implementación completa (subagent-driven) ✅

Implementado vía `subagent-driven-development` skill con 12 tareas. Cada tarea pasó por
implementador → spec compliance review → code quality review antes de pasar a la siguiente.
Se usaron 3 agentes por tarea (~36 invocaciones totales).

| Task | Commit | Descripción |
|------|--------|-------------|
| 1 | `a88989be` | Schema: `emailNotificationsEnabled` + `preferredLanguage` en User, db push |
| 2 | `7b33dc81` | AuthUser 6→8 campos (3 sitios prod + 6 specs). tsc cazó 3 extras |
| 2 fix | `3771b16d` | JSDoc DevAuthGuard (6→8) |
| 2 fix | `c7dca177` | Precisión JSDoc AuthUser |
| 3 | `9410b862` | `ChangePasswordDto` + `AuthService.changePassword` (TDD, 6 tests) |
| 4 | `9094204d` | Ruta `POST /auth/change-password` en controllador |
| 5 | `32a580d1` | `UpdateProfileDto` + `selectOwnProfile` (TDD, 4 tests) |
| 5 fix | `479aff96` | Fix assertion obsoleta en test updateProfile |
| 6 | `c32dc330` | Frontend AuthUser 8 campos + MOCK_USER |
| 7 | `8cef2715` | Toggle accesible (`role=switch`) en design system |
| 8 | `32a3d40c` | Hooks `useUpdateProfile` + `useChangePassword` (+ barrels dobles) |
| 9 | `18a47f7a` | ProfilePage real (3 Cards: Identidad, Seguridad, Preferencias) |
| 11 | (*pendiente*) | E2E `profile.spec.ts` (se commitea con este bloque) |

**Números:** 13 commits de código (269 tests backend, 0 fallos) · 3 tests E2E (pasados contra
backend dev + frontend dev + postgres de docker). Cobertura E2E: nombre persiste · prefs
(email + idioma) persisten · change-password revoca sesiones (old refresh 401, old login 401,
new login 200/201) + toast y redirect a /login en UI.

**Decisiones de implementación capturadas en self-review:**
- `lib/api/index.ts` re-exporta hooks POR NOMBRE → los hooks nuevos se añaden en DOS barrels
- Login de NestJS sin `@HttpCode` devuelve 201 (no 200) — E2E usa `ok()`
- E2E de contraseña no puede probar UI de login con dev activo (VITE_DEV_USER_ID env) → API
  assertion en vez de UI
- tsc cazó 3 literales AuthUser extra no listados en el plan (auth.e2e.spec.ts,
  organizations.controller.spec.ts, current-user.decorator.spec.ts)
- Docker compose Caddy no arranca por conflicto puerto 9090 (Prometheus) — smoke se hizo
  con backend dev local contra postgres del compose

**Siguiente:** A3 — Roster (pestaña "Alumnos" en curso).

---

## 5. Decisiones de diseño (resumen — ver spec para detalle)

1. **AuthUser = 6 campos** igualando el frontend (`apps/frontend/src/lib/api/types.ts:10-19`); el `Jorge.md` original decía 3 — actualizado.
2. **Dos guards separados** (`JwtAuthGuard` + `DevAuthGuard`), no un guard con fallback. Matchea la redacción de `Jorge.md` y es más explícito.
3. **`DevAuthGuard` bloquea en producción** (`NODE_ENV === 'production'` → 403) — sin bypass en deploy graded.
4. **`JwtAuthGuard` inerte pero completo** en Epic 1 (nadie emite tokens todavía); en Epic 2 se activa sin tocar el guard.
5. **No `APP_GUARD` global** en Epic 1 (rompería `courses`/`files` de Aloiki que leen `@Query(organizationId)`). Se añade en Epic 2 tras migrar esos controladores.
6. **`CommonModule` es `@Global`** para que los guards/decoradores sean inyectables/importables sin re-importar en cada feature module.
7. **`argon2` se instala en Epic 1** aunque el login sea Epic 2 — el seed necesita hashear `demo1234` (gate mandatory "hashed+salted").
8. **IDs estables** en el seed (`org-klass-0001`, `user-admin-0001`…) con `upsert` por `id` → idempotente y `VITE_DEV_USER_ID` fijo/compartible. Org alineada con el mock del frontend.
9. **`emailVerifiedAt = new Date()`** en los 3 seed users — skip del flow de verif en dev.
10. **El frontend NO se toca** en Epic 1; se notifica a Aloiki qué setear en `apps/frontend/.env.development` (su archivo).

---

## 6. Próximos pasos (inmediatos)

1. ~~Plan 1 (Epics 1-7c)~~ ✅ Completo y mergeado a `staging`.
2. ~~**A5 — Perfil y cuenta reales:** spec → plan → implementación.~~ ✅ Completa. 13 commits, 269 tests backend, 3 E2E verdes.
3. **A3 — Roster:** pestaña "Alumnos" en curso (staff). Pendiente de brainstoming + spec.
4. **A4-admin — Des-mockear AdminDashboard:** backend datos reales, UI reescrita (design system).
5. **Deuda conjunta con Ale:** reconciliar historia de migraciones Prisma (drift
   `migrations/_init` vs `db push`; lo dejó David anotado en D0).
6. Seguimiento de seguridad: scope `GET /files/:id/url` y `DELETE /files/:id` por
   `organizationId`. Rate-limiting en auth endpoints (login/change-password).