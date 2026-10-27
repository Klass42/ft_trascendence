# Checklist de evaluación: demo limpia y qué enseñar

Guía para preparar la defensa. Qué datos tiene la demo, cómo dejarla limpia y en qué
pantalla se demuestra cada módulo de la [tabla de módulos del README](../README.md#modules).

## 1. Dejar la demo limpia

Los restos de pruebas manuales (prefijos `QA3-*`, `AUD-*`, `QA9x-*`) viven solo en la base de
datos de desarrollo: `apps/backend/prisma/seed.ts` no contiene ninguno de esos prefijos (se
comprobó con `grep`). Basta con reiniciar los datos.

1. **Reinicio completo** (borra volúmenes e imágenes locales y vuelve a desplegar con el seed
   estándar; tarda lo de un build desde cero):

   ```bash
   make re
   ```

   Si el stack ya está construido y solo quieres reemplazar los datos de la aplicación (más
   rápido, conserva `.env`, volúmenes de Grafana y ficheros subidos en disco):

   ```bash
   make db-seed
   ```

   Ojo: `make db-seed` borra todos los datos de la aplicación, pero **no** los ficheros que
   estén en el volumen `uploads`; `make re` sí los elimina.
2. **Comprobar el stack** con `make smoke` (12 comprobaciones por HTTPS: salud, SPA, API,
   Socket.io, redirección HTTP→HTTPS, login del alumno sembrado, Grafana, Prometheus). Todas
   deben salir en verde.
3. **Comprobar que no quedan restos** (debe devolver 0 filas en todas las consultas):

   ```bash
   docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
     SELECT '\''Organization'\'' AS tabla, name FROM \"Organization\" WHERE name ~* '\''^(QA|AUD)'\''
     UNION ALL SELECT '\''User'\'', name FROM \"User\" WHERE name ~* '\''^(QA|AUD)'\''
     UNION ALL SELECT '\''Course'\'', name FROM \"Course\" WHERE name ~* '\''^(QA|AUD)'\''
     UNION ALL SELECT '\''Subject'\'', title FROM \"Subject\" WHERE title ~* '\''^(QA|AUD)'\''
     UNION ALL SELECT '\''Activity'\'', title FROM \"Activity\" WHERE title ~* '\''^(QA|AUD)'\''
     UNION ALL SELECT '\''ForumThread'\'', title FROM \"ForumThread\" WHERE title ~* '\''^(QA|AUD)'\'';"'
   ```

4. No ejecutes la suite Playwright ni pruebas manuales destructivas contra la base de datos
   de la demo. Si lo haces, vuelve a ejecutar `make db-seed` antes de la evaluación.
5. Abre `https://localhost:4443` (o el `CADDY_DOMAIN` de `.env`), acepta el certificado
   autofirmado una vez y cierra sesión en cualquier navegador que ya tuviera una (los tokens
   antiguos dejan de ser válidos tras reiniciar los datos).

`make urls` imprime las URLs y las credenciales de plataforma y Grafana.

## 2. Cuentas de demo (seed estándar)

Código de organización: `klass` (Klass Academy). Contraseña de todas: `demo1234`.

| Cuenta | Rol | Notas |
|---|---|---|
| `admin@demo` | Administrador de la organización | Ada Admin |
| `teacher@demo` | Profesor | Theo Teacher; docente de la asignatura "Introducción al Desarrollo Web" |
| `student@demo` | Alumno | Sam Student; matriculado en las cohortes 2025-2026 y 2024-2025; sin amistades ni notificaciones |
| `dev@example.com` | Alumno | Lucía Molina; amiga de Diego, con una notificación y una lección completada |
| `diego@example.com` | Profesor | Diego Torres; docente de la misma asignatura; autor del foro y de la plantilla "Examen mixto" |
| `admin@example.com` | Administrador | Admin Klass |
| `PLATFORM_SUPERADMIN_EMAIL` de `.env` (por defecto `admin@platform.local`) | Administrador de plataforma | Contraseña `PLATFORM_SUPERADMIN_PASSWORD` de `.env`; entra por `/platform/login`, sin código de organización |

Grafana: `https://localhost:4150`, usuario y contraseña de `.env` (`GF_SECURITY_ADMIN_USER` /
`GF_SECURITY_ADMIN_PASSWORD`).

Contenido que crea el seed estándar: dos cohortes "1º A" (2025-2026 activa, 2024-2025
archivada), dos asignaturas ("Introducción al Desarrollo Web" y su edición 2024-2025), dos
libros con tres lecciones, un cuestionario ("Autoevaluación de la unidad", opción múltiple y
verdadero/falso), una tarea de ensayo con fichero, la plantilla "Examen mixto", un hilo de foro
("Presentaciones", con dos mensajes), una amistad aceptada (Lucía y Diego) y una notificación
("Nota publicada" para Lucía).

**No crea:** intentos de actividades ni calificaciones, ficheros subidos, recursos de biblioteca,
invitaciones, entregas, otras organizaciones ni solicitudes de amistad pendientes.

## 3. Módulo a pantalla con datos del seed

Módulos tomados de la tabla de [README.md](../README.md#modules). "Seed" = datos que existen tras
`make re` / `make db-seed`. Los marcados con **PREPARAR** necesitan datos que el seed no crea.

| Módulo (puntos) | Dónde se demuestra | Datos del seed | Estado |
|---|---|---|---|
| Framework front y back (2) | Código: React 19 + Vite (`apps/frontend`), NestJS 10 (`apps/backend`); toda la app sirve de demo | Cualquiera | Listo |
| WebSocket en tiempo real (2) | Dos navegadores: `teacher@demo` y `student@demo`. El profesor responde en el hilo "Presentaciones" (`/forums`) o califica; el alumno ve la campana (`/notifications`) actualizarse sin recargar. Presencia en `/friends` con `dev@example.com` y `diego@example.com` | Hilo "Presentaciones"; amistad Lucía-Diego | Listo (la presencia solo se ve entre Lucía y Diego; Sam no tiene amigos) |
| ORM (1) | Código: `apps/backend/prisma/schema.prisma`, migraciones y `seed.ts` | Todo el seed | Listo |
| Gestión de usuarios estándar (2) | `/profile` (nombre, foto, contraseña, preferencias) con `student@demo`; `/admin/users` con `admin@demo`; `/friends` con `dev@example.com` | 6 usuarios de la org `klass`; amistad Lucía-Diego | Listo (la amistad solo con Lucía/Diego; para mostrar el flujo de solicitud, buscar a otra persona desde `student@demo`) |
| Permisos avanzados / RBAC (2) | Entrar con los tres roles y comparar menús: el administrador ve Usuarios y Organización, el profesor Analíticas y Biblioteca, el alumno ninguno. Un alumno que abre `/analytics` vuelve al inicio. Aislamiento entre organizaciones: ver la fila Organización | Cuentas admin/teacher/student | Listo |
| Sistema de organizaciones (2) | `/platform/login` → Organizaciones (lista con Klass Academy, crear una nueva, ver detalle); `/org` y `/org/members` con `admin@demo`; invitar en `/admin/users/invite` | Org `klass`, 3 roles | **PREPARAR**: el seed estándar solo tiene una organización. Para enseñar aislamiento entre organizaciones, crear una segunda desde `/platform` antes de la defensa, o usar `make db-seed-small` / `make db-seed-e2e`, que **reemplazan** Klass Academy. No hay invitaciones pendientes: crearlas en directo |
| Sistema de notificaciones (1) | Campana y `/notifications`. Con `dev@example.com` aparece "Nota publicada". Las demás se generan al crear/editar contenido, responder en foros o calificar | 1 notificación para Lucía | Parcial: `student@demo` y los profesores empiezan sin notificaciones; generarlas en directo (p. ej. el profesor publica una tarea o responde en el foro) |
| Dashboard de analíticas avanzadas (2) | `/analytics` con `teacher@demo` o `diego@example.com` (KPIs, entregas en el tiempo, distribución de notas, exportación CSV/PDF, refresco en vivo) | Cuestionario, tarea de ensayo y matrículas, **sin intentos** | **PREPARAR**: sin intentos las gráficas salen vacías. Antes de la defensa: `student@demo` hace la "Autoevaluación de la unidad" (`/activities`) y entrega la tarea de ensayo; el profesor la califica. Se pierde al volver a ejecutar el seed |
| Subida de ficheros (1) | Alumno: entregar la tarea "Tarea · Ensayo y fichero" adjuntando un PNG/PDF (`/activities`); profesor: adjuntar un fichero en una lección o subir un recurso en `/resources`; foto de perfil en `/profile` | Pregunta de tipo fichero (máx. 3) en la tarea | **PREPARAR**: el seed no sube ningún fichero; se enseña en directo con un fichero pequeño de prueba |
| OAuth 2.0 (Google) (1) | Botón "Continuar con Google" en `/login` | Ninguno | **PREPARAR**: requiere `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env` y el URI de redirección registrado en Google (ver README, "Configuration"); sin ellos el botón no funciona. Probar antes con una cuenta real |
| Monitorización Prometheus + Grafana (2) | Grafana en `:4150` (3 dashboards: Platform overview, NestJS backend, Infrastructure); `make smoke` comprueba targets y reglas. Demo de alerta: `docker compose stop backend` → `ServiceProbeFailed` pasa a Pending y luego Firing (~90 s); `docker compose start backend` la resuelve | No usa datos del seed | Listo. Para que los paneles de tráfico no estén vacíos, navegar un poco antes de enseñarlos |

Nota: la tabla del README suma 18 puntos; el objetivo del equipo es 14 (ver `AGENTS.md`). Antes de
la defensa conviene decidir qué módulos se presentan como reclamados.

## 4. Guion mínimo recomendado

1. `make re` y `make smoke` (todo en verde).
2. Preparar los datos marcados **PREPARAR** que se vayan a enseñar (intentos y calificaciones,
   un fichero, segunda organización, Google OAuth si se reclama) y cerrar sesión.
3. Alumno y profesor en dos navegadores: foro, notificación en vivo, entrega y calificación.
4. Administrador: usuarios, organización; plataforma: organizaciones.
5. Analíticas con los datos preparados; Grafana y la demo de alerta.
6. Mostrar los enlaces "Privacidad" y "Términos" del pie de página (visibles con y sin sesión).

## 5. Huecos conocidos de la demo

- El seed no genera actividad académica (intentos, calificaciones, ficheros): analíticas,
  libro de calificaciones y subida de ficheros dependen de datos creados a mano antes de la defensa.
  Si el equipo lo prefiere, ampliar `seed.ts` con intentos calificados evitaría el paso manual
  (es una decisión de producto/backend, no incluida aquí).
- Los usuarios `dev@example.com`, `diego@example.com` y `admin@example.com` (legado de desarrollo)
  conviven con las cuentas `*@demo`; no hay ninguna amistad ni notificación para estas últimas.
