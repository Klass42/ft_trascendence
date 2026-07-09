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

- **Rama:** `jorge` (tracking `origin/jorge`).
- **Última sincronización:** `jorge`, `staging` y `aloiki` idénticos en
  `eb53db12` (2026-07-09) tras merger de 10 commits de Aloiki (frontend shell +
  design system + courses/enrollments/sections/lessons + files/storage API).
- **Epica completada:** Epic 1 (Auth contracts + seed). 9 commits desde `eb53db12`.
  PR abierto a `staging`. Spec: `docs/superpowers/specs/2026-07-09-epic1-auth-contracts-seed-design.md`.
- **Siguiente:** Epic 2 spec (email/password auth). Escribir spec antes de tocar código.

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

### 3.1 Contratos que YO proveo (Epic 1 — desbloquean a todos)
| Contract | Archivo | Quién lo consume |
|---|---|---|
| `AuthUser` type (6 campos) | `common/auth/auth-user.type.ts` | Todo el backend + frontend (cambia la versión interna del backend) |
| `@CurrentUser()` | `common/auth/current-user.decorator.ts` | Aloiki (files/courses), David |
| `JwtAuthGuard` (inerte en Epic 1) | `common/auth/jwt-auth.guard.ts` | Endpoints protegidos Epic 2+ |
| `DevAuthGuard` (header `x-dev-user`) | `common/auth/dev-auth.guard.ts` | Todo endpoint mientras no exista login |
| `@Roles()` + `RolesGuard` | `common/auth/roles.*` | Endpoints admin Epic 5 |
| `prisma/seed.ts` (IDs estables) | `apps/backend/prisma/seed.ts` | Todos (datos demo) |

### 3.2 Contratos que YO consumo
- **Aloiki — `FilesService.createUpload(file, organizationId, uploaderId)`**
  (`apps/backend/src/files/files.service.ts:7`). Lo llamo en Epic 6 para
  `PATCH /users/me/avatar`. Devuelve un `File` row. Para avatar pasaré
  `uploaderId = user.id`.
- **David — `NotificationsService.emit(userId, type, payload)`** para avisar
  `FRIEND_REQUEST`. NO existe todavía (`notifications.module.ts` vacío).
  No-op seguro. Lo invoco en Epic 6 vía inyección opcional
  (inject con `@Optional()` y cheque `!= null`).

### 3.3 Deuda conocida (trackear para Epic 2)
- Los controladores de Aloiki (`courses.controller.ts`, `files.controller.ts`)
  leen `organizationId` de `@Query` en vez de `@CurrentUser()`. Cuando añada
  `APP_GUARD` global en Epic 2, hay que migrarlos (coordinar con Aloiki o
  plantear no usar `APP_GUARD` y seguir marcando cada controlador a mano).

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

### Bloque 2 — (futuro) Epic 2 Email/password auth
Espec pendiente de escribir. **Brainstorm obligatorio antes de code.**
Endpoints: `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me`.
Pre-requisito: migrar `courses.controller.ts` + `files.controller.ts` de `@Query(orgId)` a `@CurrentUser()` antes de activar `APP_GUARD` global.

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

1. ~~Commitear docs, ejecutar Bloque 1, PR a `staging`.~~ ✅ Hecho (PR #2).
2. **Esperar review/merge de PR #2** en `staging`.
3. **Brainstorm Epic 2** (email/password auth) — escribir spec antes de code:
   `docs/superpowers/specs/2026-07-XX-epic2-email-password-auth-design.md`.
4. Antes de activar `APP_GUARD` global: coordinar con Aloiki para migrar
   `courses.controller.ts` + `files.controller.ts` de `@Query(organizationId)` a `@CurrentUser()`.
5. Avisar a Aloiki/David cuando Epic 1 merge a `staging`: ya pueden usar
   `@UseGuards(DevAuthGuard)` + `@CurrentUser()` + `make db-seed`.