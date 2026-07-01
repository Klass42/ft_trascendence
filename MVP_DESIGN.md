# ft_transcendence — Diseno MVP: Sistema Academico Modular

> **Decision tomada**: LMS moderno como core, con modulos independientes
> (AI Tutor, Aula Virtual, SIS) que se acoplan posteriormente.
>
> **Equipo**: 3 personas actuales + 1 por encontrar (4 total).
> **Timeline**: 3 semanas, ~5h/dia, con IA asistida.
> **Fecha de inicio estimada**: Julio 2026.

---

## 1. Vision del producto

### Pitch (1 linea)
"Un LMS moderno, modular y escalable que resuelve los problemas cronicos
de Moodle: UX intuitiva, real-time, y preparado para IA."

### Pitch (30 segundos)
"Moodle domina la educacion por defecto pero genera frustracion: interfaz
anticuada, lentitud, curva de aprendizaje alta, y cero inteligencia.
Construimos un LMS cloud-first con UX moderna donde profesores crean
cursos en minutos, alumnos acceden a contenido con un click, y todo se
actualiza en tiempo real. La arquitectura modular permite acoplar despues
un tutor IA por alumno, videoconferencias integradas, y gestion academica
completa (matriculas, expedientes, calificaciones oficiales). Pensado
para el mercado hispanohablante donde Moodle es el unico referente y
Canvas/Blackboard son inalcanzables por precio."

### Diferenciador vs Moodle
| Moodle | Nuestro LMS |
|--------|-------------|
| PHP monolitico legacy | Node.js/TypeScript modular |
| Interfaz de 2010 | UX moderna, responsive-first |
| Plugins que rompen entre versiones | Modulos desacoplados por diseno |
| Sin real-time nativo | WebSockets para todo |
| IA inexistente/tardia | Preparado para AI desde la arquitectura |
| Requiere admin experto | Self-service para profesores |
| App movil deficiente | PWA responsive como app |

---

## 2. Arquitectura del sistema

### 2.1 Principio: Core + Modulos acoplables

```
┌─────────────────────────────────────────────────────────┐
│                    CORE LMS (MVP 3 semanas)              │
│  Auth | Cursos | Contenido | Evaluaciones | Foros       │
│  Usuarios | Roles | Notificaciones | Dashboard          │
└────────────────────────┬────────────────────────────────┘
                         │ APIs internas bien definidas
         ┌───────────────┼───────────────┐
         │               │               │
┌────────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│  MODULO IA    │ │ MODULO VIDEO│ │  MODULO SIS │
│  AI Tutor     │ │ Jitsi Meet  │ │  Matriculas │
│  RAG/LLM     │ │ Grabaciones │ │  Expedientes│
│  (Fase 2)    │ │ (Fase 2)    │ │  (Fase 3)   │
└───────────────┘ └─────────────┘ └─────────────┘
```

### 2.2 Stack tecnico

**Principio de licencias**: Priorizamos software con licencias OSI-approved
(BSD, MIT, Apache-2.0, AGPL). Evitamos licencias source-available no
libres (SSPL, RSALv2, BSL). Esto excluye Redis (post-2024), MongoDB,
y similares.

| Capa | Tecnologia | Licencia | Justificacion |
|------|-----------|----------|---------------|
| **Frontend** | Next.js 15 (App Router) | MIT | SSR + framework completo, cubre modulo "framework F+B" |
| **UI** | Tailwind CSS + shadcn/ui | MIT | Design system custom con 10+ componentes |
| **Backend** | NestJS 10 | MIT | TypeScript E2E, modular, inyeccion de dependencias |
| **ORM** | Prisma 5 | Apache-2.0 | Schema declarativa, migraciones, middleware multi-tenant |
| **DB** | PostgreSQL 16 | PostgreSQL (BSD-like) | Relacional robusto, pgvector para futuro AI |
| **Cache/Queue** | Valkey 8 + BullMQ | BSD-3-Clause | Cache de sesiones, jobs asincronos. Fork libre de Redis |
| **Storage** | Garage (S3-compatible) | AGPL-3.0 | Archivos de cursos, submissions, avatares. Ligero (Rust) |
| **Real-time** | Socket.io (via NestJS Gateway) | MIT | Notificaciones, actualizaciones en vivo |
| **Auth** | Passport.js + JWT | MIT | OAuth Google + email/password |
| **Monitoring** | Prometheus + Grafana | Apache-2.0 / AGPL-3.0 | Metricas custom, dashboards, alertas |
| **Reverse Proxy** | Caddy | Apache-2.0 | HTTPS automatico, proxy a servicios |
| **Containerizacion** | Docker Compose | Apache-2.0 | "Single command" deploy (requisito 42) |
| **CI** | GitHub Actions | Propietario (servicio) | Lint + tests en cada PR |

### 2.3 Arquitectura de deploy (Docker Compose)

```yaml
services:
  # --- Core ---
  frontend:        # Next.js 15
  backend:         # NestJS 10
  postgres:        # PostgreSQL 16
  valkey:          # Valkey 8 (cache + queue, BSD-3-Clause)
  garage:          # Garage S3-compatible storage (Rust, ligero)
  caddy:           # Reverse proxy + HTTPS

  # --- Monitoring (DevOps) ---
  prometheus:      # Metricas
  grafana:         # Dashboards
  node-exporter:   # Metricas del host

  # --- Modulos futuros (se anaden con docker-compose.override.yml) ---
  # jitsi-web:     # Jitsi Meet frontend
  # jitsi-jvb:     # Jitsi Video Bridge
  # jitsi-prosody: # Jitsi XMPP
```

---

## 3. Core LMS — Diseno detallado

### 3.1 Entidades principales (Schema DB)

```
┌──────────┐     ┌────────────┐     ┌──────────────┐
│   User   │────>│ Enrollment │<────│    Course    │
│          │     │ (role)     │     │              │
└──────────┘     └────────────┘     └──────┬───────┘
     │                                      │
     │           ┌──────────────┐           │
     │           │   Section    │<──────────┘
     │           │ (modulo/tema)│
     │           └──────┬───────┘
     │                  │
     │           ┌──────▼───────┐
     │           │   Lesson     │
     │           │ (contenido)  │
     │           └──────────────┘
     │
     │           ┌──────────────┐     ┌──────────────┐
     └──────────>│ Assignment   │────>│ Submission   │
                 │ (tarea)      │     │ (entrega)    │
                 └──────────────┘     └──────────────┘
```

### 3.2 Roles y permisos

| Rol | Puede hacer |
|-----|-------------|
| **Admin** | CRUD usuarios, CRUD cursos, gestionar plataforma, ver analytics |
| **Teacher** | Crear/editar sus cursos, crear contenido, evaluar, ver estadisticas de sus alumnos |
| **Student** | Matricularse en cursos, ver contenido, enviar tareas, participar en foros, ver sus notas |

### 3.3 Features del Core LMS (MVP)

#### Autenticacion y usuarios
- [x] Registro con email + password (hash bcrypt + salt)
- [x] Login con JWT (access + refresh tokens)
- [x] OAuth 2.0 con Google
- [x] Perfil de usuario (nombre, avatar, bio)
- [x] Sistema de amigos (add/remove, ver online status)
- [x] 2FA TOTP opcional
- [x] Password reset por email
- [x] Email verification

#### Gestion de cursos
- [x] CRUD de cursos (titulo, descripcion, imagen, categoria, estado draft/published)
- [x] Secciones dentro de cursos (modulos/temas ordenables)
- [x] Lecciones dentro de secciones (texto rico, archivos adjuntos, video embed)
- [x] Matriculacion de alumnos (publica, por invitacion, o por codigo)
- [x] Progreso del alumno (% completado, lecciones vistas)
- [x] Barra de progreso visual

#### Evaluaciones
- [x] Tareas (assignments) con fecha limite
- [x] Submission de archivos o texto
- [x] Calificacion manual por profesor (nota + feedback)
- [x] Rubrica basica (criterios + puntuacion)
- [x] Libro de calificaciones por curso (gradebook)
- [x] Export CSV de calificaciones

#### Foros de discusion
- [x] Foro por curso (threads + replies)
- [x] Notificacion al profesor cuando hay nueva pregunta
- [x] Busqueda dentro del foro
- [x] Pin/unpin threads

#### Notificaciones en tiempo real
- [x] WebSocket para notificaciones push
- [x] Tipos: nueva tarea, calificacion publicada, mensaje en foro, recordatorio deadline
- [x] Centro de notificaciones con leido/no-leido
- [x] Badge count en navbar

#### Dashboard por rol
- [x] **Admin**: usuarios activos, cursos, metricas generales
- [x] **Teacher**: mis cursos, submissions pendientes, actividad reciente
- [x] **Student**: mis cursos, proximos deadlines, notas recientes, progreso

#### Requisitos transversales (42 mandatory)
- [x] Docker Compose con single command (`docker compose up`)
- [x] HTTPS via Caddy
- [x] Compatible Chrome latest
- [x] Sin warnings/errors en consola
- [x] Privacy Policy + Terms of Service pages
- [x] Multi-user simultaneo
- [x] Responsive design
- [x] .env + .env.example
- [x] Validacion frontend + backend

---

## 4. Modulos acoplables (post-core)

### 4.1 Modulo: AI Tutor (Fase 2 - semana 3 o post-MVP)

**Que hace**: Tutor IA por curso que responde preguntas de los alumnos
basandose en el material del curso (RAG).

**Como se acopla al core**:
- Se conecta a la tabla `Lesson` para indexar contenido
- Nuevo endpoint `/api/courses/:id/ai-chat`
- Nuevo componente frontend: chat panel lateral en la vista de curso
- Job de BullMQ para indexar contenido nuevo (embeddings)

**Arquitectura**:
```
Alumno pregunta → Backend → Busca en pgvector (embeddings del curso)
→ Top-5 fragmentos relevantes → Prompt + contexto → LLM API
→ Respuesta con citas al material original
```

**Stack adicional**:
- pgvector (ya en PostgreSQL)
- OpenAI API (text-embedding-3-small + GPT-4o-mini)
- Alternativa local: Ollama + nomic-embed

**Modulos 42 que cubre**:
- AI: LLM interface (Major, 2pts) — genera respuestas basadas en input
- AI: RAG (Major, 2pts) — retrieval-augmented generation completo

**Estimacion**: 3-5 dias para 1 persona con experiencia en IA.

---

### 4.2 Modulo: Aula Virtual / Videoconferencia (Fase 2)

**Que hace**: Clases en vivo integradas en cada curso via Jitsi Meet
self-hosted.

**Como se acopla al core**:
- Nuevo modelo `LiveSession` vinculado a `Course`
- Boton "Iniciar clase en vivo" para el teacher
- Los students ven sesion activa y se unen con un click
- JWT auth compartido entre nuestro backend y Jitsi

**Arquitectura**:
```
Teacher crea sesion → Backend genera JWT para Jitsi →
Frontend embebe JitsiMeetExternalAPI (iframe) →
Alumnos se unen con su JWT → Jitsi gestiona el video
```

**Docker adicional**:
```yaml
jitsi-web:
  image: jitsi/web
jitsi-prosody:
  image: jitsi/prosody
jitsi-jicofo:
  image: jitsi/jicofo
jitsi-jvb:
  image: jitsi/jvb
```

**Features**:
- Crear/programar sesiones en vivo
- Unirse a sesion desde el dashboard del curso
- Grabacion opcional (requiere Jibri, mas RAM)
- Chat integrado durante la sesion
- Compartir pantalla

**Modulos 42 que cubre**:
- Modules of choice: Major (2pts) — justificacion: infraestructura de
  videoconferencia self-hosted integrada con auth propio y gestion de
  sesiones academicas.

**Estimacion**: 2-3 dias integracion basica, +2 dias para grabacion.

---

### 4.3 Modulo: SIS - Gestion Academica (Fase 3)

**Que hace**: Gestion administrativa de la institucion (matriculas,
expedientes, planes de estudio, certificados).

**Como se acopla al core**:
- Nuevos modelos: `AcademicPeriod`, `Program`, `Enrollment` (oficial),
  `Transcript`, `Certificate`
- Panel administrativo extendido
- Workflows de matricula (solicitud → aprobacion → inscripcion)
- Generacion de certificados PDF

**Features**:
- Periodos academicos (semestres, trimestres)
- Programas/carreras con plan de estudios
- Matricula oficial con estados (solicitud, aprobada, pagada, activa)
- Expediente academico (transcript) con historial completo
- Certificados con firma digital (PDF generado)
- Prerequisitos entre cursos

**Modulos 42 que podria cubrir**:
- Data & Analytics: Advanced dashboard (Major, 2pts)
- Data & Analytics: Data export/import (Minor, 1pt)
- Data & Analytics: GDPR compliance (Minor, 1pt)

**Estimacion**: 2-3 semanas para 1-2 personas. NO entra en MVP.

---

### 4.4 Modulo: Comunicacion avanzada (Fase 2-3)

**Que hace**: Sistema de mensajeria entre usuarios, anuncios de curso,
integracion email.

**Como se acopla al core**:
- Extiende el sistema de notificaciones existente
- Nuevo modelo `Message` para DMs
- Anuncios broadcast por curso
- Digest email semanal

**Features**:
- Mensajes directos entre usuarios
- Chat grupal por curso
- Anuncios del profesor (push a todos los alumnos)
- Email digest configurable (diario/semanal/nunca)
- Integracion WhatsApp para recordatorios (opcional)

**Modulos 42**:
- Web: User interaction (Major, 2pts) — chat + profiles + friends
  (NOTA: parte de esto ya esta en el Core como requisito)

**Estimacion**: 1 semana para 1 persona.

---

## 5. Modulos 42 — Estrategia de puntos

### 5.1 Core LMS (obligatorio, semanas 1-3)

| Modulo | Tipo | Pts | Implementacion |
|--------|------|-----|----------------|
| Web: Framework F+B (Next.js + NestJS) | Major | 2 | Arquitectura completa |
| Web: WebSockets real-time | Major | 2 | Notificaciones + updates en vivo |
| Web: User interaction (chat + profiles + friends) | Major | 2 | Foros + perfiles + amigos |
| Web: ORM (Prisma) | Minor | 1 | Standard |
| Web: File upload | Minor | 1 | Contenido cursos + submissions |
| Web: Custom design system (10+ componentes) | Minor | 1 | shadcn customizado |
| User Mgmt: Standard (perfil, avatar, friends, status) | Major | 2 | Base del sistema |
| User Mgmt: OAuth Google | Minor | 1 | Login social |
| User Mgmt: Organization system | Major | 2 | Instituciones/cursos como orgs |
| User Mgmt: Advanced permissions (admin/teacher/student) | Major | 2 | RBAC completo con UI |
| DevOps: Monitoring Prometheus+Grafana | Major | 2 | Dashboards custom + alertas |
| **TOTAL CORE** | | **18** | **4 pts bonus** |

### 5.2 Con modulos adicionales (si da tiempo)

| Modulo extra | Tipo | Pts | Cuando |
|--------------|------|-----|--------|
| AI: LLM interface (AI Tutor) | Major | 2 | Semana 3 |
| i18n: 3 idiomas (ES/EN/PT) | Minor | 1 | Semana 3 |
| GDPR compliance | Minor | 1 | Semana 3 |
| User Mgmt: 2FA | Minor | 1 | Semana 2 |
| **TOTAL MAXIMO** | | **23** | **Bonus lleno (5pts) + margen** |

### 5.3 Estrategia conservadora

- **Objetivo minimo**: 18 pts (core solo) — ya pasa con 4 pts de bonus
- **Objetivo realista**: 20 pts — core + 2FA + i18n
- **Objetivo optimista**: 23 pts — core + AI + i18n + GDPR + 2FA
- **NO claimar** modulos que no esten 100% funcionales

---

## 6. Equipo y distribucion de trabajo

### 6.1 Roles (4 personas)

| Persona | Rol 42 | Rol real | Foco |
|---------|--------|----------|------|
| **Jorge** | Tech Lead + Developer | Arquitectura + Backend + AI | Diseño del sistema, backend core, AI Tutor, code review |
| **Persona 2** | PO + Developer | Frontend + UX | Dashboard, vistas de curso, componentes, flujos de alumno/profesor |
| **Persona 3** | PM + Developer | DevOps + Infra | Docker, monitoring, CI/CD, DB, seguridad, deploy |
| **Persona 4 (TBD)** | Developer | Fullstack | Evaluaciones, foros, real-time, features transversales |

### 6.2 Perfil ideal del 4o miembro

**Prioridad 1**: Fullstack JavaScript/TypeScript con experiencia en React
o Next.js. Que pueda moverse entre front y back segun necesidad.

**Prioridad 2**: Frontend specialist con buen ojo para UX. Permite que
el Persona 2 se enfoque mas en logica y el 4o en UI/polish.

**Lo que NO necesitamos**: Otro DevOps (ya tenemos 1), AI specialist
puro (no es el core), o alguien que solo sepa backend.

**Donde buscarlo**: 42 Madrid (compañeros del common core), comunidades
de desarrollo web en Madrid, Discord de 42.

### 6.3 Tareas para cuando el 4o se incorpore

Las tareas estan diseñadas para que el 4o pueda incorporarse en
cualquier momento de las 3 semanas con un onboarding minimo:

- **Si llega semana 1**: Se le asigna el modulo de evaluaciones
  (assignments + submissions + gradebook). Es independiente del
  resto y puede trabajar en paralelo.
- **Si llega semana 2**: Se le asigna foros + notificaciones en
  tiempo real. Requiere que auth y cursos ya existan.
- **Si llega semana 3**: Se le asigna polish (i18n, GDPR, testing,
  fix de bugs, ayuda con diseño).

---

## 7. Timeline (3 semanas)

### Semana 1: Fundacion (Lunes a Viernes)

**Objetivo**: Tener el esqueleto completo funcionando end-to-end.
Al final de semana 1: un usuario puede registrarse, crear un curso,
y ver el dashboard.

| Dia | Jorge (Tech Lead) | Persona 2 (Frontend) | Persona 3 (DevOps) | Persona 4 (si ya esta) |
|-----|-------------------|---------------------|--------------------|-----------------------|
| L | Scaffold NestJS + Prisma schema completo | Scaffold Next.js + layout base + auth pages | Docker Compose inicial (postgres, valkey, caddy, garage) | Onboarding + setup local |
| M | Auth module (register, login, JWT, refresh) | Login/Register UI + validacion | Caddy config HTTPS + .env.example | Auth UI ayuda o evaluaciones schema |
| X | Auth OAuth Google + email verify | Dashboard layout (sidebar, navbar, routing) | GitHub Actions (lint + build) | Assignments model + API |
| J | Courses module (CRUD API) + Enrollments | Course list page + Course detail skeleton | Prometheus + node-exporter setup | Assignments API (create, list) |
| V | Sections + Lessons API | Course creation form + section editor | Grafana dashboards basicos | Submission API + file upload |

**Entregable semana 1**:
- Docker Compose levanta todo con `docker compose up`
- Auth funcional (email + Google OAuth)
- CRUD de cursos basico
- Dashboard con sidebar por rol
- CI funcionando
- Monitoring basico visible en Grafana

---

### Semana 2: Features core (Lunes a Viernes)

**Objetivo**: El LMS es funcional end-to-end. Un profesor puede crear
un curso con contenido, un alumno puede matricularse, ver lecciones,
y entregar tareas.

| Dia | Jorge (Tech Lead) | Persona 2 (Frontend) | Persona 3 (DevOps) | Persona 4 |
|-----|-------------------|---------------------|--------------------|-----------------------|
| L | Enrollment logic + progress tracking API | Lesson viewer (markdown + file viewer) | MinIO setup + file upload service | Gradebook API + calificacion |
| M | Notifications module (WebSocket gateway) | File upload component + progress bar | Backup automation + health checks | Gradebook UI (tabla de notas) |
| X | Forum module API (threads, replies, search) | Notification center UI + badge | Metricas custom de la app en Prometheus | Forum UI (thread list + reply) |
| J | WebSocket events (new assignment, grade, forum) | Student dashboard (progreso, deadlines) | Seguridad: rate limiting, CORS, headers | Submission UI (upload + text) |
| V | User profiles + friends + online status API | Teacher dashboard (pending reviews) | Load testing basico + tuning | Rubrica basica UI + export CSV |

**Entregable semana 2**:
- Flujo completo profesor: crear curso → añadir contenido → crear tarea → calificar
- Flujo completo alumno: matricularse → ver lecciones → entregar tarea → ver nota
- Notificaciones real-time funcionando
- Foros funcionales
- File upload para contenido y submissions
- Perfiles de usuario con avatar y friends

---

### Semana 3: Polish + modulos extra (Lunes a Viernes)

**Objetivo**: Producto pulido, listo para demo. Modulos extra si da
tiempo. Testing, fix de bugs, documentacion.

| Dia | Jorge (Tech Lead) | Persona 2 (Frontend) | Persona 3 (DevOps) | Persona 4 |
|-----|-------------------|---------------------|--------------------|-----------------------|
| L | AI Tutor: embeddings pipeline + pgvector | Design system: 10+ componentes documentados | Grafana dashboards finales + alertas | i18n setup (next-intl) ES/EN/PT |
| M | AI Tutor: chat endpoint + RAG basico | AI chat UI (panel lateral en curso) | Docker Compose optimizado + docs | i18n: traduccion de todas las paginas |
| X | AI Tutor: streaming + citations | Privacy Policy + Terms of Service pages | Security audit + fix vulnerabilities | GDPR: export datos + delete account |
| J | Testing E2E + fix bugs criticos | Responsive testing + fix mobile | README tecnico + deploy guide | Testing + fix bugs |
| V | Code review final + README | Demo prep + screenshots | Demo environment limpio | Demo prep + README contribuciones |

**Entregable semana 3**:
- LMS completo y funcional
- AI Tutor basico (si da tiempo)
- Design system con 10+ componentes
- i18n en 3 idiomas
- Privacy Policy + ToS
- README completo segun requisitos 42
- Docker Compose listo para evaluacion
- Grafana con dashboards utiles

---

## 8. Schema de base de datos (Prisma)

```prisma
// === AUTH ===
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String?
  name            String
  avatarUrl       String?
  bio             String?
  locale          String    @default("es")
  emailVerified   DateTime?
  oauthProvider   String?
  oauthId         String?
  is2FAEnabled    Boolean   @default(false)
  totpSecret      String?
  role            GlobalRole @default(STUDENT)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  sessions        Session[]
  enrollments     Enrollment[]
  ownedCourses    Course[]       @relation("CourseOwner")
  submissions     Submission[]
  forumPosts      ForumPost[]
  notifications   Notification[]
  friendsA        Friendship[]   @relation("FriendA")
  friendsB        Friendship[]   @relation("FriendB")
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  refreshToken String   @unique
  userAgent    String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())
}

model Friendship {
  id        String   @id @default(cuid())
  userAId   String
  userA     User     @relation("FriendA", fields: [userAId], references: [id])
  userBId   String
  userB     User     @relation("FriendB", fields: [userBId], references: [id])
  status    FriendStatus @default(PENDING)
  createdAt DateTime @default(now())
  @@unique([userAId, userBId])
}

// === COURSES ===
model Course {
  id          String   @id @default(cuid())
  title       String
  description String?
  imageUrl    String?
  category    String?
  status      CourseStatus @default(DRAFT)
  accessCode  String?  @unique
  ownerId     String
  owner       User     @relation("CourseOwner", fields: [ownerId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  sections    Section[]
  enrollments Enrollment[]
  assignments Assignment[]
  forumPosts  ForumPost[]
}

model Enrollment {
  id        String         @id @default(cuid())
  userId    String
  user      User           @relation(fields: [userId], references: [id])
  courseId   String
  course    Course         @relation(fields: [courseId], references: [id])
  role      CourseRole     @default(STUDENT)
  progress  Float          @default(0)
  enrolledAt DateTime      @default(now())
  @@unique([userId, courseId])
}

model Section {
  id        String   @id @default(cuid())
  courseId   String
  course    Course   @relation(fields: [courseId], references: [id])
  title     String
  order     Int
  createdAt DateTime @default(now())
  lessons   Lesson[]
}

model Lesson {
  id          String   @id @default(cuid())
  sectionId   String
  section     Section  @relation(fields: [sectionId], references: [id])
  title       String
  contentMd   String?  // Markdown content
  videoUrl    String?  // Embedded video URL
  order       Int
  createdAt   DateTime @default(now())
  attachments LessonAttachment[]
  completions LessonCompletion[]
}

model LessonAttachment {
  id        String   @id @default(cuid())
  lessonId  String
  lesson    Lesson   @relation(fields: [lessonId], references: [id])
  filename  String
  url       String
  mimeType  String
  sizeByte  Int
  createdAt DateTime @default(now())
}

model LessonCompletion {
  id        String   @id @default(cuid())
  lessonId  String
  lesson    Lesson   @relation(fields: [lessonId], references: [id])
  userId    String
  completedAt DateTime @default(now())
  @@unique([lessonId, userId])
}

// === EVALUACIONES ===
model Assignment {
  id          String   @id @default(cuid())
  courseId     String
  course      Course   @relation(fields: [courseId], references: [id])
  title       String
  description String?
  dueDate     DateTime?
  maxScore    Float    @default(100)
  createdAt   DateTime @default(now())
  submissions Submission[]
}

model Submission {
  id           String   @id @default(cuid())
  assignmentId String
  assignment   Assignment @relation(fields: [assignmentId], references: [id])
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  content      String?  // Text content
  fileUrl      String?  // Uploaded file
  score        Float?
  feedback     String?
  gradedAt     DateTime?
  submittedAt  DateTime @default(now())
  @@unique([assignmentId, userId])
}

// === FOROS ===
model ForumPost {
  id        String   @id @default(cuid())
  courseId   String
  course    Course   @relation(fields: [courseId], references: [id])
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  parentId  String?
  parent    ForumPost? @relation("PostReplies", fields: [parentId], references: [id])
  replies   ForumPost[] @relation("PostReplies")
  title     String?  // Solo para threads (parentId == null)
  body      String
  isPinned  Boolean  @default(false)
  createdAt DateTime @default(now())
}

// === NOTIFICACIONES ===
model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      NotificationType
  title     String
  body      String?
  link      String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}

// === ENUMS ===
enum GlobalRole { ADMIN TEACHER STUDENT }
enum CourseRole { TEACHER ASSISTANT STUDENT }
enum CourseStatus { DRAFT PUBLISHED ARCHIVED }
enum FriendStatus { PENDING ACCEPTED REJECTED }
enum NotificationType {
  NEW_ASSIGNMENT
  GRADE_PUBLISHED
  FORUM_REPLY
  ENROLLMENT_APPROVED
  DEADLINE_REMINDER
  FRIEND_REQUEST
  SYSTEM
}
```

---

## 9. Estructura de carpetas

```
ft_transcendence/
├── docker-compose.yml
├── docker-compose.override.yml  (modulos extra)
├── .env.example
├── README.md
├── docs/
│   └── ...
│
├── frontend/                    # Next.js 15
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.ts
│   ├── src/
│   │   ├── app/                 # App Router pages
│   │   │   ├── (auth)/          # Login, register, etc.
│   │   │   ├── (dashboard)/     # Authenticated routes
│   │   │   │   ├── courses/
│   │   │   │   ├── assignments/
│   │   │   │   ├── forums/
│   │   │   │   └── admin/
│   │   │   └── (public)/        # Landing, privacy, terms
│   │   ├── components/          # Reusable components
│   │   │   ├── ui/              # Design system (shadcn)
│   │   │   └── ...
│   │   ├── lib/                 # Utilities, API client
│   │   ├── hooks/               # Custom hooks
│   │   └── i18n/                # Internationalization
│   └── public/
│
├── backend/                     # NestJS 10
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── auth/                # Auth module
│   │   ├── users/               # Users module
│   │   ├── courses/             # Courses module
│   │   ├── lessons/             # Lessons module
│   │   ├── assignments/         # Assignments module
│   │   ├── forums/              # Forums module
│   │   ├── notifications/       # WebSocket + notifications
│   │   ├── storage/             # File upload (S3/MinIO)
│   │   ├── ai/                  # AI module (Fase 2)
│   │   └── common/              # Guards, pipes, interceptors
│   └── test/
│
├── monitoring/                  # DevOps
│   ├── prometheus/
│   │   └── prometheus.yml
│   ├── grafana/
│   │   ├── provisioning/
│   │   └── dashboards/
│   └── alerting/
│
└── caddy/
    └── Caddyfile
```

---

## 10. Criterios de "Done" por feature

Cada feature se considera terminada cuando:

1. Funciona en Chrome latest sin warnings/errors en consola
2. Validacion frontend + backend implementada
3. Tests basicos del happy path
4. Responsive (funciona en movil)
5. Accesible desde el rol correcto (RBAC verificado)
6. Code review aprobado por al menos 1 compañero
7. Docker: funciona con `docker compose up` limpio

---

## 11. Riesgos y mitigaciones

| # | Riesgo | Prob. | Impacto | Mitigacion |
|---|--------|-------|---------|------------|
| 1 | **4o miembro no aparece** | Media | Alto | El plan funciona con 3: se recorta AI Tutor y se simplifica i18n |
| 2 | **Scope creep** | Alta | Alto | Features cortadas estan en "Modulos acoplables", no en el core |
| 3 | **WebSocket bugs** | Media | Medio | Usar Socket.io (mas tolerante) en vez de WS nativo. Fallback polling |
| 4 | **File upload complejo** | Baja | Bajo | MinIO es S3-compatible, bien documentado |
| 5 | **Docker Compose no levanta clean** | Media | Critico | Testing diario del `docker compose up` desde zero |
| 6 | **Evaluador no acepta "Organization system"** | Baja | Medio | El modelo Course/Enrollment es literalmente un org system. CRUD visible en UI |
| 7 | **AI Tutor no funciona bien** | Media | Bajo | Es modulo extra (bonus), no afecta a los 18pts base |
| 8 | **Burnout (5h/dia x 3 semanas)** | Media | Alto | Fines de semana libres. Si hay retraso, se recorta semana 3 |

---

## 12. Que recortar si vamos mal (prioridad de corte)

Si en semana 2 vamos retrasados, recortar en este orden:

1. **AI Tutor** — es bonus, no core (ahorra 3-5 dias)
2. **i18n** — dejar solo ES (ahorra 2 dias)
3. **GDPR export** — dejar solo delete account (ahorra 1 dia)
4. **2FA** — no es obligatorio (ahorra 1 dia)
5. **Foros** — simplificar a solo comentarios sin threads (ahorra 2 dias)
6. **Rubrica** — dejar solo nota numerica sin criterios (ahorra 1 dia)

**NUNCA recortar**: Auth, Courses CRUD, Enrollment, Lessons, Assignments
basicos, Dashboard, Docker Compose, Monitoring.

---

## 13. Story de defensa (2-3 minutos)

> "Construimos **[nombre pendiente]**, un LMS moderno que resuelve los
> problemas cronicos de Moodle: interfaz anticuada, cero real-time, y
> ausencia de inteligencia artificial. Nuestro sistema permite a un
> profesor crear un curso completo en minutos — con lecciones, archivos,
> y evaluaciones — y a los alumnos matricularse, seguir su progreso, y
> entregar tareas con feedback inmediato. Todo se actualiza en tiempo
> real via WebSockets: cuando un profesor publica una nota, el alumno
> la ve al instante. La arquitectura es modular: el core LMS funciona
> independiente, y hemos diseñado modulos acoplables para AI Tutor
> (RAG sobre material del curso), videoconferencia (Jitsi self-hosted),
> y gestion academica completa (SIS). Tech: Next.js 15 + NestJS 10 +
> PostgreSQL + Valkey + Garage + Socket.io. Sistema de roles con 3
> niveles (admin, teacher, student) con vistas y permisos diferenciados.
> Prometheus + Grafana para monitoring con dashboards custom. 18 puntos
> de modulos, 4 de bonus. Somos 4 personas: 1 Tech Lead + 2
> fullstack + 1 DevOps."

---

## 14. Proximos pasos inmediatos

1. [ ] **Encontrar al 4o miembro** — perfil: fullstack JS/TS
2. [ ] **Crear repositorio limpio** (o limpiar este)
3. [ ] **Scaffold base**: `npx create-next-app` + `nest new` + Docker Compose
4. [ ] **Definir nombre del producto**
5. [ ] **Comprar dominio** (opcional para MVP, pero util para demo)
6. [ ] **Setup canal de comunicacion** (Discord/Slack del equipo)
7. [ ] **Sprint planning semana 1** — asignar tareas concretas en GitHub Issues
