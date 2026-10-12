# LMS "Klass" — Rediseño de producto y plan

> Estado: **propuesta** (2026-07-19). Nace de una auditoría real del frontend + capturas con
> Playwright. El objetivo: pasar de "el backend existe pero la UI de profesor está casi vacía" a un
> LMS que **se sienta completo**, y dejarlo planificado con guardarraíles para que se construya con
> calidad (incluidos compañeros con modelos pequeños en OpenCode).
>
> **Actualización 2026-09-19:** Fase B plantillas **landed**. Un solo ciclo de Tareas sobre
> `Activity` (bloques + plantillas + gradebook de intentos). El diagnóstico §1 («un solo tipo de
> tarea», gradebook solo assignments) es histórico. Guía: [`task-templates.md`](./task-templates.md).
> Spec: [`../superpowers/specs/2026-09-19-task-templates-design.md`](../superpowers/specs/2026-09-19-task-templates-design.md).

## 1. Diagnóstico (por qué se siente pobre)

La causa raíz: **falta toda la mitad de "autoría" del LMS en el frontend**, aunque gran parte del
backend ya existe. Contrastado con el código y con capturas como profesor:

**El backend YA tiene** (endpoints reales): CRUD de cursos, secciones y lecciones; inscripciones;
tareas + entregas; calificación + gradebook + CSV; foros; notificaciones + realtime; analytics;
auth (email/pass + Google); organizaciones; usuarios/RBAC; amigos.

**El frontend NO tiene** (lo que hace que un profesor no pueda trabajar):
- ❌ **Crear un curso** (no hay botón en ningún sitio; ni hook `useCreateCourse`).
- ❌ **Autoría de contenido**: crear/editar/reordenar secciones y lecciones; editor de lección
  (Markdown), subir vídeo, adjuntar recursos.
- ❌ **Publicar/archivar** curso, metadatos (categoría, imagen, código de acceso).
- ❌ **Gestión de inscripciones / roster**: ver alumnos, invitar/añadir/expulsar, rol ASSISTANT,
  progreso por alumno.
- ❌ **Editar/borrar** tareas; fechas de apertura/cierre; recursos del profesor en la tarea.
- ❌ **Un solo tipo de tarea**: "texto + ficheros", corrección 100% manual. Sin quiz, opción
  múltiple, rellenar huecos, vocabulario, emparejar, listening, speaking…
- ⚠️ **Dashboards de profesor/admin con datos MOCK** hardcodeados ("142 alumnos", KPIs falsos).
- ⚠️ **Perfil** con toggles falsos (email, 2FA, idioma) — no funcionan.
- ⚠️ **Frontend de Organización/Amigos de Jorge sin mergear** (rama `jorge`, Epic 7c).

**Conclusión:** no es que el plan fuera malo — es que el frontend se quedó en "consumo" y nunca se
construyó la capa de "creación/gestión". La buena noticia: **la mayor parte de la Fase A es cablear UI
a endpoints que ya existen**, así que es alcanzable y de bajo riesgo.

## 2. Arquitectura de información objetivo (por rol)

### Profesor (staff del curso) — "modo profesor" por curso
- **Gestión de curso**: crear/editar/publicar/archivar; título, descripción, categoría, imagen,
  código de acceso.
- **Constructor de contenido**: secciones (añadir/renombrar/reordenar/borrar), lecciones (editor
  Markdown, URL/subida de vídeo, adjuntos), reordenar por drag.
- **Roster**: lista de inscritos, invitar/añadir/expulsar, asignar ASSISTANT, progreso por alumno.
- **Actividades** (ver §3): crear de varios tipos, fechas (apertura/entrega/cierre), intentos,
  política de nota; **gradebook** (ya existe) + vista por alumno.

### Alumno
- Inscribirse (código), consumir lecciones, **hacer actividades de varios tipos**, entregar, ver
  nota/feedback, foros, notificaciones, progreso propio.

### Admin (organización)
- **Dashboard real** (usuarios, cursos, actividad — quitar mock), **CRUD de usuarios** (backend
  existe), **ajustes de organización + miembros** (frontend de Jorge, integrar).

### Navegación (propuesta)
Barra lateral contextual: al entrar en un curso como staff aparece un sub-nav del curso
(**Contenido · Alumnos · Actividades · Notas · Foro · Analíticas**). Para admin, sección
**Administración** (Usuarios, Organización). "Crear curso" visible en `/courses` para teacher/admin.

## 3. Motor de Actividades / Ejercicios (el corazón de la visión)

Generalizar `Assignment` → **`Activity`** con un `type`, y un motor de preguntas extensible. Diseño
híbrido: pocas tablas reales + columnas JSON validadas por DTO por tipo (permite añadir un tipo nuevo
siguiendo una plantilla, sin explotar el esquema).

**Modelos (Prisma, Fase B):**
- `Activity`: `courseId, type, title, description, openAt?, dueAt?, closeAt?, maxScore, attemptsAllowed,
  timeLimitSec?, config(JSON), status`. `type ∈ { MANUAL, QUIZ, SPEAKING, LISTENING }`.
- `Question` (para QUIZ/LISTENING): `activityId, kind, prompt, points, order, content(JSON)`.
  `kind ∈ { MULTIPLE_CHOICE, TRUE_FALSE, FILL_BLANK, MATCHING, ORDERING, SHORT_ANSWER }`.
- `Attempt`: `activityId, userId, startedAt, submittedAt?, score?, status`. (Reusa/`Submission` para
  MANUAL.)
- `Answer`: `attemptId, questionId, response(JSON), correct?, awarded?`.

**Corrección:**
- **Auto** para objetivos (MCQ, V/F, rellenar huecos con lista de respuestas aceptadas/sinónimos →
  ideal vocabulario, emparejar, ordenar, respuesta corta normalizada).
- **Manual** para subjetivos (ensayo/ficheros = MANUAL actual; SPEAKING = grabar audio; después,
  opción de corrección asistida por IA).
- `config`: intentos, tiempo, barajar, mostrar soluciones al final, ventana de fechas.

**Tipos de pregunta (plantilla común `content`):** cada `kind` define su forma de `content`
(opciones, huecos, pares, etc.) y su corrector. Añadir un tipo = 1 DTO + 1 corrector + 1 editor + 1
render de alumno (patrón repetible → apto para modelos pequeños con plantilla).

> **Ámbito 42 vs producto:** el plan original difería el "motor de quiz" a Fase 2. La Fase B es
> nivel-producto; para la entrega de 42, la Fase A ya hace que la app se sienta completa sin arriesgar
> los puntos de módulo (media construida = 0). Ver §5, decisión de alcance.

## 4. Fases y épicas

### Fase A — "Hacer el LMS real" (arregla el "pobre"; casi todo frontend sobre backend existente)
- **A1. Autoría de curso**: `/courses` con "Crear curso"; crear/editar/publicar/archivar; hooks
  `useCreateCourse`/`useUpdateCourse`. (Backend existe.)
- **A2. Constructor de contenido**: secciones + lecciones CRUD desde la UI; editor de lección
  (Markdown + vídeo + adjuntos vía FilesService); reordenar. (Backend existe; puede faltar endpoint de
  reorder.)
- **A3. Roster/inscripciones**: listar inscritos, invitar/añadir/expulsar, rol ASSISTANT, progreso por
  alumno. (Puede faltar endpoint de listar inscritos.)
- **A4. Des-mockear dashboards** (profesor/admin) → API real; vista de progreso por alumno.
- **A5. Perfil real**: editar nombre, cambiar contraseña (backend auth existe), preferencias de
  notificación reales.
- **A6. Integrar frontend Org/Amigos de Jorge** (Epic 7c) + presence a amigos (tu TODO diferido).
- **A7. Tareas — pulido**: editar/borrar tarea, fechas apertura/cierre, recursos del profesor.

### Fase B — "Actividades ricas / aprendizaje de idiomas" (la visión, nivel producto)
- **B1.** Motor de actividades (modelos + auto-corrección) en backend.
- **B2.** Autoría de quiz (editor por tipo de pregunta) + reproductor del alumno.
- **B3.** Tipos: MCQ, V/F, rellenar huecos (vocabulario/autocompletado), emparejar, ordenar, respuesta
  corta.
- **B4.** (Stretch) Media: listening (audio + preguntas), speaking (grabar → manual/IA).

### Fase C — Pro/pulido
Rúbricas, gradebook ponderado/categorías, moderación de foros, i18n real, etc.

## 5. Decisión de alcance (pendiente del owner)

**¿Hasta dónde para la entrega de 42?**
- **Opción 1 (recomendada):** solo **Fase A** para la entrega (LMS completo y sólido con los módulos
  actuales; protege los 14 puntos; arregla el "pobre"). Fase B diseñada y lista para arrancar justo
  después.
- **Opción 2:** Fase A + empezar Fase B dentro del plazo de 42 (más impresionante, más riesgo de
  media-construcción).

Depende de tu deadline de 42. Recomiendo Opción 1.

## 6. Guardarraíles de calidad (para que NO salga pobre/cutre)

El mayor riesgo con modelos pequeños es UI inconsistente y a medias. Palancas:

1. **Ampliar el design system** (`components/ui` hoy es mínimo: Button/Card/Input/Spinner/FileUpload).
   Añadir **Modal, Select, Textarea, DatePicker, Tabs, Table, Toast, EmptyState, FormField, Badge,
   Dropdown, ConfirmDialog**. Regla: *las pantallas nuevas COMPONEN estos, no inventan estilos inline.*
2. **Doc de lenguaje visual** (espaciado, color, tipografía, tokens, patrones de página: cabecera,
   estados vacío/carga/error). Una página = un patrón conocido.
3. **Definition of Done por pantalla** (obligatoria en cada épica): usa el design system; responsive;
   estados vacío/carga/error; **sin datos mock**; validación front+back; accesible (labels, foco,
   teclado); **sin errores de consola**.
4. **Puerta E2E con Playwright** (ya instalado): cada épica añade un test de flujo + captura; el flujo
   debe pasar y la captura revisarse. Es como detecto lo "cutre" automáticamente.
5. **Protocolo de revisión** (cuando me pidas revisar): corro E2E + captura + lectura de código contra
   la DoD, y solo apruebo si cumple. Reporto lo que falle.
6. **Briefs por épica auto-contenidos** (estilo `David-sessions.md`): endpoints exactos, ficheros
   exactos, contratos, DoD y estándares de UI — para que un modelo pequeño no improvise.

## 7. Próximo paso

Tras decidir el alcance (§5), escribo los **briefs por épica** (Fase A completa + diseño de Fase B)
en este directorio, listos para pegar en sesiones de OpenCode, con sus DoD y tests E2E. Antes de
codificar cualquier UI nueva: **primero ampliar el design system (§6.1) + doc visual (§6.2)** — es la
épica 0 que sube el suelo de calidad de todo lo demás.
