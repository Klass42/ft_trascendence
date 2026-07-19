# Fase A — Arranque para el equipo (prompts OpenCode + mensaje)

> Cada persona copia SU prompt y lo pega en su sesión (OpenCode / Claude). Trabaja en tu rama
> personal y mergea **rama → `staging`** vía PR (nunca directo a `master`). Tu plan detallado está en
> `docs/planning/{TuNombre}-2.md`; los estándares de calidad comunes en `LMS-redesign.md §6`.

**Reglas de oro (DoD, iguales para todos):** compón `components/ui` (no estilos inline improvisados) ·
responsive · estados **vacío/carga/error** · **CERO datos mock** · validación front+back · accesible
(labels/foco/teclado) · **sin errores de consola** · añade un **test E2E** del flujo (usa el harness
Playwright compartido; si aún no está montado, deja el flujo documentado para el test). El backend de
Fase A **ya existe casi entero** — esto es cablear UI, no reinventar endpoints.

---

## 🟣 ALOIKI — prompt (empieza tú: desbloqueas al resto)

```
Trabaja en la rama `aloiki` (mergea a `staging` vía PR, nunca a master). Eres el frontend-lead.
Implementa tu Fase A siguiendo docs/planning/Aloiki-2.md y los estándares de docs/planning/LMS-redesign.md §6.

NOTA: la Épica 0 (design system) YA ESTÁ HECHA y en staging (Modal, Select, Textarea, DatePicker, Tabs,
Table, Toast/useToast, EmptyState, FormField, Badge, Dropdown, ConfirmDialog + docs/planning/ui-language.md).
Compón esos componentes; NO los rehagas.

ORDEN (no tocas prisma/ ni ficheros compartidos: David absorbe lo bloqueante —schema, split del
dashboard, harness E2E, endpoints— en su D0; tú solo UI auto-contenida):
1. Rellena el StudentDashboard (el split lo crea David en D0): en ese stub, de-mockea (quita racha/
   promedio/próxima-entrega hardcodeados; usa useMyProgress y la próxima tarea real) y elimina el import
   de @/lib/mock-data. No toques Teacher/Admin.
3. A1 Autoría de curso — botón "Crear curso" en /courses (TEACHER/ADMIN); crear/editar/publicar/archivar
   (backend YA: POST/GET/PATCH/DELETE /courses); hooks useCreateCourse/useUpdateCourse/useDeleteCourse.
4. A2 Constructor de contenido — "modo profesor" en CourseDetailPage: secciones CRUD+reorder
   (PATCH sections/reorder) y lecciones CRUD+reorder + editor Markdown + videoUrl + adjuntos
   (POST lessons/:id/attachments vía FilesService). Backend YA existe todo.

Cumple la DoD de arriba en cada pantalla + un test E2E por flujo. No toques infra/ ni módulos de otros.
Al acabar cada épica resúmeme qué entregaste y cómo probarlo, y abre PR a staging.
```

---

## 🟢 JORGE — prompt

```
Trabaja en la rama `jorge` (mergea a `staging` vía PR, nunca a master). Implementa tu Fase A siguiendo
docs/planning/Jorge-2.md y los estándares de docs/planning/LMS-redesign.md §6. Usa los componentes
nuevos de la Épica 0 de Aloiki (si aún no están, construye contra sus props publicadas).

ORDEN:
1. A6a — INTEGRA tu frontend de Organización/Amigos (Epic 7c) que está en tu rama pero NO en staging:
   OrgSettingsPage, OrgMembersPage, rutas /org, hooks useOrg/useOrgMembers. Abre PR jorge→staging y
   resuelve conflictos. Verifica que cumplen la DoD (design system, sin mock, estados, E2E).
2. A3 — Roster: pestaña "Alumnos" en el curso (staff): lista inscritos (GET /courses/:id/enrollments) +
   progreso (GET /courses/:id/progress), cambiar rol (PATCH /enrollments/:id/role), expulsar (DELETE
   /courses/:courseId/enroll), añadir alumno (el endpoint lo provee David en D0 si falta). Reusa
   patrones de OrgMembersPage.
3. A5 — Perfil real: editar nombre (PATCH /users/me) + cambiar contraseña (crea POST /auth/change-password
   con argon2, dominio auth tuyo). Nada de toggles falsos: hazlos funcionales o quítalos.
4. A4-admin — Rellena el stub AdminDashboard (del split que hace David en D0) con datos reales (GET
   /users, GET /organizations/me). Elimina KPIs hardcodeados.

Cumple la DoD + un test E2E por flujo. Al acabar cada épica, resumen + PR a staging.
```

---

## 🔵 DAVID — prompt

```
Trabaja en la rama `david` (mergea a `staging` vía PR). Tu núcleo ya está integrado; implementa tu
Fase A siguiendo docs/planning/David-2.md y los estándares de docs/planning/LMS-redesign.md §6. TÚ
absorbes lo bloqueante para que Aloiki y Jorge no esperen a nadie. Usa los componentes de la Épica 0
(ya en staging).

ORDEN:
0. D0 (DESBLOQUEOS, PRIMERO, súbelo a staging y avisa): (a) schema Fase A en UN PR — Assignment.openAt/
   closeAt + modelo AssignmentFile + cualquier campo que pidan A1–A6; migración + prisma generate.
   (b) Split de DashboardPage en StudentDashboard/TeacherDashboard/AdminDashboard (stubs) para que
   Aloiki/Jorge rellenen los suyos. (c) Harness E2E en el repo (Playwright: config + carpeta e2e/ +
   flujo de ejemplo + script test:e2e). (d) endpoints compartidos que falten (p.ej. staff-añade-alumno
   en enrollments).
1. A7 — Autoría de tareas: editar/borrar tarea (PATCH/DELETE /assignments/:id ya existen) + plazos
   apertura/cierre (usa Assignment.openAt/closeAt de D0; haz cumplir la ventana al entregar) + recursos
   (AssignmentFile de D0). Form con Modal + DatePicker. Muestra dueAt/estado claro.
2. A4-teacher — Rellena el stub TeacherDashboard con datos reales: "Por calificar" = entregas
   SUBMITTED/LATE sin nota de tus cursos, cursos activos, nº alumnos reales. Quita mock-data. Si falta
   un endpoint agregado, créalo en tu dominio (assignments/grading).
3. A6b — Presence a amigos (cierra tu TODO): en RealtimeGateway, al conectar/desconectar emite
   presence:update online/offline a los amigos (Friendship ACCEPTED; Friends API de Jorge ya en staging).
   Frontend refleja estado en vivo. Quita el // TODO(presence).

Cumple la DoD + un test E2E por flujo. Al acabar cada épica, resumen + PR a staging.
```

---

## 📱 Mensaje para el equipo (copia y pega)

Ver la sección de más abajo o el mensaje que te paso por chat.
