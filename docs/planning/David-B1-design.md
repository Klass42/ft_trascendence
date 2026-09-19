# David — B1: Motor de Actividades (diseño backend)

> Fase B (LMS-redesign §3/§4). **Design-first**: este doc es el plan; nada de `prisma/` se toca hasta
> que el owner apruebe el esquema. Rama `david` → `staging`. Contexto: [`LMS-redesign.md`](./LMS-redesign.md).
>
> **Estado 2026-09-19:** B1 (motor aditivo, `Assignment` intacto como MANUAL) quedó **supersedido**
> para el producto unificado. No hubo rename de modelos: instancia = `Activity`; ensayo/fichero =
> `ESSAY`/`FILE_UPLOAD`; writes de assignment → 410. Guía: [`task-templates.md`](./task-templates.md).
> Spec: [`../superpowers/specs/2026-09-19-task-templates-design.md`](../superpowers/specs/2026-09-19-task-templates-design.md).

## 0. Decisión de arquitectura: **additive, NO rename**

§3 dice "generalizar `Assignment` → `Activity`". Hay dos formas de leerlo:

- **(A) Renombrar** `Assignment`→`Activity` con `type`. Toca assignments/submissions/grading/analytics/
  notifications + hooks/features del frontend (assignments, gradebook, grades, analytics) + E2E + seed.
  Radio enorme, y la deriva de migraciones (la app arranca con `db push`, hay un `_init` viejo) hace el
  rename aún más frágil. **Riesgo alto de media-construcción = 0 puntos.**
- **(B) Aditivo (elegido).** `Assignment`/`Submission` se quedan **intactos** = el tipo **MANUAL** (ya
  completo: A7 ventana, ficheros, grading, analytics). Se añade un módulo **`activities/`** paralelo y
  auto-contenido para las actividades auto-corregibles (QUIZ y sus tipos de pregunta). La
  "generalización" es conceptual y vive en el **frontend** (B2): una pestaña **"Actividades"** que lista
  tanto Assignments(MANUAL) como Activities(auto). Honra el §3 ("Reusa/Submission para MANUAL") y el
  guardarraíl "media construida = 0".

`Submission` hoy solo lo referencian módulos de David (analytics, assignments, grading, submissions) →
el radio de B está contenido en mi dominio; no bloquea a Aloiki/Jorge.

## 1. Esquema propuesto (Prisma) — 4 modelos + 3 enums nuevos

Modelos **nuevos**; `Assignment`/`Submission` sin cambios. Se reutiliza `CourseStatus`
(DRAFT/PUBLISHED/ARCHIVED) para el estado de la actividad.

```prisma
enum ActivityType {
  QUIZ        // conjunto de preguntas auto-corregibles
  LISTENING   // audio + preguntas (B4 media)
  SPEAKING    // grabar audio → corrección manual/IA (B4 media)
}

enum QuestionKind {
  MULTIPLE_CHOICE
  TRUE_FALSE
  FILL_BLANK
  MATCHING
  ORDERING
  SHORT_ANSWER
}

enum AttemptStatus {
  IN_PROGRESS   // iniciado, sin enviar
  SUBMITTED     // enviado; objetivas auto-corregidas; pendiente lo manual (si lo hay)
  GRADED        // nota final disponible
}

model Activity {
  id              String       @id @default(cuid())
  courseId        String
  course          Course       @relation(fields: [courseId], references: [id], onDelete: Cascade)
  type            ActivityType @default(QUIZ)
  title           String
  description     String?
  openAt          DateTime?    // misma semántica que Assignment (ventana)
  dueAt           DateTime?
  closeAt         DateTime?
  maxScore        Float        @default(100)
  attemptsAllowed Int          @default(1)    // 0 = ilimitados
  timeLimitSec    Int?                          // null = sin límite
  config          Json         @default("{}")  // { shuffleQuestions, shuffleOptions, showSolutions } (DTO)
  status          CourseStatus @default(DRAFT)  // DRAFT/PUBLISHED/ARCHIVED
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  questions Question[]
  attempts  Attempt[]

  @@index([courseId])
}

model Question {
  id         String       @id @default(cuid())
  activityId String
  activity   Activity     @relation(fields: [activityId], references: [id], onDelete: Cascade)
  kind       QuestionKind
  prompt     String
  points     Float        @default(1)
  order      Int          @default(0)
  content    Json         // forma depende de `kind` (opciones/huecos/pares/aceptadas…) — validado por DTO
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  answers Answer[]

  @@index([activityId])
}

model Attempt {
  id          String        @id @default(cuid())
  activityId  String
  activity    Activity      @relation(fields: [activityId], references: [id], onDelete: Cascade)
  userId      String
  user        User          @relation("AttemptUser", fields: [userId], references: [id], onDelete: Cascade)
  attemptNo   Int           @default(1)   // 1-based; se valida contra attemptsAllowed
  status      AttemptStatus @default(IN_PROGRESS)
  startedAt   DateTime      @default(now())
  submittedAt DateTime?
  score       Float?
  gradedById  String?
  gradedBy    User?         @relation("AttemptGrader", fields: [gradedById], references: [id], onDelete: SetNull)
  gradedAt    DateTime?

  answers Answer[]

  @@unique([activityId, userId, attemptNo])
  @@index([userId])
}

model Answer {
  id         String   @id @default(cuid())
  attemptId  String
  attempt    Attempt  @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  questionId String
  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  response   Json     // respuesta cruda del alumno (forma por kind)
  correct    Boolean? // null = no auto-corregida (subjetiva/pendiente)
  awarded    Float?   // puntos otorgados
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([attemptId, questionId])
}
```

**Back-relations necesarias** (Prisma exige ambos lados):
- `Course` (Aloiki) += `activities Activity[]`
- `User` (Jorge) += `attempts Attempt[] @relation("AttemptUser")` y `gradedAttempts Attempt[] @relation("AttemptGrader")`

Son campos aditivos de relación (sin cambio de comportamiento). Por el contrato anti-bloqueo, **David
absorbe los cambios de schema**; se aplica por el `db push` del arranque (igual que la Fase A). Flag a
Aloiki/Jorge en el PR.

## 2. Formas de `content`/`response` por `kind` (validadas por DTO)

| kind | content | response | corrección |
|---|---|---|---|
| MULTIPLE_CHOICE | `{ options: string[], correct: number[] }` | `{ selected: number[] }` | set de índices == correct (o crédito parcial si `config.partial`) |
| TRUE_FALSE | `{ answer: boolean }` | `{ value: boolean }` | igualdad |
| FILL_BLANK | `{ blanks: { accepted: string[] }[], caseSensitive?, normalize? }` | `{ values: string[] }` | por hueco: normaliza (trim/lower/colapsa espacios) y match contra `accepted` (sinónimos); crédito parcial por hueco |
| MATCHING | `{ left: string[], right: string[], pairs: [number,number][] }` | `{ pairs: [number,number][] }` | pares correctos / total (parcial) |
| ORDERING | `{ items: string[], correctOrder: number[] }` | `{ order: number[] }` | orden exacto (o Kendall parcial, opcional) |
| SHORT_ANSWER | `{ accepted: string[], normalize? }` | `{ text: string }` | match normalizado; **si `accepted` vacío ⇒ manual** |

**Normalización** (helper compartido): `trim` → colapsa espacios → `toLowerCase` (salvo `caseSensitive`)
→ (opcional) quita tildes. Reutilizable por FILL_BLANK/SHORT_ANSWER/MATCHING textual.

## 3. Motor de corrección

`activities/grading/graders/` — **una función pura por kind**:
`(content, response, points) => { correct: boolean; awarded: number }`. Registro `GRADERS[kind]`.
- Al **submit** de un Attempt: corre el grader de cada pregunta objetiva → escribe `Answer.correct/awarded`.
- Si **todas** las preguntas son objetivas ⇒ `Attempt.status = GRADED`, `score = Σawarded` normalizado a
  `maxScore`, emite `GRADE_PUBLISHED` al alumno.
- Si hay alguna **subjetiva** (SHORT_ANSWER sin `accepted`, SPEAKING) ⇒ `SUBMITTED`; el staff corrige
  luego (`PATCH /attempts/:id/grade`) y ahí pasa a `GRADED` + emite.

Añadir un tipo nuevo = **1 DTO + 1 grader + (frontend) 1 editor + 1 render** (patrón repetible, apto
para modelos pequeños). Es la plantilla del §3/§6.

## 4. Endpoints (módulo `activities/`, decoupled)

**Autoría (staff, `STAFF_ROLES`):**
- `POST   /courses/:courseId/activities`
- `GET    /courses/:courseId/activities`  (miembros; alumno solo PUBLISHED, sin clave de respuestas)
- `GET    /activities/:id`                (vista alumno oculta `correct`/`accepted`; staff completa)
- `PATCH  /activities/:id`  · `DELETE /activities/:id`
- `POST   /activities/:id/questions` · `PATCH /questions/:id` · `DELETE /questions/:id`
- `PATCH  /activities/:id/questions/reorder`  (lista de ids)

**Intentos (alumno miembro):**
- `POST   /activities/:id/attempts`        (start: exige PUBLISHED + ventana + `attemptsAllowed`; crea IN_PROGRESS)
- `PATCH  /attempts/:id`                   (guardar respuestas; solo dueño + IN_PROGRESS; upsert de Answers)
- `POST   /attempts/:id/submit`            (finaliza: corrige, calcula score, set status, emite)
- `GET    /activities/:id/attempts/me`     (mis intentos + resultados; oculta solución salvo `showSolutions`)

**Corrección manual (staff):**
- `GET    /activities/:id/attempts`        (todos los intentos)
- `PATCH  /attempts/:id/grade`             (nota manual de subjetivas → GRADED + emite)

Tenancy/RBAC: se **replica el gate de membresía** (`requireMembership`/`STAFF_ROLES`, org derivada del
Course) como ya hacen forums/analytics, con `// TODO(shared): CourseMembershipService`. El alumno nunca
recibe las claves de respuesta antes de enviar.

## 5. Notificaciones

B1 reutiliza el enum existente (sin churn): `GRADE_PUBLISHED` al auto/manual-corregir (link
`/activities?activityId=…`). *(Opcional futuro: `NEW_ACTIVITY` al publicar — requiere añadir al enum
`NotificationType`; lo dejo fuera de B1.)*

## 6. Wiring + tests

- Módulo nuevo `apps/backend/src/activities/` registrado en `app.module.ts`; `PrismaService` global;
  importa `NotificationsModule`. Cero acoplamiento con AssignmentsModule.
- **Tests:** unit por grader (correcto/parcial/incorrecto/normalización/sinónimos/bordes); ciclo de
  Attempt (ventana, `attemptsAllowed`, submit calcula score, re-submit bloqueado); RBAC/tenancy (no
  miembro 404, alumno no autoriza, staff-only grade, alumno no ve claves antes de enviar). Objetivo:
  mantener la suite verde (hoy 131/131) sumando los nuevos.

## 7. Alcance de la PR de B1 (una PR a staging)

**Solo backend**: schema + módulo `activities/` + graders (los 6 tipos objetivos) + ciclo de intentos +
tests. `Assignment`/MANUAL intactos. **Frontend (autoría + reproductor del alumno) = B2/B3**, épicas
aparte. Media = stretch B4.

## 8. Decisiones que necesito del owner (antes de tocar prisma)

1. **¿Additive (B) confirmado?** (recomendado) vs rename-generalize (A, arriesgado).
2. **¿B1 incluye los 6 tipos objetivos** de una, o arranco con 4 (MCQ, V/F, FILL_BLANK, SHORT_ANSWER) y
   MATCHING/ORDERING en follow-up? (recomiendo los 6: son funciones puras baratas y dejan el frontend
   como único trabajo restante.)
3. **Notificaciones:** reutilizar `GRADE_PUBLISHED` en B1 (recomendado) vs añadir `NEW_ACTIVITY` ya.
