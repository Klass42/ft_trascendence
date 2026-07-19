# Aloiki — Plan 2 (Fase A · Content & Design System)

> Segundo bloque de trabajo (Fase A del rediseño, ver [`LMS-redesign.md`](./LMS-redesign.md)).
> Rama **`aloiki`** → `staging`. Eres el **frontend-lead**: tu Épica 0 (design system) desbloquea a
> todos, así que va **primero**. Casi todo es cablear UI a backend que YA existe.

**Estándares de calidad (obligatorios en cada pantalla, ver LMS-redesign §6):** componer `components/ui`
(no estilos inline improvisados) · responsive · estados **vacío/carga/error** · **sin datos mock** ·
validación front+back · accesible (labels/foco/teclado) · **cero errores de consola** · **un test E2E
Playwright** por flujo (con captura) que debe pasar.

## Contrato anti-bloqueo (entregas TÚ, Semana 1)
- **Épica 0 primero**: publica las **APIs de los componentes** (props/nombres) en cuanto empieces,
  aunque la implementación llegue después, para que Jorge y David construyan contra el contrato.
- **Split del Dashboard**: parte `DashboardPage` en `StudentDashboard`/`TeacherDashboard`/`AdminDashboard`
  (3 ficheros) y súbelo pronto → Jorge rellena Admin y David rellena Teacher sin tocar tu fichero.

## Épica 0 — Design system + lenguaje visual (DESBLOQUEA A TODOS)
- [ ] Amplía `apps/frontend/src/components/ui/`: **Modal, Select, Textarea, DatePicker, Tabs, Table,
      Toast/useToast, EmptyState, FormField, Badge, Dropdown, ConfirmDialog** (más los que veas). Usa
      `tokens.css`; accesibles y responsive.
- [ ] `docs/planning/ui-language.md` (o en Storybook si lo montas): espaciado, color, tipografía,
      patrón de página (cabecera, acciones, estados vacío/carga/error), patrón de formulario y de tabla.
- [ ] Publica en tu plan/README la lista de componentes y sus props para que el resto componga.

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

## Épica A-shell — Split + limpieza del Dashboard de ALUMNO
- [ ] Parte `DashboardPage` en 3 componentes por rol (deja `TeacherDashboard`/`AdminDashboard` como
      stubs mínimos que rellenan David/Jorge).
- [ ] **Des-mockea el StudentDashboard**: quita racha/promedio/"próxima entrega" hardcodeados
      (`mock-data`); usa progreso real (`useMyProgress`) y la próxima tarea real (de sus cursos).
- [ ] Elimina el import de `@/lib/mock-data` de tu parte.
- [ ] E2E: dashboard de alumno sin datos inventados, sin errores de consola.

## Consumes (de otros, ya disponible)
- Auth/`@CurrentUser` y RBAC (Jorge, en `staging`). FilesService `/files` (tuyo, ya existe).
- Nada te bloquea: todos tus endpoints backend existen.
