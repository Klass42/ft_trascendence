# Diagramas — Klass / ft_trascendence

Vista del LMS a 2026-09-20. El copy de producto es **«Tarea»**; en Prisma y Nest la instancia sigue llamándose `Activity`. Las escrituras a `Assignment` / `Submission` responden **410**; las tablas siguen por GET y por la migración.

Fuente de verdad del esquema: [`apps/backend/prisma/schema.prisma`](../apps/backend/prisma/schema.prisma).  
Ciclo de tareas: [`planning/task-templates.md`](./planning/task-templates.md).

---

## 1. Base de datos

### 1.1 Mapa de dominios

```mermaid
flowchart TB
  subgraph tenancy["Tenancy e identidad"]
    Organization
    User
    Session
    OAuthAccount
    Friendship
    OrganizationInvitation
    AuditLog
  end

  subgraph content["Cursos y contenido"]
    Course
    Subject
    CourseMembership
    SubjectStaff
    Section
    Lesson
    LearningResource
  end

  subgraph tasks["Tareas y notas — producto actual"]
    TaskTemplate
    Activity
    Question
    Attempt
    Answer
  end

  subgraph legacy["Entrega manual — solo lectura / 410"]
    Assignment
    Submission
  end

  subgraph rest["Resto"]
    File
    ForumThread
    Notification
  end

  Organization --> User
  Organization --> Course
  Organization --> Subject
  Organization --> TaskTemplate
  Organization --> File
  User --> CourseMembership
  User --> SubjectStaff
  Course --> Subject
  Course --> CourseMembership
  Subject --> SubjectStaff
  Subject --> Activity
  Subject --> Assignment
  Activity --> Question
  Activity --> Attempt
  Attempt --> Answer
  Question --> Answer
  Assignment --> Submission
```

Tenancy: `organizationId` en org, usuario, fichero y plantilla. El resto se aísla **en la app** (via curso → org), no con RLS de Postgres.

### 1.2 ER — núcleo (org, curso, fichero)

```mermaid
erDiagram
  Organization ||--o{ User : members
  Organization ||--o{ Course : cohorts
  Organization ||--o{ Subject : subjects
  Organization ||--o{ File : stores
  Organization ||--o{ TaskTemplate : recipes
  Organization ||--o{ LearningResource : library

  User ||--o{ CourseMembership : "student of cohort"
  User ||--o{ SubjectStaff : "teaches subject"
  User ||--o{ Session : sessions
  User ||--o{ Friendship : friends
  User ||--o{ Notification : inbox
  User ||--o{ OAuthAccount : "login Google"
  Organization ||--o{ OrganizationInvitation : invites
  Organization ||--o{ AuditLog : audit
  Organization ||--o{ ResourceFolder : carpetas
  ResourceFolder ||--o{ ResourceFolder : subcarpetas
  ResourceFolder ||--o{ LearningResource : contiene
  ResourceFolder ||--o{ SubjectFolder : "asignada a"
  Subject ||--o{ SubjectFolder : carpetas
  LearningResource ||--o{ SubjectResource : "publicado en"
  File |o--o{ LearningResource : fichero

  Course ||--o{ Subject : contains
  Course ||--o{ CourseMembership : roster
  Subject ||--o{ SubjectStaff : staff
  Subject ||--o{ Section : outline
  Subject ||--o{ Activity : tasks
  Subject ||--o{ Assignment : legacy
  Subject ||--o{ ForumThread : forum
  Subject ||--o{ SubjectResource : library

  Section ||--o{ Lesson : lessons
  Lesson ||--o{ LessonCompletion : done
  File ||--o{ ActivityFile : prompt
  File ||--o{ LessonAttachment : attach

  Organization {
    string id PK
    string slug UK
    string name
    string status
    string plan "OrganizationPlan"
    int maxUsers "nullable"
    int maxCourses "nullable"
    int maxStorageMb "nullable"
  }
  User {
    string id PK
    string organizationId FK "nullable"
    string email
    string passwordHash "nullable (solo OAuth)"
    string role
    string platformRole
    datetime emailVerifiedAt "nullable"
    string preferredLanguage
  }
  OAuthAccount {
    string id PK
    string userId FK
    string provider "google"
    string providerUserId
  }
  OrganizationInvitation {
    string id PK
    string organizationId FK
    string email
    string role
    string tokenHash UK
    string status
    datetime expiresAt
  }
  AuditLog {
    string id PK
    string actorId FK "nullable"
    string organizationId FK "nullable"
    string action
    json metadata
  }
  ResourceFolder {
    string id PK
    string organizationId FK
    string parentId FK "nullable"
    string name
  }
  SubjectFolder {
    string folderId FK
    string subjectId FK
    bool required
  }
  LearningResource {
    string id PK
    string organizationId FK
    string folderId FK "nullable"
    string fileId FK "nullable"
    string externalUrl "nullable"
    string type
    string status
  }
  SubjectResource {
    string resourceId FK
    string subjectId FK
    int order
    bool required
  }
  Course {
    string id PK
    string organizationId FK
    string name
    string academicYear
    string status "PLANNED ACTIVE ARCHIVED"
  }
  Subject {
    string id PK
    string organizationId FK
    string courseId FK
    string title
    string status "DRAFT PUBLISHED ARCHIVED"
  }
  CourseMembership {
    string id PK
    string courseId FK
    string userId FK
  }
  SubjectStaff {
    string id PK
    string subjectId FK
    string userId FK
    string role "TEACHER ASSISTANT"
  }
  File {
    string id PK
    string organizationId FK
    string bucket
    string objectKey
  }
```

Los bytes no viven en Postgres: `File` es `bucket` + `objectKey` (Garage/S3 o disco local).

Biblioteca: `Organization → ResourceFolder (anidable por parentId) → LearningResource`. Una carpeta se asigna a asignaturas con `SubjectFolder`; un recurso suelto se publica en asignaturas con `SubjectResource`. El recurso apunta a un `File` subido o a una `externalUrl`.

### 1.3 ER — tareas, plantillas y notas

Tres objetos que no se mezclan: **plantilla** (receta), **actividad** (instancia en un curso), **intento** (nota del alumno).

```mermaid
erDiagram
  Organization ||--o{ TaskTemplate : owns
  User ||--o{ TaskTemplate : authors
  Subject ||--o{ Activity : publishes
  Activity ||--o{ Question : blocks
  Activity ||--o{ Attempt : attempts
  Activity ||--o{ ActivityFile : promptFiles
  File ||--o{ ActivityFile : referenced
  Question ||--o{ Answer : answers
  Attempt ||--o{ Answer : contains
  User ||--o{ Attempt : student
  User ||--o{ Attempt : grader

  TaskTemplate {
    string id PK
    string organizationId FK
    string createdById FK
    string title
    json blocks
    string createdFromId "Activity.id, sin FK"
  }
  Activity {
    string id PK
    string subjectId FK
    string title
    string status "DRAFT PUBLISHED ARCHIVED"
    boolean countsTowardFinal
    string templateId "procedencia, sin FK"
    float maxScore "sum Question.points"
    int attemptsAllowed
  }
  Question {
    string id PK
    string activityId FK
    string kind
    string prompt
    float points
    int order
    json content
  }
  Attempt {
    string id PK
    string activityId FK
    string userId FK
    int attemptNo
    string status "IN_PROGRESS SUBMITTED GRADED"
    float score
    string feedback
  }
  Answer {
    string id PK
    string attemptId FK
    string questionId FK
    json response
    boolean correct
    float awarded
  }
  ActivityFile {
    string activityId PK
    string fileId PK
  }
```

`Question.kind`: `MULTIPLE_CHOICE`, `TRUE_FALSE`, `FILL_BLANK`, `MATCHING`, `ORDERING`, `SHORT_ANSWER`, `ESSAY`, `FILE_UPLOAD`.  
`LISTENING` / `SPEAKING` están en `ActivityType` y no tienen adaptador aún.

`Assignment` / `Submission` / `AssignmentFile` / `SubmissionFile` siguen en el esquema (GET). Las mutaciones HTTP son 410.

---

## 2. Componentes

### 2.1 Contenedores (runtime)

```mermaid
flowchart LR
  Browser["SPA Vite + React<br/>apps/frontend"]
  Caddy["Caddy · HTTPS"]
  API["NestJS<br/>apps/backend"]
  PG[("PostgreSQL")]
  Store["Garage / S3<br/>o disco local"]
  OTel["OTel · Prometheus<br/>Grafana"]

  Browser --> Caddy
  Caddy --> API
  Caddy --> Browser
  API --> PG
  API --> Store
  API --> OTel
  Browser -.->|"WebSocket notificaciones / presencia"| API
```

En local sin proxy la SPA habla con el API en `:3000`. Compose: Caddy termina TLS.

### 2.2 Módulos Nest y dueños

```mermaid
flowchart TB
  subgraph jorge["Jorge — Identity"]
    Auth
    Users
    Friendships["users/friendships"]
    Organizations
    Platform
    CommonAuth["common/auth"]
  end

  subgraph aloiki["Aloiki — Content"]
    Courses
    Enrollments["courses/enrollments"]
    Sections["courses/sections"]
    Lessons["courses/lessons"]
    Files
    Resources
  end

  subgraph david["David — Interaction"]
    Activities
    Templates["activities/templates"]
    Attempts["activities/attempts"]
    Blocks["activities/blocks"]
    Assignments["assignments · 410 writes"]
    Grading["assignments/grading"]
    Forums
    Notifications
    Realtime
    Analytics
  end

  subgraph shared["Compartido"]
    Prisma
    Telemetry
    Bus(("EventEmitter2"))
  end

  CommonAuth --> Auth
  Activities --> Blocks
  Activities --> Templates
  Activities --> Attempts
  Attempts --> Blocks
  Attempts -. "evento" .-> Bus
  Notifications -- "emit" --> Bus
  Bus -. "notification.created" .-> Realtime
  Users --> Friendships
  Courses --> Enrollments
  Courses --> Sections
  Sections --> Lessons
  Grading --> Activities
  Grading --> Attempts
  Courses --> Files
  Activities --> Files
```

Frontend (mismas superficies): `features/activities` (Tareas + biblioteca + reproductor), `gradebook`, `grades`, `courses`, `auth`, `org`, `forums`, `notifications`, `dashboard`, `admin`, `platform`, `profile`, `resources`, `friends`, `presence`, `legal`, `analytics`. `/assignments` redirige a `/activities`.

### 2.3 Registro de bloques (seam)

Añadir un tipo de pregunta = un adaptador. El ciclo crear → intentar → calificar no se toca.

```mermaid
flowchart LR
  subgraph iface["BlockKindAdapter"]
    VC[validateContent]
    VR[validateResponse]
    G["grade? — ausente = manual"]
  end

  Registry["getAdapter(kind)"]
  Registry --> MCQ
  Registry --> TF[TRUE_FALSE]
  Registry --> FB[FILL_BLANK]
  Registry --> MAT[MATCHING]
  Registry --> ORD[ORDERING]
  Registry --> SA[SHORT_ANSWER]
  Registry --> ESSAY
  Registry --> FILE[FILE_UPLOAD]

  MCQ --> G
  TF --> G
  FB --> G
  MAT --> G
  ORD --> G
  SA --> G
  ESSAY --> VC
  FILE --> VC
```

Editor y reproductor en el frontend: `kind → { Editor, Player }`.

---

## 3. Flujos

### 3.1 Ciclo de una tarea (profesor + alumno)

```mermaid
flowchart TD
  start([Profesor en el curso]) --> choose{¿Origen?}
  choose -->|En blanco| edit[Editor de bloques]
  choose -->|Plantilla| instT["POST activities<br/>templateId"]
  choose -->|Tarea anterior| instS["POST activities<br/>sourceActivityId"]
  instT --> edit
  instS --> edit
  edit --> draft[DRAFT]
  draft --> pub{¿Publicar?}
  pub -->|0 bloques| err400[400 vacía]
  pub -->|OK| published[PUBLISHED]
  published --> student[Alumno ve la tarea]
  student --> window{¿Dentro de ventana?}
  window -->|No| errWin[400 / UI bloqueada]
  window -->|Sí| startA["POST attempts"]
  startA --> progress[IN_PROGRESS]
  progress --> save["PATCH answers"]
  save --> progress
  progress --> submit["POST submit"]
  submit --> auto[Graders objetivos]
  auto --> pending{¿Queda subjetivo?}
  pending -->|No| graded[GRADED + notificación]
  pending -->|Sí| submitted[SUBMITTED]
  submitted --> teacherGrade["PATCH attempts/:id/grade"]
  teacherGrade --> graded
  graded --> book[Libro de notas / mis notas]
  book --> final["final = promedio de<br/>countsTowardFinal"]
```

Instanciar o guardar como plantilla **copia bloques**, no intentos ni notas. Con intentos ya existentes, mutar bloques → **409**; título, fechas y `countsTowardFinal` sí.

### 3.2 Secuencia: examen mixto (test + desarrollar)

```mermaid
sequenceDiagram
  actor P as Profesor
  actor A as Alumno
  participant API as Nest activities/attempts
  participant G as Block registry
  participant N as Notifications

  P->>API: POST /courses/:id/activities
  P->>API: POST questions MCQ + MATCHING + ESSAY
  P->>API: PATCH status=PUBLISHED
  A->>API: POST /activities/:id/attempts
  API-->>A: Attempt IN_PROGRESS
  A->>API: PATCH answers
  A->>API: POST /attempts/:id/submit
  API->>G: grade MCQ, MATCHING
  G-->>API: awarded
  Note over API: ESSAY sin grader → awarded null
  API-->>A: SUBMITTED
  P->>API: GET /activities/:id/attempts
  P->>API: PATCH grade answers ESSAY awarded
  API->>N: GRADE_PUBLISHED
  API-->>A: GRADED score = sum awarded
  P->>API: GET /courses/:id/gradebook
  API-->>P: items + cells + final
```

### 3.3 Nota final (vista, no columna guardada)

```mermaid
flowchart TD
  items["Actividades PUBLISHED o ARCHIVED<br/>del curso"] --> filter{"countsTowardFinal?"}
  filter -->|false · práctica| skip[No entra en final<br/>el alumno sí ve su score]
  filter -->|true| best["Mejor Attempt GRADED<br/>de ese alumno"]
  best --> has{¿Hay nota?}
  has -->|Sí| ratio["score / maxScore"]
  has -->|No y ya cerró| zero["ratio = 0"]
  has -->|No y aún abierta| omit[Omitir]
  ratio --> avg["final = media de ratios"]
  zero --> avg
  omit --> avg
  avg --> ui["Gradebook · Mis notas · CSV"]
```

Cerrado = `now > closeAt`, o si no hay `closeAt` y `now > dueAt`. Ambos null → no cerrado.

### 3.4 Plantillas (guardar y reutilizar)

```mermaid
flowchart LR
  act[Activity + Question] -->|save-as-template| snap["TaskTemplate.blocks JSON"]
  snap -->|instantiate templateId| copy["Nueva Activity + Question<br/>intentos vacíos"]
  old[Activity anterior] -->|sourceActivityId| copy
  snap -.->|borrar receta| gone[Plantilla desaparece]
  gone -.->|no toca| copy
```

RBAC breve: listar/instanciar plantillas = staff de algún curso de la org. Editar/borrar = autor o `ADMIN` de la org. Instanciar exige staff del **curso destino**. Cross-org → 404.

---

### 3.5 Autenticación: login, refresh, logout y recuperación

```mermaid
sequenceDiagram
  actor U as Usuario
  participant F as Frontend
  participant A as AuthController
  participant DB as Postgres
  U->>F: email + contraseña
  F->>A: POST /auth/login
  A->>DB: User + bcrypt, crea Session
  A-->>F: access JWT (15 min) + refresh JWT (7 d, jti = Session)
  F->>A: POST /auth/refresh
  A->>DB: rota la Session (la vieja se invalida)
  A-->>F: nuevo par de tokens
  F->>A: POST /auth/logout
  A->>DB: borra la Session
```

```mermaid
sequenceDiagram
  actor U as Usuario
  participant A as Auth
  participant N as Notificaciones
  actor Ad as Admin de la org
  U->>A: POST /auth/forgot-password (email)
  A-->>U: misma respuesta exista o no (anti-enumeración)
  A->>N: avisa a los admins (sin SMTP)
  Ad->>A: POST /auth/admin/users/:id/password-reset
  A-->>Ad: enlace con JWT purpose=password-reset
  Ad-->>U: le pasa el enlace
  U->>A: POST /auth/password-reset (token + nueva)
  A->>A: verifica firma, caducidad y huella del hash
  A-->>U: contraseña cambiada; el enlace ya no vale
```

No hay tabla de reset: el token es un JWT firmado que lleva una huella del `passwordHash` actual, así que al cambiar la contraseña deja de ser válido (un solo uso). Las invitaciones sí se guardan (`OrganizationInvitation.tokenHash`) y se aceptan con `POST /auth/invitations/:token/accept`. Google OAuth usa un `state` firmado y el botón solo aparece si hay `GOOGLE_CLIENT_ID`.

## Cómo verlos

GitHub, GitLab y Obsidian renderizan los bloques `mermaid`. En local: extensión Markdown Preview Mermaid, o [mermaid.live](https://mermaid.live) pegando un bloque.
