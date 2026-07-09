# David — Plan de ejecución por sesiones

> Complemento operativo de [`David.md`](./David.md). Divide tu trabajo en **sesiones de Claude
> auto-contenidas**, reordenadas para **empezar por lo que NO depende del auth de Jorge** (que aún
> no existe). Cada epic trae un *prompt listo para pegar*. Lánzalos **en orden**, revisa entre medias,
> mergea a `staging` cuando el epic pase su DoD.

## Estado del que partimos (2026-07-09)

- Tu rama `david` está sincronizada con `staging` (todo el trabajo de Aloiki: shell frontend, design
  system, API client + hooks, y backend de courses/lessons/sections/enrollments + `FilesService`).
- **El schema Prisma ya está completo** — todos tus modelos (`Assignment`, `Submission`,
  `SubmissionFile`, `ForumThread`, `ForumPost`, `Notification`) y enums ya existen. **No toques el
  schema** salvo que un epic lo pida explícitamente (coordina con Jorge, es el steward de `prisma/`).
- Hay un **seed mínimo** en `apps/backend/prisma/seed.ts` (org `org-klass-0001`, usuarios
  `user-lucia-001`/`user-diego-001`/`user-admin-001`, curso `course-web-101`, 1 assignment). Los IDs
  coinciden con el mock user del frontend → la UI funciona end-to-end con `VITE_USE_MOCK_AUTH=true`.
  Ejecútalo: `make db-push` (o `db-migrate`) y luego `pnpm --filter backend exec prisma db seed`.

## ⚠️ Bloqueado por auth (Jorge) — DIFERIDO, no lo construyas aún

Jorge no ha entregado `common/auth` (`JwtAuthGuard`, `@CurrentUser()`, `@Roles()`/`RolesGuard`) ni el
seed canónico con passwords hasheados. **Decisión tomada:** documentar y aplazar; construir primero lo
independiente de auth. Cuando Jorge entregue el contrato, haremos **una pasada de refactor** para:

- [ ] Sustituir la lectura temporal de identidad (`@Headers('x-dev-user')`) por `@CurrentUser()`.
- [ ] Añadir `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` a los endpoints de profesor/admin.
- [ ] **Realtime gateway**: reemplazar el *dev handshake* por verificación real del JWT en el
      `handshake.auth.token` (ver Epic E).
- [ ] **Presence a amigos**: depende de `Friendship` (Jorge). Emitir online/offline solo a amigos.
- [ ] Endurecer el scoping: hoy derivamos `organizationId` del usuario/curso; con auth vendrá del token.

**Convención temporal de identidad (hasta que llegue el auth):**
> En cada controller tuyo, lee el usuario que actúa con `@Headers('x-dev-user') actingUserId: string`
> (el frontend ya envía esa cabecera). Deriva su `organizationId` cargando el `User` de la BD — **no
> confíes en un `organizationId` que venga del cliente en escrituras**. Para recursos de curso, deriva
> el org del `Course`. Marca cada punto con `// TODO(auth): reemplazar por @CurrentUser() (Jorge)`.

## Convenciones a respetar (imita `courses/`)

- Estructura NestJS por módulo: `xxx.module.ts` + `xxx.controller.ts` + `xxx.service.ts` + `dto/`.
  Mantén sub-recursos **dentro** de la carpeta del módulo (no toques `app.module.ts` salvo registrar
  el módulo, que ya está registrado).
- **Toda query tenant-scoped filtra por `organizationId`** (directo o vía el `Course` padre). Un
  filtro que falta = bug de seguridad, no un detalle de estilo.
- **Validación en front y back** (obligatorio): DTOs con `class-validator` en el back; validación en
  el form del front.
- Frontend: features en `apps/frontend/src/features/<x>/`, usa el `apiClient` (`lib/api`), el UI kit
  (`components/ui`) y crea hooks en `lib/api/hooks/` al estilo `useCourses.ts`.
- Commits convencionales (`feat:`, `fix:`, `test:`, `docs:`). Trabaja en `david`, mergea a `staging`.

## DoD por epic (recordatorio)

Funciona en Chrome **sin errores de consola** · validación front+back · alcanzable solo por el rol
correcto y **scoped por `organizationId`** · un test de happy-path · responsive · revisado por ≥1
compañero · levanta limpio con `make up`.

---

# Orden de sesiones

`A → B → C → D → E`. A desbloquea el resto (todos llaman a `emit()`). B–D son independientes entre sí
una vez A está; puedes reordenarlos. E es el módulo grande (real-time, 2 pts) y cierra el bucle visual.

| Sesión | Epic | Módulos que suma | Depende de |
|---|---|---|---|
| **A** | Notifications service + persistencia + CRUD | Notification system (1) *(parcial)* | seed |
| **B** | Assignments + submissions (back + UI) | parte de framework back | A (emit) |
| **C** | Grading + gradebook + CSV (back + UI) | evaluación | B |
| **D** | Forums (back + UI) | parte de framework back | A (emit) |
| **E** | Realtime gateway + centro de notificaciones + live updates | Real-time WebSockets (2), Notification (1) | A, B, C, D |
| *(stretch)* | Analytics dashboard | Analytics (2) | tras 14 pts sólidos |

---

## Sesión A — Notifications: service + persistencia + CRUD

**Objetivo:** entregar el contrato `NotificationsService.emit(userId, type, payload)` que todos los
demás epics usan, más los endpoints para leer/marcar notificaciones. Sin sockets todavía (Epic E los
enchufa); `emit()` solo persiste por ahora.

**Backend** (`apps/backend/src/notifications/`):
- `notifications.service.ts`: `emit(userId, type: NotificationType, { title, body?, link? })` → inserta
  `Notification`. Deja un punto de extensión (`// realtime hook (Epic E)`) donde luego se empujará por
  socket. Métodos: `listMine(userId, { page, pageSize })`, `markRead(id, userId)`, `markAllRead(userId)`.
- `notifications.controller.ts`: `GET /notifications` (mías, paginado), `PATCH /notifications/:id/read`,
  `POST /notifications/read-all`. Identidad temporal vía `@Headers('x-dev-user')`.
- Registra service/controller en `notifications.module.ts` y **exporta `NotificationsService`** para
  que Assignments/Forums lo inyecten.

**Frontend:** de momento nada nuevo (la `NotificationsPage` stub existe; se conecta en Epic E).

**DoD:** puedo crear notificaciones por código y `GET /notifications` las devuelve paginadas y
scoped al usuario; marcar leída funciona; test happy-path del service.

<details><summary>📋 Prompt listo para pegar</summary>

```
Trabaja en la rama `david`. Implementa el Epic A del plan en docs/planning/David-sessions.md:
el módulo de notificaciones (backend only).

Contexto: schema Prisma ya tiene el modelo Notification y el enum NotificationType. No hay auth aún
(lee el docs/planning/David-sessions.md sección "Convención temporal de identidad"). Imita el estilo
del módulo courses/ (controller+service+dto, class-validator).

Entrega en apps/backend/src/notifications/:
1. notifications.service.ts con:
   - emit(userId, type, { title, body?, link? }): crea un Notification. Deja un comentario
     "// TODO(Epic E): push por socket" donde luego se emitirá por realtime.
   - listMine(userId, { page=1, pageSize=20 }): paginado, orden desc por createdAt, solo del userId.
   - markRead(id, userId) y markAllRead(userId): solo afectan a notificaciones de ese userId.
2. notifications.controller.ts: GET /notifications (paginado), PATCH /notifications/:id/read,
   POST /notifications/read-all. Lee la identidad con @Headers('x-dev-user') actingUserId y marca cada
   uso con "// TODO(auth): @CurrentUser() (Jorge)".
3. notifications.module.ts: registra controller+service y EXPORTA NotificationsService.
4. Un test happy-path del service (emit + listMine).

Valida inputs (paginación). Cumple la DoD del plan. No toques el schema ni app.module.ts (ya registra
NotificationsModule). Al acabar, dime cómo probarlo y qué endpoints expones.
```
</details>

---

## Sesión B — Assignments + submissions

**Objetivo:** CRUD de tareas (profesor) y entregas (alumno, con ficheros vía `FilesService`).

**Backend** (`apps/backend/src/assignments/`, submissions en `assignments/submissions/`):
- Assignments (profesor del curso): `GET/POST/PATCH/DELETE /courses/:courseId/assignments`, con
  `title`, `description?`, `dueAt?`, `maxScore`. Org = la del `Course`.
- Submissions: `POST /assignments/:id/submissions` (texto + ficheros vía `FilesService.createUpload`),
  **una por `(assignment,user)`** (upsert), estado `DRAFT/SUBMITTED/LATE` (LATE si `dueAt` pasó).
  `GET /assignments/:id/submissions` (profesor), `GET /assignments/:id/submissions/me` (alumno).
- Al enviar (SUBMITTED) → `emit()` a los profesores del curso (`NEW_ASSIGNMENT`).

**Frontend** (`features/assignments/`): reemplaza el stub con datos reales. Lista de assignments del
curso, vista de detalle, form de entrega con `FileUpload` (ya existe en `components/ui`). Hooks nuevos
en `lib/api/hooks/`.

**DoD:** profesor crea tarea, alumno entrega con fichero, no se puede entregar dos veces, LATE se marca
solo, sin errores de consola.

<details><summary>📋 Prompt listo para pegar</summary>

```
Trabaja en la rama `david`. Implementa el Epic B del plan en docs/planning/David-sessions.md:
assignments + submissions (backend + frontend).

Contexto: modelos Assignment/Submission/SubmissionFile ya existen en el schema. Reutiliza el
FilesService de Aloiki (apps/backend/src/files/files.service.ts: createUpload(file, organizationId,
uploaderId)) para los ficheros de entrega — NO escribas tu propio storage. Inyecta el
NotificationsService del Epic A. Identidad temporal vía @Headers('x-dev-user') (ver plan). Imita el
estilo de courses/ y usa el FileUpload de components/ui en el frontend.

Backend (apps/backend/src/assignments/ y assignments/submissions/):
- CRUD assignments bajo /courses/:courseId/assignments (solo profesor del curso; deriva org del Course).
- POST /assignments/:id/submissions (texto + ficheros), upsert único por (assignment,user), estado
  DRAFT/SUBMITTED/LATE (LATE si dueAt < ahora). GET .../submissions (profesor) y .../submissions/me.
- Al pasar a SUBMITTED, emit() NEW_ASSIGNMENT a los profesores del curso.
- DTOs con class-validator. Cada query filtra por organizationId (vía el Course).

Frontend (apps/frontend/src/features/assignments/): conecta la página a la API real (hoy es un stub
con mock). Lista + detalle + form de entrega con FileUpload. Hooks en lib/api/hooks/ al estilo
useCourses.ts. Valida el form en el cliente.

Cumple la DoD del plan (incluye un test happy-path del flujo de entrega). No toques el schema. Al
acabar, dime cómo probarlo con el seed (curso course-web-101, assignment-web-101-1).
```
</details>

---

## Sesión C — Grading + gradebook + CSV

**Objetivo:** calificar entregas y ver el gradebook; export CSV.

**Backend:** `PATCH /submissions/:id/grade` (`score`, `feedback`, `gradedBy`, estado `GRADED`) →
`emit()` `GRADE_PUBLISHED` al alumno. `GET /courses/:id/gradebook` (matriz alumnos × assignments).
`GET /courses/:id/gradebook.csv` (**export CSV**).

**Frontend** (`features/gradebook/` y/o la `GradesPage` existente): tabla de gradebook (profesor),
panel de calificación, vista "mis notas" (alumno).

**DoD:** profesor califica, alumno ve su nota (y le llega notificación al recargar), CSV descarga bien.

<details><summary>📋 Prompt listo para pegar</summary>

```
Trabaja en la rama `david`. Implementa el Epic C del plan en docs/planning/David-sessions.md:
grading + gradebook + export CSV.

Contexto: sobre el Epic B (assignments/submissions ya existen). Inyecta NotificationsService.
Identidad temporal vía @Headers('x-dev-user'). Deriva org del Course.

Backend:
- PATCH /submissions/:id/grade: score (0..maxScore, valida), feedback?, gradedById, estado GRADED,
  gradedAt. Solo profesor del curso. Al calificar, emit() GRADE_PUBLISHED al autor de la entrega.
- GET /courses/:id/gradebook: matriz alumnos × assignments con scores.
- GET /courses/:id/gradebook.csv: mismo dato en CSV (Content-Type text/csv, filename por header).

Frontend (apps/frontend/src/features/grades o features/gradebook): tabla de gradebook para el
profesor, panel de calificación, y vista "mis notas" para el alumno. Hooks en lib/api/hooks/.

Valida score en front y back. Cumple la DoD (test happy-path de calificar + leer gradebook). No toques
el schema. Al acabar, dime cómo probarlo con el seed.
```
</details>

---

## Sesión D — Forums

**Objetivo:** hilos + posts con respuestas anidadas, pin y búsqueda por curso.

**Backend** (`apps/backend/src/forums/`): `GET/POST /courses/:id/forum/threads`,
`GET/POST /threads/:id/posts` (con `parentId` para anidar), `PATCH /threads/:id/pin` (profesor),
`GET /courses/:id/forum/search?q=`. En hilo/respuesta nueva → `emit()` `FORUM_REPLY` a los implicados.

**Frontend** (`features/forums/`): lista de hilos, vista de hilo con respuestas, form de nuevo post,
búsqueda. (Existen `ForumsPage`/`ThreadPage` stub.)

**DoD:** crear hilo, responder anidado, pin (solo profesor), búsqueda filtra, notifica.

<details><summary>📋 Prompt listo para pegar</summary>

```
Trabaja en la rama `david`. Implementa el Epic D del plan en docs/planning/David-sessions.md: foros
(backend + frontend).

Contexto: modelos ForumThread/ForumPost ya existen (ForumPost.parentId permite anidar). Inyecta
NotificationsService. Identidad temporal vía @Headers('x-dev-user'). Deriva org del Course. Imita
courses/.

Backend (apps/backend/src/forums/):
- GET/POST /courses/:id/forum/threads (crear hilo: cualquier miembro del curso).
- GET/POST /threads/:id/posts (parentId opcional para respuestas anidadas).
- PATCH /threads/:id/pin (solo profesor del curso).
- GET /courses/:id/forum/search?q= (busca en títulos de hilo y cuerpos de post del curso).
- En hilo nuevo o respuesta, emit() FORUM_REPLY a los usuarios relevantes (autor del hilo / del post
  padre), evitando notificarte a ti mismo.

Frontend (apps/frontend/src/features/forums/): conecta ForumsPage y ThreadPage a la API real. Lista de
hilos, vista de hilo con árbol de respuestas, form de nuevo post, buscador. Hooks en lib/api/hooks/.

Valida inputs front+back. Cumple la DoD (test happy-path crear hilo + responder). No toques el schema.
```
</details>

---

## Sesión E — Realtime gateway + centro de notificaciones + live updates

**Objetivo:** el módulo grande (Real-time WebSockets, 2 pts). Socket.io con rooms por usuario, empuje
de notificaciones/eventos en vivo, y la UI del centro de notificaciones.

> **Deps a añadir (código de app, permitido):** `socket.io`, `@nestjs/websockets`,
> `@nestjs/platform-socket.io` en el backend; `socket.io-client` en el frontend. Si necesitas que el
> proxy/HTTPS soporte WebSocket, **pídeselo a Ale** (no toques `infra/`).

**Backend** (`apps/backend/src/realtime/realtime.gateway.ts`):
- Gateway Socket.io, **room por usuario** (`user:<id>`), connect/disconnect **grácil**.
- **Handshake — DEV por ahora:** identifica al usuario por `handshake.auth.userId` (o cabecera
  `x-dev-user`). ⚠️ `// TODO(auth): verificar JWT real de Jorge en handshake.auth.token`.
- Enchufa el hook del Epic A: `NotificationsService.emit()` ahora, además de persistir, empuja
  `notification:new` a `user:<id>` si está conectado. `emit()` **no-op seguro** si el gateway no corre.
- **Presence:** al conectar/desconectar, actualiza `User.onlineAt`. Emitir a amigos = **DIFERIDO**
  (necesita `Friendship` de Jorge); de momento solo actualiza `onlineAt`.

**Frontend** (`features/notifications/`): hook cliente de socket (reconexión **grácil**), dropdown del
centro de notificaciones + badge de no-leídas en la navbar, toast al llegar una nueva. Live updates:
nota nueva aparece sin recargar; respuesta de foro en vivo.

**DoD:** con dos navegadores, una acción de A dispara notificación en vivo a B sin recargar; el socket
reconecta al caerse; sin errores de consola.

<details><summary>📋 Prompt listo para pegar</summary>

```
Trabaja en la rama `david`. Implementa el Epic E del plan en docs/planning/David-sessions.md: realtime
gateway + centro de notificaciones + live updates. Es el módulo de Real-time WebSockets (2 pts).

Añade deps: backend socket.io + @nestjs/websockets + @nestjs/platform-socket.io; frontend
socket.io-client. (Si hiciera falta config de proxy/WebSocket en infra, es de Ale — solo anótalo.)

Backend (apps/backend/src/realtime/realtime.gateway.ts):
- Gateway Socket.io con room por usuario (user:<id>), connect/disconnect grácil.
- Handshake DEV: identifica por handshake.auth.userId (o cabecera x-dev-user). Marca claramente
  "// TODO(auth): verificar JWT real (Jorge) en handshake.auth.token".
- Integra con NotificationsService (Epic A): al emit(), además de persistir, empuja "notification:new"
  a user:<id> si está conectado. emit() debe ser no-op seguro si el gateway no está.
- Presence: actualiza User.onlineAt en connect/disconnect. Emitir a amigos queda DIFERIDO (necesita
  Friendship de Jorge) — solo actualiza onlineAt por ahora y deja el TODO.

Frontend (apps/frontend/src/features/notifications/): hook de socket con reconexión grácil; dropdown de
centro de notificaciones + badge de no-leídas en la navbar; toast al recibir una nueva; las notas y las
respuestas de foro aparecen en vivo. Conecta la NotificationsPage a GET /notifications (Epic A).

Cumple la DoD probando con DOS navegadores (una acción en uno notifica al otro en vivo, y reconecta al
caerse el socket). No toques el schema ni infra/. Al acabar, explícame cómo demostrarlo.
```
</details>

---

## Después de los 5 epics

- Verifica el conteo de módulos con `en.subject.pdf` (no con `MVP_DESIGN.md`, que está stale).
- Stretch **solo tras 14 pts sólidos**: analytics dashboard (2, `features/analytics/` + agregados
  backend con charts + export). Ver Epic 6 en `David.md`.
- Coordina con Jorge la **pasada de refactor de auth** (checklist arriba) cuando entregue `common/auth`.
