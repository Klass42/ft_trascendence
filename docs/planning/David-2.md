# David — Plan 2 (Fase A · Assignments, Teacher Dashboard & Presence)

> Segundo bloque (Fase A del rediseño, ver [`LMS-redesign.md`](./LMS-redesign.md)). Rama **`david`** →
> `staging`. Tu núcleo (A–E + analytics) ya está integrado; esto pule la autoría de tareas, quita el
> mock de tu dashboard de profesor, y cierra la presence a amigos que quedó diferida.

**Estándares (obligatorios, ver LMS-redesign §6):** componer `components/ui` (los nuevos de la Épica 0
de Aloiki) · responsive · estados vacío/carga/error · **sin mock** · validación front+back · a11y ·
cero errores de consola · **un test E2E Playwright** por flujo.

## Contrato anti-bloqueo — TÚ absorbes lo bloqueante
Decisión (2026-07-19): para que Aloiki y Jorge (modelos pequeños) **nunca esperen a nadie**, David se
lleva **todo lo compartido/bloqueante** y ellos solo tocan UI auto-contenida sobre backend existente.
- **Consumes**: componentes de la Épica 0 (ya en staging) · Friends API de Jorge (ya en staging).
- **Entregas (desbloqueos → Épica D0, PRIMERO)**: TODOS los cambios de **schema** de la Fase A, el
  **split del Dashboard** + stubs, el **harness E2E** del repo, y cualquier **endpoint compartido** que
  falte. Aloiki y Jorge no tocan `prisma/` ni ficheros compartidos.

## Épica D0 — Desbloqueos ✅ HECHA (David/Opus, 2026-07-19, en staging)
- [x] **Schema Fase A:** `Assignment.openAt/closeAt` + modelo `AssignmentFile` (análogo a
      `SubmissionFile`) + relación inversa en `File`. Aplicado vía `prisma db push` + `prisma generate`.
      ⚠️ **Drift pre-existente**: el repo tiene `migrations/…_init` pero la app arranca con `db push`
      (compose), así que `migrate dev` pide reset. NO lo forcé. **Para Jorge/Ale**: reconciliar la
      historia de migraciones (fuera de Fase A). El cambio llega al equipo vía el `db push` del arranque.
- [x] **Split del Dashboard:** `DashboardPage` ahora es un dispatcher por rol →
      `StudentDashboard` (Aloiki), `TeacherDashboard` (David), `AdminDashboard` (Jorge) + `DashboardHeader`
      compartido. Refactor puro (comportamiento preservado); cada uno de-mockea el suyo con un `// TODO`.
- [x] **Harness E2E:** ya existía (`apps/frontend/playwright.config.ts` + `e2e/courses.spec.ts`, 16
      tests). Añadido el script `test:e2e`/`test:e2e:ui`. Ejecuta: `pnpm --filter frontend test:e2e`
      (requiere la stack levantada + `VITE_DEV_USER_ID` en `.env.development.local`).
- [x] **Endpoints compartidos:** "staff añade alumno" NO requiere endpoint nuevo — el existente
      `POST /courses/:courseId/enroll?userId=X` ya acepta un userId explícito (módulo de Aloiki, patrón
      temporal). Cuando Aloiki migre enrollments a `@CurrentUser`, David añadirá un endpoint dedicado.

## Épica A7 — Autoría de tareas: editar/borrar + plazos + recursos ✅ HECHA (PR #5 → staging)
- [x] **Editar/borrar tarea** desde `AssignmentsPage` (staff): Editar (Modal + `PATCH`) y Borrar
      (`ConfirmDialog` + toast). Componente reutilizable `AssignmentForm` (crear/editar).
- [x] **Plazos de inicio y fin**: `openAt`/`closeAt` en DTOs + servicio (valida orden
      `openAt ≤ dueAt ≤ closeAt`). `submit()` rechaza fuera de ventana (`400`: no abierta / cerrada);
      borradores permitidos. UI con `DatePicker` + `Badge` de estado (No abierta/Abierta/Cerrada).
- [x] **Recursos del profesor**: `AssignmentFile` enlazado por `fileIds` (validado org+uploader como
      `SubmissionFile`); devueltos en el detalle; `DELETE /assignments/:id/files/:fileId`. UI con
      `FileUpload` (crear/editar) + lista de recursos visible para todo miembro.
- [x] `dueAt`/estado claros en la lista y el detalle.
- [x] E2E `assignments-authoring.spec.ts`: profesor crea tarea cerrada con recurso, la edita, alumno
      no puede entregar (API), y se borra. Backend `pnpm test` 127/127.

## Épica A4-teacher — Des-mockear el TeacherDashboard ✅ HECHA (PR → staging)
- [x] `TeacherDashboard` con datos reales vía `GET /me/teaching/summary` (nuevo, en `grading`):
      **cursos activos** (cursos PUBLISHED que imparte), **alumnos totales** (distintos, de enrollments),
      **por calificar** = entregas SUBMITTED/LATE sin nota de sus cursos. Sin `mock-data`.
- [x] Endpoint agregado `getTeachingSummary(actingUserId)` en `GradingService` + ruta en
      `GradingController`; tenancy implícita (solo cursos donde el actor está inscrito). Tests unit.
- [x] Estados carga/vacío/error (Spinner/EmptyState/retry). Click en "Por calificar" (tarjeta o fila)
      → `/grades` (gradebook).
- [x] E2E `teacher-dashboard.spec.ts`: cifras reales (sin "142"), fila pendiente, y navegación al
      gradebook.

## Épica A6b — Presence a amigos ✅ HECHA (PR → staging)
- [x] `RealtimeGateway`: cuenta sockets vivos por usuario (in-memory); en la transición
      online↔offline (primer socket sube / último baja) emite `presence:update` {userId, online} a los
      AMIGOS ACCEPTED (query `Friendship`, simétrica). Sigue sellando `onlineAt`. `// TODO(presence)` quitado.
- [x] Endpoint de lectura `GET /me/presence/friends` (`PresenceService`/`PresenceController` en
      `realtime`): amigos + estado online (autoridad = contador en memoria del gateway).
- [x] Frontend: `PresenceProvider` (fetch inicial + socket `presence:update` + resync en cada
      (re)connect) y widget `FriendsPresence` en la navbar (Dropdown con dot online/offline y contador).
- [x] Seed: amistad ACCEPTED lucia↔diego para demo/test.
- [x] Test de integración (`realtime.gateway.spec.ts`): dos amigos, uno conecta → el otro recibe
      `presence:update` online (y offline al desconectar); no llega a no-amigos. E2E `presence.spec.ts`:
      el widget refleja el flip en vivo (socket real de lucia contra el gateway).

## Consumes
- Épica 0 de Aloiki (componentes) · split del Dashboard (Aloiki) · Friends API (Jorge, ya en staging).
