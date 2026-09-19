# Tareas por plantilla y bloques — Design Spec

**Owner:** David (@dacs-dev) — Interaction (assignments, activities, grading). Schema
lo absorbe David (contrato anti-bloqueo). Jorge revisa Identity/RBAC/tenancy.
**Branch:** `david` (sub-rama por slice) → `staging` → `master`
**Date:** 2026-09-19
**Status:** Accepted (2026-09-19)
**Producto (copy):** «Tarea». En código la instancia sigue siendo `Activity`.

Relacionado: [`docs/planning/LMS-redesign.md`](../../planning/LMS-redesign.md) §3,
[`docs/planning/David-B1-design.md`](../../planning/David-B1-design.md),
[`docs/planning/ui-language.md`](../../planning/ui-language.md).

---

## 1. Purpose

El profesor configura una tarea como **lista de bloques** (test, V/F, relacionar,
ordenar, huecos, respuesta corta, desarrollar, fichero, …), puede **guardar esa
receta como plantilla** y reutilizar tareas anteriores. El alumno ve y completa
un único reproductor. Las **notas persisten** en la instancia. El profesor decide
**qué instancias cuentan para la nota final**.

Hoy hay dos productos (`Assignment` = texto+ficheros; `Activity` = quiz de 6
tipos) y el gradebook solo mira el primero. Este spec unifica el ciclo crear →
resolver → evaluar sobre `Activity`, con plantillas y promedio configurable.

---

## 2. Constraints (hard)

- **No rename** de `Activity`/`Question`/`Attempt`/`Answer`. Producto = «Tarea»;
  persistencia = modelos actuales. Misma razón que B1: radio de rename = 0 pts.
- **No dual-write largo** con `Assignment`. O el script de migración tiene
  paridad de gradebook y se cortan los writes, o no se apaga lo viejo.
- **No borrar tablas `Assignment*`** en esta entrega. Tras el corte quedan
  read-only; drop = PR posterior.
- **Tenancy:** `organizationId` se deriva del curso / del usuario autenticado.
  El cliente no es fuente de verdad. Cross-org → 404 (no 403).
- **Staff de curso** = `STAFF_ROLES` ya usados (`TEACHER`/`ADMIN` globales o
  rol de curso `TEACHER`/`ASSISTANT`). Alumno nunca autoriza, nunca ve claves
  de corrección antes de enviar.
- **Validación cliente y servidor** en cada formulario. Design system
  `@/components/ui` (`docs/planning/ui-language.md`); sin estilos inline
  improvisados.
- **UI en español.** Cero errores de consola. Chrome latest.
- **Fuera de v1:** `LISTENING`/`SPEAKING` (el enum ya existe; no se implementan
  adaptadores), categorías ponderadas, rúbricas por criterio, peer review,
  hotspot, numérica. El registro deja el hueco.

---

## 3. Design decisions

| Tema | Decisión | Por qué |
|---|---|---|
| Enfoque | Registro de bloques + plantilla JSON, evolucionando `Activity` | Aprobado. Reutiliza graders/editor/player; añadir tipo = 1 adaptador |
| Tres objetos | Plantilla ≠ instancia (`Activity`) ≠ intento/nota | Reutilizar no pisa exámenes ni notas anteriores |
| Guardar anterior | Snapshot de bloques → `TaskTemplate`; «duplicar en curso» = nueva `Activity` | Las notas se quedan en la instancia origen |
| Nota final | `Activity.countsTowardFinal` boolean, default `true` | El profesor elige qué cuenta; no hay pesos/categorías en v1 |
| Persistencia de nota | Filas `Attempt`/`Answer` son la fuente de verdad. El promedio es una vista | Cambiar el flag no borra puntuaciones |
| `maxScore` | Siempre `sum(Question.points)` mantenido en columna | Un solo número; gradebook no recalcula en cada celda |
| Edición con intentos | Bloques 409; título/fechas/flag/status sí | Si no, las notas dejan de corresponder al enunciado |
| Borrado con intentos | `DELETE` → 409; `PATCH status=ARCHIVED` | Histórico de notas intacto |
| Quiz, varios intentos | Cuenta el **mejor** `GRADED` | Aprobado en brainstorm |
| Falta de entrega | Tras `closeAt` (o ahora si no hay `closeAt` y ya pasó `dueAt`) = 0 en el promedio; antes se omite | Convención LMS; evita media inflada a mitad de plazo |
| Adjuntos del enunciado | Join `ActivityFile` (análogo a `AssignmentFile`) | No son un bloque que el alumno complete |
| Ensayo / fichero | `QuestionKind.ESSAY` y `FILE_UPLOAD`, corrección manual | Absorben `Assignment` |
| Plantilla storage | JSON snapshot, no filas vivas | Instanciar hidrata `Question`; borrar receta no rompe instancias |
| Gradebook API | Sustituye columnas `assignments` por `items` de actividades | Rotura consciente; un solo cliente tras el corte |
| Rutas UI | Una superficie `/activities` (copy «Tareas»). `/assignments` redirige | Notificaciones antiguas `?assignmentId=` se resuelven en el corte o 404 limpio |

---

## 4. Information model

```
TaskTemplate (receta, sin alumnos)
    └── blocks Json  →  copiado a Question[] al instanciar

Activity (instancia en un Course)     ← producto: «Tarea»
    ├── countsTowardFinal
    ├── templateId?                  (procedencia; no vínculo vivo)
    ├── files ActivityFile[]         (enunciado del profesor)
    ├── questions Question[]         (bloques)
    └── attempts Attempt[]
            └── answers Answer[]     (nota persistida)
```

### 4.1 Prisma (aditivo)

```prisma
model TaskTemplate {
  id                String   @id @default(cuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdById       String
  createdBy         User     @relation("TaskTemplateAuthor", fields: [createdById], references: [id], onDelete: Cascade)
  title             String
  description       String?
  blocks            Json     // TaskTemplateBlock[]
  createdFromId     String?  // Activity.id de origen; no FK viva (la actividad puede archivarse)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([organizationId])
  @@index([createdById])
}

model ActivityFile {
  activityId String
  activity   Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  fileId     String
  file       File     @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@id([activityId, fileId])
  @@index([fileId])
}
```

En `Activity` añadir:

- `countsTowardFinal Boolean @default(true)`
- `templateId String?` (sin FK; trazabilidad)
- `feedback` no va aquí
- relación `files ActivityFile[]`

En `Attempt` añadir:

- `feedback String?` (comentario del profesor al alumno; hoy solo vive en `Submission.feedback`)

En `QuestionKind` añadir: `ESSAY`, `FILE_UPLOAD`.

Back-relations aditivas: `Organization.taskTemplates`, `User` `@relation("TaskTemplateAuthor")`,
`File` → `ActivityFile[]`. David aplica el schema; Aloiki/Jorge no tocan `prisma/`.

Forma de `blocks` en la plantilla (array ordenado):

```ts
type TaskTemplateBlock = {
  kind: QuestionKind;
  prompt: string;
  points: number;
  order: number;
  content: Record<string, unknown>;
};
```

No se copian: fechas, `status`, `countsTowardFinal`, intentos, ficheros de alumno,
`ActivityFile` (los bytes del enunciado no viajan en la receta; el profesor vuelve
a adjuntar si hace falta). `createdFromId` apunta a la actividad origen.

### 4.2 Content / response de los bloques nuevos

| kind | content | response | corrección |
|---|---|---|---|
| `ESSAY` | `{ minChars?: number, maxChars?: number }` | `{ text: string }` | Manual. Sin entrada en `GRADERS` |
| `FILE_UPLOAD` | `{ maxFiles: number, accept?: string[] }` (`maxFiles` ≥ 1; `accept` = MIME o extensiones, mismo criterio que `FilesService`) | `{ fileIds: string[] }` | Manual. Cada `fileId` debe existir, ser del alumno, de la misma org |

Los 6 kinds actuales no cambian de forma (`David-B1-design.md` §2).

### 4.3 `maxScore`

Tras cada alta/edición/borrado/reorder de `Question`, el servicio escribe
`Activity.maxScore = sum(points)`. Si no hay preguntas, `0`. El cliente puede
enviar `maxScore` en create/update: **se ignora**. Publicar con `maxScore === 0`
→ 400.

---

## 5. Block registry (seam)

Módulo interno `apps/backend/src/activities/blocks/`.

Interfaz (una, pequeña):

```ts
interface BlockKindAdapter {
  kind: QuestionKind;
  validateContent(content: unknown): asserts content is Record<string, unknown>;
  validateResponse(response: unknown): asserts response is Record<string, unknown>;
  /** Ausente ⇒ corrección manual. Puro; no tira: malformed → awarded 0. */
  grade?(content: unknown, response: unknown, points: number): {
    correct: boolean;
    awarded: number;
  };
}
```

`GRADERS` actual se convierte en el `grade` de los 6 objetivos. Registro
`BLOCK_ADAPTERS: Record<QuestionKind, BlockKindAdapter>`. Añadir un tipo =
adaptador backend + DTO + editor + render de alumno. El ciclo de intentos,
plantillas y gradebook **no** se tocan.

Frontend: mapa `kind → { Editor, Player }` en `features/activities/blocks/`.
Hoy vive mezclado en `QuestionContentEditor` / `ActivityPlayer`; se extrae al
añadir `ESSAY` y `FILE_UPLOAD` (el ensayo reusa `Textarea`; el fichero reusa
`FileUpload`).

---

## 6. Flows (normativos)

### 6.1 Profesor — crear

Tres entradas al mismo editor (`ActivitiesPage`, copy «Tareas»):

1. En blanco: `POST /courses/:courseId/activities` + `POST .../questions`.
2. Desde plantilla: `POST /courses/:courseId/activities` con `templateId`.
3. Desde tarea anterior: igual que (2) pero el origen es otra `Activity`
   (`sourceActivityId`). Copia bloques y puntos; **no** copia intentos, notas,
   fechas ni `countsTowardFinal` (default `true` en la nueva).

Configura título, descripción, ventana (`openAt ≤ dueAt ≤ closeAt`, misma
regla que `Assignment`), intentos (`0` = ilimitados), tiempo, flag
`countsTowardFinal`, adjuntos de enunciado. `DRAFT` → `PUBLISHED`.

Publicar con cero bloques → 400. Alumno no crea.

### 6.2 Profesor — biblioteca

**Plantillas** (org-scoped):

- **Leer / listar / instanciar:** cualquier staff de un curso de esa org
  (rol global `TEACHER`/`ADMIN`, o rol de curso `TEACHER`/`ASSISTANT`).
- **Crear / editar / borrar:** autor de la plantilla o `ADMIN` de la org.
- Instanciar exige además staff del **curso destino** y plantilla de la
  **misma** org (si no → 404).

- CRUD `/task-templates`
- «Guardar como plantilla»: `POST /activities/:id/save-as-template`
  `{ title?: string, description?: string }` → snapshot de `Question[]`.
  Título default = título de la actividad.

**Tareas anteriores:** `GET /me/teaching/activities` — instancias de cursos
donde el actor es staff, más recientes primero. Acciones de producto: ver
notas (gradebook filtrado / detalle), duplicar en curso (`sourceActivityId`),
guardar como plantilla.

Borrar plantilla: hard delete de la receta. Instancias ya creadas siguen.
Borrar actividad: §3 (409 si hay intentos; archivar).

### 6.3 Alumno — resolver

Lista: `GET /courses/:courseId/activities` — alumno solo `PUBLISHED` y no
`ARCHIVED`, sin claves (`correct` / `accepted` / `pairs` / `correctOrder`
stripped, igual que hoy).

Ventana: igual que submissions. Fuera → 400 en start/save/submit; UI bloquea.

1. `POST /activities/:id/attempts` → `IN_PROGRESS`.
2. `PATCH /attempts/:id` upsert de `Answer.response`.
3. `POST /attempts/:id/submit`: corre `grade` de cada bloque objetivo; subjetivos
   quedan `awarded = null`. Si **todos** tienen `awarded` → `GRADED` y
   `score = sum(awarded)`. Si falta alguno → `SUBMITTED`, `score` null hasta
   corrección. Emite `GRADE_PUBLISHED` solo al pasar a `GRADED`.
4. `attemptsAllowed`: no se crea un intento de más (carrera: unique
   `(activityId, userId, attemptNo)` + chequeo; 400 si se excede).
5. `countsTowardFinal = false`: el alumno **sí** ve su score/feedback; el
   promedio del curso no lo usa.

Claves de solución: solo tras enviar y solo si `config.showSolutions === true`
(default false). Staff siempre ve el content completo.

### 6.4 Profesor — evaluar

`GET /activities/:id/attempts` — todos los intentos del curso (staff).
Cola «por calificar» = intentos `SUBMITTED` (hay subjetivo pendiente).

`PATCH /attempts/:id/grade`:

```ts
{
  answers: { questionId: string; awarded: number; }[]; // bloques subjetivos
  feedback?: string; // Attempt.feedback
}
```

- `awarded` ∈ `[0, question.points]`.
- Solo questions sin grader, o con `awarded` aún null.
- Tras el patch: `Attempt.score = sum(Answer.awarded)` (objetivos ya
  rellenados en submit). Si todos tienen `awarded` → `GRADED` +
  `GRADE_PUBLISHED`. Si no → sigue `SUBMITTED`.

Migración de ensayos de un solo bloque: el script escribe `Answer.awarded`
igual a `Submission.score` (escala: el ESSAY lleva `points = Assignment.maxScore`).

Toggle `countsTowardFinal` vía `PATCH /activities/:id` **después** de calificar:
recalcula la vista del promedio; no toca filas `Attempt`.

### 6.5 Nota final

Para cada alumno matriculado `STUDENT` en el curso:

```
items = activities del curso donde status ∈ {PUBLISHED, ARCHIVED}
         y countsTowardFinal
         y (status ARCHIVED cuenta: fue real; DRAFT no)

por item:
  best = max(score) de attempts GRADED de ese alumno
  si best existe → ratio = best / maxScore          (maxScore > 0)
  else si closed  → ratio = 0
  else            → omitir

closed = now > closeAt, o (closeAt es null y dueAt != null y now > dueAt)
         si ambos null → no cerrado; omitir hasta que exista GRADED

final = average(ratios incluidos)   // null si el conjunto está vacío
```

El alumno ve cada ítem **PUBLISHED o ARCHIVED** (también práctica, marcada) +
`final` o «aún sin nota». Los `DRAFT` no aparecen. **Nunca 404** por «sin
calificaciones»: `200` con `items: []` y `final: null` si es miembro. 404 solo
curso inexistente o no miembro.

---

## 7. HTTP API

Auth: `AppAuthGuard` + `@CurrentUser()`. Org derivada del curso o del usuario.

### 7.1 Plantillas

| Método | Ruta | Quién | Efecto |
|---|---|---|---|
| `POST` | `/task-templates` | autor potencial: TEACHER/ADMIN de la org | Crea receta. Body: `{ title, description?, blocks }` (`blocks` validado por adaptador) |
| `GET` | `/task-templates` | staff de algún curso de la org | Lista de **su** org |
| `GET` | `/task-templates/:id` | staff de algún curso de la org | 404 si otra org |
| `PATCH` | `/task-templates/:id` | autor o ADMIN org | título/description/blocks |
| `DELETE` | `/task-templates/:id` | autor o ADMIN org | borra receta |
| `POST` | `/activities/:id/save-as-template` | staff del curso | snapshot; body opcional `{ title, description }` |

`POST /courses/:courseId/activities` se amplía:

```ts
{
  // campos actuales menos maxScore efectivo
  templateId?: string;        // copia blocks desde plantilla
  sourceActivityId?: string;  // copia blocks desde otra Activity de la misma org
  countsTowardFinal?: boolean; // default true
  fileIds?: string[];         // ActivityFile, validado org+uploader
}
```

`templateId` y `sourceActivityId` son mutuamente excluyentes → 400 si ambos.
La plantilla/fuente debe ser de la misma org que el curso destino → 404 si no.
El actor debe ser staff del curso destino.

### 7.2 Actividad (deltas)

- `PATCH /activities/:id` acepta `countsTowardFinal`, `fileIds` (replace o
  endpoints de fichero análogos a assignment). No acepta cambiar bloques
  implícitamente.
- Mutaciones de questions (`POST/PATCH/DELETE/reorder`) → **409** si existe
  al menos un `Attempt` de cualquier alumno.
- `DELETE /activities/:id` → 409 si hay attempts; si no, hard delete (cascade
  questions; files del enunciado no se borran del blob — política de huérfanos
  existente).
- `DELETE /activities/:id/files/:fileId` — staff, análogo a assignments.
- Alumno `GET` strip de claves: extender el strip a cualquier campo de
  `content` que el adaptador marque como secreto (hoy: `correct`, `accepted`,
  `pairs`, `correctOrder`, `answer`). `ESSAY`/`FILE_UPLOAD` no tienen secreto.

### 7.3 Intentos (deltas)

`PATCH /attempts/:id/grade` sustituye el body `{ score }` por el de §6.4.
El `{ score }` plano **deja de aceptarse** (el único cliente es nuestro SPA;
se actualiza a la vez).

### 7.4 Gradebook (rotura)

`GET /courses/:id/gradebook` y `GET /courses/:id/grades/me` y el CSV pasan a
actividades. Formas:

```ts
type GradebookItemDTO = {
  id: string;              // activityId
  title: string;
  maxScore: number;
  dueAt: string | null;
  closeAt: string | null;
  countsTowardFinal: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
};

type GradebookCellDTO = {
  activityId: string;
  attemptId: string | null; // mejor GRADED, o el SUBMITTED pendiente si no hay GRADED
  score: number | null;
  status: AttemptStatus | null; // null = sin intento
};

type GradebookDTO = {
  course: { id: string; title: string };
  items: GradebookItemDTO[];           // no DRAFT
  students: { user: SubmissionAuthorDTO; cells: GradebookCellDTO[]; final: number | null }[];
};

type MyGradeDTO = {
  activityId: string;
  title: string;
  maxScore: number;
  dueAt: string | null;
  countsTowardFinal: boolean;
  score: number | null;
  status: AttemptStatus | null;
  feedback: string | null;
  gradedAt: string | null;
};

type MyGradesDTO = {
  course: { id: string; title: string };
  items: MyGradeDTO[];
  final: number | null;
};
```

CSV: una columna por ítem (título), última columna `Nota final`. Las de
práctica se incluyen con encabezado sufijo ` (práctica)` y **no** entran en
`Nota final`. Solo el curso/org autorizados.

`GET /me/teaching/summary`: «por calificar» = intentos `SUBMITTED` de cursos
impartidos (ya no `Submission` SUBMITTED/LATE sin nota). Tras el corte no hay
writes a submissions.

`GET /me/teaching/activities`: lista para la biblioteca «anteriores».

```ts
type TeachingActivityDTO = {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  status: CourseStatus;
  countsTowardFinal: boolean;
  attemptCount: number;
  createdAt: string;
  dueAt: string | null;
};
```

---

## 8. Frontend

Componer `@/components/ui`. Copy:

| Antes | Después |
|---|---|
| nav «Tareas» + «Actividades» | una entrada **Tareas** → `/activities` |
| `/assignments` | `<Navigate to="/activities" replace />` |
| «Cuenta para la nota final» | switch en el form de instancia (no en la plantilla) |
| Badge práctica | `countsTowardFinal === false` |

Páginas:

- `ActivitiesPage` absorbe autoría + detalle + reproductor + lista de entregas
  (lo que hoy está en `AssignmentsPage` / `SubmissionsList` / `SubmissionForm`).
- Biblioteca: modal o ruta `/activities/templates` (staff TEACHER/ADMIN): tabs
  Plantillas | Anteriores.
- `ActivityForm`: flag, `fileIds`, ya no pide `maxScore`.
- `QuestionContentEditor` + player: casos `ESSAY`, `FILE_UPLOAD`.
- `GradebookPage` / `GradesPage` / `GradePanel`: `items`, `final`, práctica,
  `PATCH /attempts/:id/grade` (deja de hablar de `submissions/:id/grade`).
- `TeacherDashboard`: summary nuevo.

Estados vacíos: sin plantillas, sin tareas anteriores, sin pendientes de
calificar, alumno sin notas (`EmptyState`, no error).

DoD visual de `ui-language.md` en cada pantalla nueva/tocada.

---

## 9. Migration (`Assignment` → `Activity`)

Script idempotente `apps/backend/prisma/migrate-assignments-to-activities.ts`
(invocado una vez desde un comando documentado, p.ej. `pnpm --filter backend tsx prisma/migrate-assignments-to-activities.ts`;
**no** dentro del seed rutinario que ya puede crear las dos cosas).

Por cada `Assignment` **sin** `Activity` migrada (marca:
`Activity.templateId` no sirve; usar tabla auxiliar o campo
`Activity` `config.migratedFromAssignmentId`):

1. Crea `Activity`: mismo `courseId`, `title`, `description`, ventana,
   `attemptsAllowed = 1`, `status = PUBLISHED`, `countsTowardFinal = true`,
   `config = { migratedFromAssignmentId: assignment.id }`.
2. `ActivityFile` por cada `AssignmentFile`.
3. Un `Question` `ESSAY`, `prompt = description ?? title`, `points = maxScore`,
   `content = {}`.
4. Si existe al menos un `SubmissionFile` en cualquier entrega **o** el
   enunciado no basta: añadir `Question` `FILE_UPLOAD` con
   `points = 0`, `content = { maxFiles: 10 }`, para no perder ficheros de
   alumno. El score histórico vive entero en el ESSAY (`awarded = Submission.score`).
5. Por cada `Submission`: un `Attempt` (`attemptNo = 1`) con
   `status` `GRADED` si `score != null`, si no `SUBMITTED` (DRAFT de submission
   → `IN_PROGRESS`), `score`/`gradedById`/`gradedAt`/`feedback` copiados,
   `submittedAt = updatedAt`.
6. `Answer` ESSAY `{ text: submission.text ?? "" }` y, si hay ficheros,
   `Answer` FILE_UPLOAD `{ fileIds }`. `awarded` del ESSAY = `score` cuando
   estaba calificado.

Paridad **antes de cortar writes**:

- Para cada curso con assignments, serializar el gradebook viejo
  (assignmentId, userId, score, status) y el nuevo (activity migrada, userId,
  score, status GRADED/SUBMITTED).
- Deben coincidir las celdas con score. Status se mapea
  `GRADED→GRADED`, `SUBMITTED|LATE→SUBMITTED`, `DRAFT→IN_PROGRESS`.
- Test de integración carga fixtures y afirma paridad. Si falla, no se
  despliega el frontend unificado.

Corte:

1. Backend ya sirve gradebook nuevo (solo activities, incluidas migradas).
2. Frontend unificado en la misma PR de corte (o la inmediatamente siguiente
   en `staging`, sin dejar `staging` a medias: o las dos o ninguna).
3. `AssignmentsController` mutadores (`POST/PATCH/DELETE`) pasan a `410 Gone`
   (los GET pueden quedar un release para debug). Seed deja de crear
   `Assignment`; crea `Activity` ESSAY+FILE para el demo de «tarea simple».
4. Drop de tablas = fuera de este spec.

Seed demo: un quiz (ya existe) + una tarea ESSAY+FILE + una plantilla de org
«Examen mixto» (8 no hace falta: 2 MCQ + 1 MATCHING + 1 ESSAY basta para demo).

---

## 10. Errors

| Caso | HTTP | Cuerpo (mensaje estable, español en UI) |
|---|---|---|
| Publicar sin bloques / maxScore 0 | 400 | no se puede publicar vacía |
| `templateId` y `sourceActivityId` juntos | 400 | |
| Plantilla/fuente de otra org, o curso ajeno | 404 | |
| Mutar questions con attempts | 409 | la estructura está bloqueada |
| DELETE activity con attempts | 409 | archivar en su lugar |
| Start/save/submit fuera de ventana | 400 | (mensajes actuales de attempts) |
| `attemptsAllowed` excedido | 400 | |
| `awarded` fuera de `[0, points]` | 400 | |
| Grade de intento ajeno / alumno | 404 | |
| `fileIds` de FILE_UPLOAD inválidos | 400 | |
| `GET grades/me` sin notas | **200** `{ items: [], final: null }` | nunca 404 por vacío |
| No miembro del curso | 404 | |

Carreras: unique `(activityId, userId, attemptNo)` y `(assignmentId, userId)`
histórico. Start concurrente no crea dos intentos extra; el segundo pierde
el unique y se traduce a 400.

---

## 11. Testing / DoD

### Unidad

- Adaptadores `ESSAY` / `FILE_UPLOAD`: validate content/response (válido,
  malformado, `maxFiles`, MIME).
- Snapshot plantilla: `Question[]` → JSON → `Question[]` idéntico en
  kind/prompt/points/order/content.
- Promedio: cuenta / no cuenta / falta tras cierre = 0 / falta antes = omitir
  / mejor de N intentos / `maxScore` 0 no entra (actividad no publicable) /
  lista vacía → `final = null`.
- Strip de claves en GET alumno.

### Integración

- Instanciar plantilla o `sourceActivityId` **no** copia attempts.
- Toggle `countsTowardFinal` no borra `Attempt.score`.
- 409 al añadir pregunta con intento existente.
- 404 cross-org en templates y activities.
- Paridad script de migración (fixture con 2 alumnos, 1 graded, 1 submitted
  con fichero, 1 assignment sin entregas).
- `GET /courses/:id/grades/me` 200 vacío.

### E2E (Playwright, Compose/HTTPS, sin `x-dev-user`)

Cubre y sustituye el espíritu de `E2E-ASSIGN-*` y `E2E-ACTIVITY-*` en una
suite `tasks.spec.ts` (se pueden conservar los specs viejos hasta el corte,
luego borrar `assignments-authoring` que hable de Assignment API):

1. Profesor crea examen mixto (MCQ + MATCHING + ESSAY), publica, marca que
   cuenta. Alumno completa; MCQ/MATCHING auto; ESSAY pendiente; profesor
   califica; alumno ve nota; gradebook muestra `final`.
2. Guardar como plantilla → instanciar en el mismo u otro curso de la **misma**
   org → 0 intentos en la copia; el original conserva notas.
3. Duplicar tarea anterior (`sourceActivityId`) igual que (2).
4. Tarea con `countsTowardFinal=false`: alumno ve score; `final` del curso no
   cambia al calificarla.
5. Fuera de ventana: UI + API 400. Alumno no ve claves antes de enviar.
6. Tenant: profesor org-b no lee plantilla ni actividad de org-a (404).

DoD de pantalla (todas las tocadas): design system, responsive, vacío/carga/error,
sin mock, validación ambos lados, a11y básica, cero errores de consola.

---

## 12. Out of scope (explícito)

- Adaptadores LISTENING, SPEAKING, numérica, hotspot, Likert, peer review.
- Categorías ponderadas (exámenes 80% / deberes 20%). El flag basta.
- Feedback por bloque / rúbrica.
- Compartir plantillas entre organizaciones.
- Copiar `ActivityFile` bytes a la plantilla.
- Drop de `Assignment` / `Submission` / `SubmissionFile` / `AssignmentFile`.
- Notificación `NEW_ACTIVITY` al publicar (se sigue reusando `GRADE_PUBLISHED`).
- Rename de tablas Prisma a `Task`.

---

## 13. Implementation slices (para el plan; no son PRs obligatorias aparte)

Orden vertical, cada uno deja el sistema usable:

1. Schema aditivo + registro de bloques + `ESSAY`/`FILE_UPLOAD` + lock 409 +
   `countsTowardFinal` + `Attempt.feedback` + `maxScore` derivado.
2. Templates CRUD + save-as + instantiate + teaching-activities list.
3. Gradebook/my-grades/CSV/summary sobre `Attempt` + fórmula de `final` + 200
   vacío. (Mientras no corra la migración, el gradebook **no** incluye
   assignments: el slice 4 sale en el mismo tren a `staging`.)
4. Script de migración + paridad + seed sin `Assignment` nuevo + 410 en writes
   de assignments.
5. Frontend unificado (tareas, biblioteca, player, gradebook, redirects) + E2E.

Slices 3–5 se fusionan a `staging` juntos si 3 deja el gradebook ciego a
assignments no migrados. Alternativa permitida: slice 3 une **temporalmente**
assignments no migrados y activities en el mismo DTO `items` (discriminator
interno, no expuesto más de una PR). Preferencia: **migración en el mismo
tren** que el gradebook nuevo, para no diseñar un DTO híbrido.

---

## 14. Spec self-review

- Placeholders: ninguno.
- Consistencia: instancia = `Activity`; plantilla = `TaskTemplate`; nota =
  `Attempt`; flag solo en instancia; gradebook no lee `Submission` tras el corte.
- Alcance: un spec, cinco slices; el plan de implementación desglosa tareas.
- Ambigüedades cerradas: mejor intento; falta tras cierre = 0; ASSISTANT
  lista e instancia plantillas de su org pero no las edita/borra; `maxScore`
  derivado; `{ score }` plano de grade desaparece; 410 en writes de assignment
  tras corte; `grades/me` solo PUBLISHED/ARCHIVED.
