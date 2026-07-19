# David — Plan 2 (Fase A · Assignments, Teacher Dashboard & Presence)

> Segundo bloque (Fase A del rediseño, ver [`LMS-redesign.md`](./LMS-redesign.md)). Rama **`david`** →
> `staging`. Tu núcleo (A–E + analytics) ya está integrado; esto pule la autoría de tareas, quita el
> mock de tu dashboard de profesor, y cierra la presence a amigos que quedó diferida.

**Estándares (obligatorios, ver LMS-redesign §6):** componer `components/ui` (los nuevos de la Épica 0
de Aloiki) · responsive · estados vacío/carga/error · **sin mock** · validación front+back · a11y ·
cero errores de consola · **un test E2E Playwright** por flujo.

## Contrato anti-bloqueo
- **Consumes**: componentes de Aloiki (Épica 0) y el stub `TeacherDashboard` que deja en el split del
  Dashboard (rellenas ese fichero, no tocas el suyo). La API de **Friends** de Jorge ya está en
  `staging` (backend) → tu presence ya no está bloqueada.
- **Entregas**: nada que bloquee a otros. Si añades campos al schema (A7), coordina con Jorge (steward
  de `prisma/`) en un PR pequeño.

## Épica A7 — Autoría de tareas: editar/borrar + plazos + recursos
- [ ] **Editar/borrar tarea** desde `AssignmentsPage` (staff): `PATCH/DELETE /assignments/:id` (ya
      existen) — hoy solo se pueden crear.
- [ ] **Plazos de inicio y fin**: el modelo solo tiene `dueAt` (fin). Añade `openAt?` (apertura) y
      `closeAt?` (cierre tras el cual no se entrega) → **cambio de schema pequeño** (coordina con Jorge):
      `Assignment.openAt`, `Assignment.closeAt`. Refleja el estado en UI (no abierta / abierta / cerrada)
      y hazlo cumplir en el backend al entregar (rechaza fuera de ventana).
- [ ] **Recursos del profesor en la tarea**: adjuntos de enunciado (reusa el patrón de
      `SubmissionFile`/FilesService; requiere un `AssignmentFile` en schema — mismo PR de coordinación).
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
