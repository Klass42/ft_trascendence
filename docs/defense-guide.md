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
- **Archivo:** [`apps/backend/src/auth/auth.service.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/auth/auth.service.ts#L166-L166) (hash) · [`verify L213`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/auth/auth.service.ts#L213-L213)
- **Código en vivo — argon2 (sal incluida en el hash)** ([`auth/auth.service.ts L166–166`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/auth/auth.service.ts#L166-L166)):
  ```ts
  const passwordHash = await argon2.hash(dto.password);
  ```

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
- **Archivos:** [`apps/backend/src/app.module.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/app.module.ts) · [`apps/frontend/src/app`](https://github.com/Klass42/ft_trascendence/tree/master/apps/frontend/src/app)

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
- **Archivos:** [`apps/backend/src/realtime/realtime.gateway.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/realtime/realtime.gateway.ts) · [`apps/backend/src/realtime/presence.service.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/realtime/presence.service.ts)
- **Código en vivo — handshake: identidad + autorización + rooms** ([`realtime/realtime.gateway.ts L77–96`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/realtime/realtime.gateway.ts#L77-L96)):
  ```ts
  async handleConnection(client: Socket): Promise<void> {
    const userId = this.identify(client);
    if (!userId) {
      // No valid identity → refuse the socket rather than leave it anonymous.
      this.logger.warn(`Socket ${client.id} rejected: missing user identity`);
      client.disconnect(true);
      return;
    }

    const access = await this.authorize(userId);
    if (!access) {
      this.logger.warn(`Socket ${client.id} rejected: user gone or organization not active`);
      client.disconnect(true);
      return;
    }

    client.data.userId = userId;
    await client.join(userRoom(userId));
    if (access.organizationId) await client.join(orgRoom(access.organizationId));
    await this.touchOnline(userId);
  ```
- **Código en vivo — authorize() — rechaza `deactivatedAt` y org no ACTIVE** ([`realtime/realtime.gateway.ts L250–265`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/realtime/realtime.gateway.ts#L250-L265)):
  ```ts
  private async authorize(userId: string): Promise<{ organizationId: string | null } | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true, deactivatedAt: true, organization: { select: { status: true } } },
      });
      if (!user) return null;
      // #134: a member removed from the organization cannot reconnect.
      if (user.deactivatedAt) return null;
      if (user.organization && user.organization.status !== 'ACTIVE') return null;
      return { organizationId: user.organizationId };
    } catch (err) {
      this.logger.warn(`access check failed for ${userId}: ${(err as Error).message}`);
      return null;
    }
  }
  ```
- **Código en vivo — cortar sockets vivos** ([`realtime/realtime.gateway.ts L232–242`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/realtime/realtime.gateway.ts#L232-L242)):
  ```ts
  /** Disconnect every socket of an organization that was suspended, archived or deleted. */
  @OnEvent(ORGANIZATION_SUSPENDED)
  handleOrganizationSuspended({ organizationId }: OrganizationSuspendedEvent): void {
    this.server?.in(orgRoom(organizationId)).disconnectSockets(true);
  }

  /** Disconnect every socket of a user whose access was revoked (deactivated or deleted). */
  @OnEvent(USER_DEACTIVATED)
  handleUserDeactivated({ userId }: UserDeactivatedEvent): void {
    this.server?.in(userRoom(userId)).disconnectSockets(true);
  }
  ```

### 2.3 ORM — Minor (1) · Jorge
- **Demo:** `schema.prisma`, una migración y `prisma/seed.ts`.
- **Por qué:** cliente tipado, migraciones versionadas, seed idempotente (`make db-seed`).
- **Archivos:** [`apps/backend/prisma/schema.prisma`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/prisma/schema.prisma) · [`apps/backend/prisma/seed.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/prisma/seed.ts) · [`apps/backend/prisma/migrations`](https://github.com/Klass42/ft_trascendence/tree/master/apps/backend/prisma/migrations)
- **Código en vivo — modelo `User` (extracto)** ([`apps/backend/prisma/schema.prisma L70–87`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/prisma/schema.prisma#L70-L87)):
  ```prisma
  model User {
    id              String       @id @default(cuid())
    organizationId  String?
    organization    Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
    email           String
    passwordHash    String? // null when the account is OAuth-only
    name            String
    avatarUrl       String?
    bio             String?
    role            GlobalRole   @default(STUDENT)
    platformRole    PlatformRole @default(NONE)
    onlineAt        DateTime? // updated on activity; drives online status
    emailVerifiedAt DateTime?
    deactivatedAt   DateTime? // #134: removed from the org (no login), history kept; null = active
    emailNotificationsEnabled Boolean  @default(true)
    preferredLanguage         String   @default("es")
    createdAt                 DateTime @default(now())
    updatedAt       DateTime     @updatedAt
  ```

### 2.4 Gestión de usuarios estándar — Major (2) · Jorge
- **Demo:** `/profile` (nombre, avatar, contraseña, idioma, preferencias), `/friends` (aceptar
  solicitud de Diego con `student@demo`), presencia, `/admin/users` (CRUD con `admin@demo`),
  exportar mis datos y borrar cuenta.
- **Código:** `users/users.controller.ts` (`GET me/export` ≈ l.42, `POST me/delete` ≈ l.48),
  `users/friendships`, `auth/auth.service.ts` (`resetPassword` ≈ l.517, recuperación mediada por
  admin sin SMTP — ver [`diagrams.md` §3.5](./diagrams.md#35-autenticación-login-refresh-logout-y-recuperación)).
- **Si preguntan:** “¿no hay e-mail de recuperación?” → decisión consciente: sin SMTP, el admin
  genera un enlace JWT de un solo uso (lleva huella del hash actual).
- **Archivos:** [`apps/backend/src/users/users.controller.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/users/users.controller.ts) · [`apps/backend/src/auth/auth.service.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/auth/auth.service.ts)
- **Código en vivo — login bloquea org suspendida y cuenta desactivada** ([`auth/auth.service.ts L218–226`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/auth/auth.service.ts#L218-L226)):
  ```ts
  // Issue #106: only after a valid password, tell the user the org is suspended.
  if (user.organization && user.organization.status !== 'ACTIVE') {
    throw new ForbiddenException('Tu organización está suspendida. Contacta con el soporte de la plataforma.');
  }

  // #134: a member removed from the org keeps the account but cannot sign in.
  if (user.deactivatedAt) {
    throw new ForbiddenException('Tu cuenta se ha desactivado en esta organización. Contacta con su administración para reactivarla.');
  }
  ```

### 2.5 Permisos avanzados / RBAC — Major (2) · Jorge
- **Demo:** entrar con admin, profesor y alumno y comparar menús; el alumno que abre
  `/analytics` vuelve al inicio; `curl` con token de alumno a un endpoint de admin → 403.
- **Código:** `common/auth/roles.guard.ts` (`RolesGuard`), `common/auth/platform-roles.guard.ts`,
  decoradores `@Roles('ADMIN')` (p. ej. `organizations/organizations.controller.ts`),
  `common/auth/tenant-context.ts` (toda consulta filtrada por `organizationId`),
  `courses/course-access.service.ts` (acceso por asignatura: alumno/profesor/asistente).
- **Por qué:** dos ejes: `GlobalRole` (dentro de la org) y `PlatformRole` (back-office); la
  autorización vive en el servidor, el front solo oculta.
- **Archivos:** [`apps/backend/src/common/auth/roles.guard.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/common/auth/roles.guard.ts) · [`apps/backend/src/common/auth/platform-roles.guard.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/common/auth/platform-roles.guard.ts) · [`apps/backend/src/common/auth/tenant-context.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/common/auth/tenant-context.ts) · [`apps/backend/src/courses/course-access.service.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/courses/course-access.service.ts)
- **Código en vivo — RolesGuard** ([`common/auth/roles.guard.ts L10–26`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/common/auth/roles.guard.ts#L10-L26)):
  ```ts
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AuthUser['role'][] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // No @Roles() decorator → auth-only, allowed (the auth guard already validated).
    // `undefined` is the sentinel SetMetadata produces when no decorator is present OR
    // when the @Roles() was called with no arguments; both mean "any authenticated user".
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user) {
      throw new UnauthorizedException('Authentication required for a role-restricted route');
    }
    return required.includes(req.user.role);
  }
  ```
- **Código en vivo — uso en un endpoint** ([`organizations/organizations.controller.ts L105–108`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/organizations/organizations.controller.ts#L105-L108)):
  ```ts
  @Delete(':id/members/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  ```

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
- **Archivos:** [`apps/backend/src/organizations/organizations.controller.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/organizations/organizations.controller.ts) · [`apps/backend/src/organizations/organizations.service.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/organizations/organizations.service.ts) · [`apps/backend/src/common/plan-limits/plan-limits.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/common/plan-limits/plan-limits.ts) · [`apps/backend/src/platform`](https://github.com/Klass42/ft_trascendence/tree/master/apps/backend/src/platform)
- **Código en vivo — baja: transacción `deactivatedAt` + sesiones + audit log + evento** ([`organizations/organizations.service.ts L361–373`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/organizations/organizations.service.ts#L361-L373)):
  ```ts
  const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, organizationId: true, deactivatedAt: true } });
  if (!target) throw new NotFoundException('Usuario no encontrado.');
  if (target.organizationId !== id) throw new ForbiddenException('El usuario pertenece a otra organización.');
  if (target.deactivatedAt) throw new BadRequestException('Esta persona ya está desactivada.');
  const deactivatedAt = new Date();
  const removed = await this.prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { deactivatedAt } });
    const sessions = await tx.session.deleteMany({ where: { userId } });
    await tx.auditLog.create({ data: { actorId: callerUserId, action: 'MEMBER_DEACTIVATED', organizationId: id, targetUserId: userId, metadata: { userId, name: target.name, sessions: sessions.count } } });
    return true;
  });
  // #135 (PR #142): the realtime gateway disconnects user:<id> on this event.
  if (removed) this.events?.emit(USER_DEACTIVATED, { userId } satisfies UserDeactivatedEvent);
  ```
- **Código en vivo — reactivar** ([`organizations/organizations.service.ts L398–400`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/organizations/organizations.service.ts#L398-L400)):
  ```ts
  if (!target.deactivatedAt) throw new BadRequestException('Esta persona ya está activa.');
  await assertUserLimit(this.prisma as any, id);
  await this.prisma.user.update({ where: { id: userId }, data: { deactivatedAt: null } });
  ```

### 2.7 Notificaciones — Minor (1) · David
- **Demo:** campana y `/notifications`; publicar una tarea → los alumnos la reciben en vivo.
- **Código:** `notifications/notifications.service.ts` — `emit` (≈ l.59) persiste y publica
  `NOTIFICATION_CREATED` (≈ l.80); `emitMany` (≈ l.89). Tests: `notifications-emitters.spec.ts`.
- **Por qué:** cubre create/update/delete de tareas, contenido, asignaturas, matrículas, foro,
  biblioteca y usuarios (tabla en el README).
- **Archivo:** [`apps/backend/src/notifications/notifications.service.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/notifications/notifications.service.ts)
- **Código en vivo — persistir y publicar en el bus** ([`notifications/notifications.service.ts L59–81`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/notifications/notifications.service.ts#L59-L81)):
  ```ts
  async emit(userId: string, type: NotificationType, payload: EmitPayload) {
    try {
      return await this.persist(userId, type, payload);
    } catch (error) {
      this.logger.error(`No se pudo emitir ${type} para ${userId}`, error instanceof Error ? error.stack : undefined);
      return null;
    }
  }

  private async persist(userId: string, type: NotificationType, payload: EmitPayload) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title: payload.title,
        body: payload.body,
        link: payload.link,
      },
    });

    // RealtimeGateway escucha el bus y publica en la sala del usuario.
    this.events.emit(NOTIFICATION_CREATED, notification);
    return notification;
  ```

### 2.8 Dashboard de analíticas avanzadas — Major (2) · David
- **Demo:** `/analytics` con `teacher@demo`: KPIs, filtros (fechas, tipo, asignatura), gráficas,
  export CSV y PDF; calificar la entrega de Sam en `/grades` y ver el KPI cambiar en vivo.
  Números esperados en [`evaluation-checklist.md` §2](./evaluation-checklist.md#2-cuentas-de-demo-seed-estándar).
- **Código:** `analytics/analytics.service.ts` (`getOverview` ≈ l.60, `groupBy` ≈ l.156,
  `getExportCsv` ≈ l.222, `requireStaff` ≈ l.48), `frontend/src/features/analytics/exportPdf.ts`.
- **Por qué:** agregados en BD (sin N+1), siempre filtrados por organización y solo para staff.
- **Archivos:** [`apps/backend/src/analytics/analytics.service.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/analytics/analytics.service.ts) · [`apps/frontend/src/features/analytics/exportPdf.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/frontend/src/features/analytics/exportPdf.ts)
- **Código en vivo — gate de staff** ([`analytics/analytics.service.ts L48–51`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/analytics/analytics.service.ts#L48-L51)):
  ```ts
  private async requireStaff(subjectId: string, actingUserId: string) {
    const access = await this.access.assertSubjectStaffForUser(subjectId, actingUserId);
    return access.subject;
  }
  ```
- **Código en vivo — PDF en el navegador (jsPDF + svg2pdf)** ([`apps/frontend/src/features/analytics/exportPdf.ts L46–49`](https://github.com/Klass42/ft_trascendence/blob/master/apps/frontend/src/features/analytics/exportPdf.ts#L46-L49)):
  ```ts
  export async function downloadAnalyticsPdf(input: AnalyticsPdfInput): Promise<void> {
    const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
    const { container, overview } = input;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  ```

### 2.9 Subida de ficheros — Minor (1) · Aloiki
- **Demo (PREPARAR):** subir un PDF/PNG a una lección o a `/resources`; avatar en `/profile`;
  intentar subir un `.exe` renombrado a `.png` → rechazado.
- **Código:** `files/file-validation.ts` (`MAX_UPLOAD_BYTES` 10 MB, avatar 2 MB, MIME + firma
  mágica ≈ l.69–77), `files/storage/` (Garage/S3 o disco), descargas con scope de org.
- **Archivos:** [`apps/backend/src/files/file-validation.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/files/file-validation.ts) · [`apps/backend/src/files/storage`](https://github.com/Klass42/ft_trascendence/tree/master/apps/backend/src/files/storage)
- **Código en vivo — MIME + extensión + bytes mágicos** ([`files/file-validation.ts L65–83`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/files/file-validation.ts#L65-L83)):
  ```ts
    const allowedTypes = purpose === 'AVATAR'
      ? AVATAR_CONTENT_TYPES
      : GENERAL_CONTENT_TYPES;
    const ofNoun = purpose === 'AVATAR' ? 'de la imagen' : 'del archivo';
    if (!allowedTypes.has(file.mimetype)) {
      throw new BadRequestException(`El tipo ${ofNoun} no está permitido.`);
    }

    // The declared MIME type comes from the client and can be anything. The
    // extension must agree with it and the bytes must match the format, so a
    // renamed executable or script is rejected however it is labelled.
    const format = FORMATS_BY_EXTENSION.get(fileExtension(file.originalname));
    if (!format || !format.mimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`La extensión ${ofNoun} no coincide con su tipo.`);
    }
    if (!format.matches(file.buffer)) {
      throw new BadRequestException(`El contenido ${ofNoun} no coincide con su tipo.`);
    }
  }
  ```

### 2.10 OAuth 2.0 (Google) — Minor (1) · Jorge
- **Demo (PREPARAR):** guion completo en [`evaluation-checklist.md` §6](./evaluation-checklist.md#6-guion-oauth-20-google-136).
- **Código:** `auth/google.strategy.ts`, `auth/google-auth.guard.ts` (`state` firmado),
  vinculación por e-mail en `auth/auth.service.ts` (≈ l.394–405). Tests:
  `auth/__tests__/google-auth.e2e.spec.ts`.
- **Archivos:** [`apps/backend/src/auth/google.strategy.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/auth/google.strategy.ts) · [`apps/backend/src/auth/google-auth.guard.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/auth/google-auth.guard.ts) · [`apps/backend/src/auth/__tests__/google-auth.e2e.spec.ts`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/auth/__tests__/google-auth.e2e.spec.ts)
- **Código en vivo — callback: `state` debe coincidir con la cookie HttpOnly** ([`auth/google-auth.guard.ts L48–58`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/auth/google-auth.guard.ts#L48-L58)):
  ```ts
  if (isCallback) {
    try {
      const state = query.state;
      const cookieState = this.readCookie(req, STATE_COOKIE);
      if (
        typeof state !== 'string' ||
        typeof cookieState !== 'string' ||
        !this.safeEqual(state, cookieState)
      ) {
        throw new Error('OAuth state is missing or does not match');
      }
  ```
- **Código en vivo — vinculación: misma org y cuenta no desactivada** ([`auth/auth.service.ts L393–408`](https://github.com/Klass42/ft_trascendence/blob/master/apps/backend/src/auth/auth.service.ts#L393-L408)):
  ```ts
  const oauthAccount = await this.prisma.oAuthAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: 'google',
        providerUserId: profile.providerUserId,
      },
    },
    include: { user: true },
  });

  if (oauthAccount) {
    if (oauthAccount.user.organizationId !== organization.id) {
      throw new ForbiddenException('Esta cuenta de Google está vinculada a otra organización.');
    }
    if (oauthAccount.user.deactivatedAt) throw new AccountDeactivatedException();
    return this.issueTokens(oauthAccount.userId);
  ```

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
