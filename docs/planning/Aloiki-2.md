# Aloiki — Plan 2 (Fase A · Content & Design System)

> Segundo bloque de trabajo (Fase A del rediseño, ver [`LMS-redesign.md`](./LMS-redesign.md)).
> Rama **`aloiki`** → `staging`. Eres el **frontend-lead**: tu Épica 0 (design system) desbloquea a
> todos, así que va **primero**. Casi todo es cablear UI a backend que YA existe.

**Estándares de calidad (obligatorios en cada pantalla, ver LMS-redesign §6):** componer `components/ui`
(no estilos inline improvisados) · responsive · estados **vacío/carga/error** · **sin datos mock** ·
validación front+back · accesible (labels/foco/teclado) · **cero errores de consola** · **un test E2E
Playwright** por flujo (con captura) que debe pasar.

## Anti-bloqueo — trabajo auto-contenido
No tocas `prisma/` ni ficheros compartidos: **David absorbe lo bloqueante** (schema, split del
dashboard, harness E2E, endpoints compartidos) en su Épica D0. Tú consumes:
- La **Épica 0** (componentes de `@/components/ui`) — ya en `staging`.
- Los **stubs del split del Dashboard** que crea David: tú rellenas SOLO `StudentDashboard` (no tocas
  Teacher/Admin).
- Todo tu backend (cursos/secciones/lecciones/enrollments) **ya existe**.

## Épica 0 — Design system + lenguaje visual ✅ HECHA (por David, 2026-07-19)
Ya está en `staging`, no la rehagas. Añadidos a `apps/frontend/src/components/ui/` (exportados en el
barrel): **Modal, ConfirmDialog, Dropdown, Toast/useToast (ToastProvider ya montado en main.tsx),
Select, Textarea, DatePicker, FormField, Table, Tabs, Badge, EmptyState**. Referencia de uso y reglas:
`docs/planning/ui-language.md`. **Compón estos componentes en A1/A2** (no estilos inline). Si te falta
alguno, añádelo aquí siguiendo el mismo patrón (`.module.css` + tokens).

## Épica A1 — Autoría de curso (backend YA existe: `POST/GET/PATCH/DELETE /courses`)
- [ ] En `/courses`: botón **"Crear curso"** visible a TEACHER/ADMIN → modal/página con título,
      descripción, categoría, imagen (FilesService), código de acceso, estado (DRAFT/PUBLISHED/ARCHIVED).
- [ ] Editar/publicar/archivar curso (PATCH). Ver borradores/archivados propios (filtro por estado).
- [ ] Hooks `useCreateCourse`/`useUpdateCourse`/`useDeleteCourse` (estilo `useCourses`).
- [ ] E2E: profesor crea un curso → aparece; lo publica → visible a alumno.

## Épica A2 — Constructor de contenido (backend YA existe: secciones y lecciones CRUD + `reorder` + attachments)
- [ ] "Modo profesor" en `CourseDetailPage`: si el usuario es staff del curso, mostrar acciones de
      edición.
- [ ] **Secciones**: crear/renombrar/borrar/**reordenar** (`PATCH sections/reorder`).
- [ ] **Lecciones**: crear/editar/borrar/**reordenar** (`.../lessons/reorder`); **editor de lección**
      (Markdown), `videoUrl` (embed/subida), **adjuntos** (`POST lessons/:id/attachments` vía FilesService).
- [ ] Reordenar por drag (o botones ↑/↓ si drag es mucho).
- [ ] E2E: profesor añade sección + lección con vídeo y adjunto → alumno la ve en `LessonPage`.

## Épica A-shell — Rellenar el StudentDashboard (el split lo hace David en D0)
- [ ] En el stub `StudentDashboard` que crea David: **des-mockea** — quita racha/promedio/"próxima
      entrega" hardcodeados (`mock-data`); usa progreso real (`useMyProgress`) y la próxima tarea real
      (de sus cursos). No toques `TeacherDashboard`/`AdminDashboard`.
- [ ] Elimina el import de `@/lib/mock-data` de tu parte.
- [ ] E2E: dashboard de alumno sin datos inventados, sin errores de consola.

## Consumes (de otros, ya disponible)
- Auth/`@CurrentUser` y RBAC (Jorge, en `staging`). FilesService `/files` (tuyo, ya existe).
- Nada te bloquea: todos tus endpoints backend existen.
