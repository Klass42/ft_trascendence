# Guión de defensa — subject v21.1, punto a punto (#153)

Recorrido para la evaluación: por cada requisito obligatorio y cada módulo reclamado, **qué dice
el subject**, **cómo lo demostramos en vivo**, **dónde está en el código**, **por qué está bien** y
**qué puede preguntar el evaluador**. Los datos de demo, cuentas y la preparación del entorno están
en [`evaluation-checklist.md`](./evaluation-checklist.md); los diagramas en [`diagrams.md`](./diagrams.md).

Rutas relativas a la raíz del repo. Los números de línea son orientativos (revisados contra
`staging` el 2026-11-02); si cambian, buscar el símbolo indicado.

> Antes de empezar: `make re && make smoke` (todo en verde) y abrir `https://localhost:4443`.

---

## Parte 1 — Requisitos obligatorios (sin ellos, proyecto rechazado)

### 1.1 Frontend + backend + base de datos con esquema claro
- **Demo:** enseñar `apps/frontend` (Vite + React), `apps/backend` (NestJS) y
  `apps/backend/prisma/schema.prisma`; abrir [`diagrams.md` §1](./diagrams.md#1-base-de-datos).
- **Código:** `schema.prisma` (modelos `Organization`, `User`, `Course`, `Subject`, `Activity`,
  `Attempt`…), migraciones en `apps/backend/prisma/migrations/`.
- **Por qué está bien:** un único esquema tipado; relaciones con `onDelete` explícito; índices en
  las FK de consulta frecuente; unicidad por tenant (`@@unique([organizationId, email])`).
- **Si preguntan:** “¿por qué Postgres?” → transacciones reales (rotación de sesión, inicio de
  intento concurrente) y `groupBy`/`aggregate` para analíticas.

### 1.2 Despliegue con un solo comando
- **Demo:** `make re` (o `docker compose up --build`) → `make smoke` (12 comprobaciones HTTPS).
- **Código:** `compose.yaml`, `Makefile`, `scripts/gen-env.sh` (genera `.env` si no existe).
- **Si preguntan:** “¿y sin Make?” → `docker compose up -d --build` basta; Make solo envuelve.

### 1.3 HTTPS en todo lo que sale de un contenedor
- **Demo:** `http://localhost:<CADDY_HTTP_PORT>` redirige a HTTPS; Grafana también va por TLS
  (`:4150`). `curl -k https://localhost:4443/api/health`.
- **Código:** `infra/caddy/Caddyfile` (Caddy es el **único** contenedor que publica puertos;
  `CADDY_TLS=internal` o Let's Encrypt). El WebSocket va por `wss://` a través de Caddy.
- **Si preguntan:** “¿el backend expone puerto?” → no en compose; solo la red interna.

### 1.4 Multiusuario simultáneo sin corrupción
- **Demo:** dos navegadores (profesor y alumno) trabajando a la vez; el alumno entrega mientras el
  profesor califica.
- **Código:** `apps/backend/src/activities/attempts/attempts.service.ts` — `$transaction` al
  iniciar/entregar intento (≈ l.125 y l.658) + `@@unique([activityId, userId, attemptNo])` en
  `Attempt`; rotación de refresh token en `auth/auth.service.ts` (`refresh`, ≈ l.234: la sesión
  usada se borra y reutilizar un refresh ya rotado revoca todas las sesiones del usuario).
- **Por qué está bien:** la restricción única en BD es la red de seguridad: dos “Empezar intento”
  simultáneos no pueden crear el mismo `attemptNo`; un refresh robado y reutilizado tumba todas las sesiones.

### 1.5 Email + contraseña con hash y sal
- **Demo:** registro e inicio de sesión en `/login`; en BD enseñar `passwordHash` (`$argon2id$…`).
- **Código:** `auth/auth.service.ts` — `argon2.hash` en `register` (≈ l.156), `argon2.verify` en
  `login` (≈ l.200). Argon2id incluye sal aleatoria por hash.
- **Registro seguro (#74, #140):** en producción `register` **no devuelve tokens** hasta que el
  e-mail está verificado, y la respuesta es **uniforme** (anti-enumeración): e-mail nuevo, e-mail
  existente y slug inexistente devuelven el mismo mensaje («recibirás un enlace para confirmar tu
  correo»). Fuera de producción la cuenta se auto-verifica para agilizar el desarrollo. Demo y
  guion en [`evaluation-checklist.md`](./evaluation-checklist.md) (fila «Seguridad de registro»).
- **Si preguntan:** anti-enumeración también en login/recuperación (misma respuesta exista o no la
  cuenta), rate limit en `auth/auth-rate-limit.ts` (`@AuthRateLimit('login')` en `auth.controller.ts`).

### 1.6 Validación en frontend **y** backend
- **Demo:** enviar un formulario vacío/erróneo (registro, crear tarea): error inline en el
  navegador; repetir con `curl` saltándose el front → 400 con mensaje en español.
- **Código:** backend `apps/backend/src/main.ts` (`ValidationPipe` con `whitelist`,
  `forbidNonWhitelisted`, `transform`) + DTOs con `class-validator` en cada `dto/`;
  `common/validation/` y `common/pipes/parse-id.pipe.ts`. Frontend: validación en cada formulario
  y mapeo de errores del servidor en `apps/frontend/src/lib/form-errors.ts`.
- **Si preguntan:** los campos desconocidos se rechazan (no solo se ignoran).

### 1.7 Política de privacidad y Términos
- **Demo:** enlaces “Privacidad” y “Términos” en el pie, con y sin sesión.
- **Código:** `apps/frontend/src/features/legal/LegalPage.tsx`.

### 1.8 Chrome sin warnings/errores de consola
- **Demo:** DevTools abierto durante toda la demo (pestaña Console limpia).
- **Si preguntan:** el certificado autofirmado genera aviso de navegador, no de consola.

---

## Parte 2 — Módulos reclamados (18 pts) + margen

Tabla de referencia: [README → Modules](../README.md#modules). Cuentas y datos:
[`evaluation-checklist.md` §2–3](./evaluation-checklist.md).

### 2.1 Framework front + back — Major (2) · equipo
- **Demo:** cualquier pantalla; enseñar estructura de módulos Nest ([`diagrams.md` §2.2](./diagrams.md#22-módulos-nest-y-dueños)).
- **Código:** `apps/backend/src/app.module.ts` (lista de módulos), `apps/frontend/src/app/`.
- **Por qué:** guards/DI de Nest encajan con RBAC y multi-tenant; TypeScript extremo a extremo.

### 2.2 WebSockets en tiempo real — Major (2) · David
- **Demo:** profesor responde en el foro o califica → la campana del alumno se actualiza sin
  recargar; presencia en `/friends` (Lucía ↔ Diego); cerrar una pestaña → pasa a desconectado.
- **Código:** `apps/backend/src/realtime/realtime.gateway.ts` — `handleConnection` (≈ l.77, JWT en
  el handshake), rooms `user:<id>` y `org:<id>` (≈ l.94), `@OnEvent('notification.created')`
  (≈ l.193), `@OnEvent(USER_DEACTIVATED)` / `ORGANIZATION_SUSPENDED` (corta sockets).
  `presence.service.ts`.
- **Por qué:** emisión dirigida por room (no broadcast global); los módulos de dominio no conocen
  el gateway, publican en `EventEmitter2`. Tests: `realtime.gateway.spec.ts`,
  `realtime.gateway.access.spec.ts`.
- **Si preguntan:** “¿y si el token caduca/la cuenta se desactiva?” → el handshake rechaza
  cuentas desactivadas u orgs suspendidas y los eventos desconectan las sesiones vivas.

### 2.3 ORM — Minor (1) · Jorge
- **Demo:** `schema.prisma`, una migración y `prisma/seed.ts`.
- **Por qué:** cliente tipado, migraciones versionadas, seed idempotente (`make db-seed`).

### 2.4 Gestión de usuarios estándar — Major (2) · Jorge
- **Demo:** `/profile` (nombre, avatar, contraseña, idioma, preferencias), `/friends` (aceptar
  solicitud de Diego con `student@demo`), presencia, `/admin/users` (CRUD con `admin@demo`),
  exportar mis datos y borrar cuenta.
- **Código:** `users/users.controller.ts` (`GET me/export` ≈ l.42, `POST me/delete` ≈ l.48),
  `users/friendships`, `auth/auth.service.ts` (`resetPassword` ≈ l.517, recuperación mediada por
  admin sin SMTP — ver [`diagrams.md` §3.5](./diagrams.md#35-autenticación-login-refresh-logout-y-recuperación)).
- **Si preguntan:** “¿no hay e-mail de recuperación?” → decisión consciente: sin SMTP, el admin
  genera un enlace JWT de un solo uso (lleva huella del hash actual).

### 2.5 Permisos avanzados / RBAC — Major (2) · Jorge
- **Demo:** entrar con admin, profesor y alumno y comparar menús; el alumno que abre
  `/analytics` vuelve al inicio; `curl` con token de alumno a un endpoint de admin → 403.
- **Código:** `common/auth/roles.guard.ts` (`RolesGuard`), `common/auth/platform-roles.guard.ts`,
  decoradores `@Roles('ADMIN')` (p. ej. `organizations/organizations.controller.ts`),
  `common/auth/tenant-context.ts` (toda consulta filtrada por `organizationId`),
  `courses/course-access.service.ts` (acceso por asignatura: alumno/profesor/asistente).
- **Por qué:** dos ejes: `GlobalRole` (dentro de la org) y `PlatformRole` (back-office); la
  autorización vive en el servidor, el front solo oculta.

### 2.6 Sistema de organizaciones — Major (2) · Jorge
- **Demo:** `/platform/login` → crear organización, ver detalle (plan/límites, usuarios activos y
  desactivados); `/org/members` con `admin@demo`: invitar, **quitar** a un miembro (queda
  desactivado, no borrado) y **reactivarlo**. **PREPARAR** una segunda org para el aislamiento.
- **Código:** `organizations/organizations.controller.ts` (invitaciones, `DELETE :id/members/:userId`,
  `POST :id/members/:userId/reactivate`), `organizations.service.ts` (baja en transacción + audit
  log), `common/plan-limits/plan-limits.ts` (`assertUserLimit`), `platform/`.
  Flujo en [`diagrams.md` §3.6](./diagrams.md#36-baja-y-reactivación-de-miembros-134).
- **Si preguntan:** “¿qué pasa con las notas al quitar a alguien?” → se conservan;
  `deactivatedAt` bloquea login, refresh, JWT, OAuth y WebSocket.

### 2.7 Notificaciones — Minor (1) · David
- **Demo:** campana y `/notifications`; publicar una tarea → los alumnos la reciben en vivo.
- **Código:** `notifications/notifications.service.ts` — `emit` (≈ l.59) persiste y publica
  `NOTIFICATION_CREATED` (≈ l.80); `emitMany` (≈ l.89). Tests: `notifications-emitters.spec.ts`.
- **Por qué:** cubre create/update/delete de tareas, contenido, asignaturas, matrículas, foro,
  biblioteca y usuarios (tabla en el README).

### 2.8 Dashboard de analíticas avanzadas — Major (2) · David
- **Demo:** `/analytics` con `teacher@demo`: KPIs, filtros (fechas, tipo, asignatura), gráficas,
  export CSV y PDF; calificar la entrega de Sam en `/grades` y ver el KPI cambiar en vivo.
  Números esperados en [`evaluation-checklist.md` §2](./evaluation-checklist.md#2-cuentas-de-demo-seed-estándar).
- **Código:** `analytics/analytics.service.ts` (`getOverview` ≈ l.60, `groupBy` ≈ l.156,
  `getExportCsv` ≈ l.222, `requireStaff` ≈ l.48), `frontend/src/features/analytics/exportPdf.ts`.
- **Por qué:** agregados en BD (sin N+1), siempre filtrados por organización y solo para staff.

### 2.9 Subida de ficheros — Minor (1) · Aloiki
- **Demo (PREPARAR):** subir un PDF/PNG a una lección o a `/resources`; avatar en `/profile`;
  intentar subir un `.exe` renombrado a `.png` → rechazado.
- **Código:** `files/file-validation.ts` (`MAX_UPLOAD_BYTES` 10 MB, avatar 2 MB, MIME + firma
  mágica ≈ l.69–77), `files/storage/` (Garage/S3 o disco), descargas con scope de org.

### 2.10 OAuth 2.0 (Google) — Minor (1) · Jorge
- **Demo (PREPARAR):** guion completo en [`evaluation-checklist.md` §6](./evaluation-checklist.md#6-guion-oauth-20-google-136).
- **Código:** `auth/google.strategy.ts`, `auth/google-auth.guard.ts` (`state` firmado),
  vinculación por e-mail en `auth/auth.service.ts` (≈ l.394–405). Tests:
  `auth/__tests__/google-auth.e2e.spec.ts`.

### 2.11 Monitorización Prometheus + Grafana — Major (2) · Viacheslav
- **Demo:** Grafana `:4150` (dashboards `overview`, `node-app`, `infrastructure`); alerta en vivo:
  `docker compose stop backend` → `ServiceProbeFailed` Pending → Firing; `start` la resuelve.
- **Código:** `infra/monitoring/prometheus/prometheus.yml`, `rules/alerts.yml` (10 reglas:
  `ScrapeTargetDown`, `PostgresDown`, `BackendHighErrorRate`…), `grafana/dashboards/*.json`,
  `otel-collector/`, `blackbox/`; backend `telemetry/otel-sdk.ts`.

### 2.12 Margen — Design system (Minor, 1)
- **Demo:** `/design` (admin) con los componentes vivos.
- **Código:** `apps/frontend/src/components/ui/` (19 componentes), `tokens.css`.

### 2.13 Margen — Módulo propio: motor de tareas y evaluación (Major, 2)
- **Demo:** crear una tarea mixta (test + desarrollo + fichero), previsualizar, alumno la hace
  (autosave, reanudar), auto-calificación parcial y corrección manual con feedback por pregunta;
  guardar como plantilla y reutilizar.
- **Código:** `activities/blocks/registry.ts` (`getAdapter` ≈ l.131, `gradeQuestion` ≈ l.163),
  `activities/grading/graders.ts`, `activities/attempts/attempts.service.ts`
  (`TIME_LIMIT_GRACE_MS` ≈ l.37), `activities/templates/`. Diagramas
  [`diagrams.md` §2.3 y §3.1–3.4](./diagrams.md#23-registro-de-bloques-seam).
- **Por qué es Major:** registro extensible (añadir tipo = un adaptador), límites de intentos y
  tiempo aplicados en servidor, plantillas sin efectos secundarios. Tests: `graders.spec.ts`,
  `registry.spec.ts`, `attempts.service.spec.ts`.

---

## Parte 3 — Gaps, riesgos y respuestas preparadas

| Riesgo | Respuesta / mitigación |
|---|---|
| El seed no sube ficheros | Subir en directo un fichero pequeño (§2.9). |
| Una sola organización en el seed | Crear la segunda en `/platform` antes de la defensa (§2.6). |
| OAuth necesita credenciales de Google | Preparar `.env` local; sin `GOOGLE_CLIENT_ID` el botón no aparece (comportamiento intencionado). |
| No hay SMTP | Recuperación mediada por admin + notificación; anti-enumeración. En producción el registro no entrega tokens hasta verificar el e-mail (#74): el enlace de verificación se reparte por el canal configurado. |
| `LISTENING` / `SPEAKING` en `ActivityType` sin adaptador | Reservados para el futuro; no se reclaman. |
| `Assignment`/`Submission` legados (escrituras 410) | Migrados al motor de tareas; se mantienen para lectura (`activities/migration/`). |
| Fechas del seed relativas | Volver a ejecutar `make db-seed` justo antes de la defensa. |
| Verificación de e-mail | Cambios pendientes en PR #151 (#140/#74); defender según lo que esté mergeado ese día. |
