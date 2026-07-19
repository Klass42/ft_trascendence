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

## Épica A7 — Autoría de tareas: editar/borrar + plazos + recursos
- [ ] **Editar/borrar tarea** desde `AssignmentsPage` (staff): `PATCH/DELETE /assignments/:id` (ya
      existen) — hoy solo se pueden crear.
- [ ] **Plazos de inicio y fin**: usa `Assignment.openAt/closeAt` (creados por ti en D0). Refleja el
      estado en UI (no abierta / abierta / cerrada) y hazlo cumplir en el backend al entregar (rechaza
      fuera de ventana). Form con `DatePicker` + `Modal` del design system.
- [ ] **Recursos del profesor en la tarea**: adjuntos de enunciado con `AssignmentFile` (creado en D0)
      + FilesService, reusando el patrón de `SubmissionFile`.
- [ ] Muestra el `dueAt`/estado con claridad en la lista (el usuario no "veía" los plazos).
- [ ] E2E: profesor crea tarea con apertura/cierre, la edita, adjunta un recurso; alumno no puede
      entregar fuera de ventana.

## Épica A4-teacher — Des-mockear el TeacherDashboard (tu dominio: entregas/calificación)
- [ ] Rellena el stub `TeacherDashboard` (de Aloiki) con datos reales: **"Por calificar"** = entregas
      SUBMITTED/LATE sin nota de sus cursos (deriva de tus endpoints de submissions/grading), **cursos
      activos** reales, **nº de alumnos** reales (de enrollments). Elimina `mock-data` ("142 alumnos",
      lista de entregas falsa).
- [ ] Si falta un endpoint agregado ("entregas pendientes de calificar del profesor"), créalo en tu
      dominio (assignments/grading) — es tuyo.
- [ ] E2E: dashboard de profesor con cifras reales, click en "por calificar" lleva al gradebook.

## Épica A6b — Presence a amigos (cierra tu TODO diferido; Friends API ya existe)
- [ ] En `RealtimeGateway`, al conectar/desconectar, además de sellar `User.onlineAt`, **emite
      online/offline a los amigos** del usuario (usa la relación `Friendship` ACCEPTED; consúmela vía
      Prisma o el servicio de Jorge). Evento socket `presence:update`.
- [ ] Frontend: en la lista de amigos (de Jorge) o navbar, refleja estado en vivo. Reconexión grácil.
- [ ] Quita el `// TODO(presence)`.
- [ ] E2E/integración: con dos usuarios amigos, uno conecta → el otro recibe `presence:update` online.

## Consumes
- Épica 0 de Aloiki (componentes) · split del Dashboard (Aloiki) · Friends API (Jorge, ya en staging).
