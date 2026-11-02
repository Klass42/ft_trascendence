# Checklist de evaluación: demo limpia y qué enseñar

Guía para preparar la defensa. Qué datos tiene la demo, cómo dejarla limpia y en qué
pantalla se demuestra cada módulo de la [tabla de módulos del README](../README.md#modules).
Para el recorrido punto a punto del subject (código, por qué está bien, preguntas típicas) ver
[`defense-guide.md`](./defense-guide.md).

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
| `teacher@demo` | Profesor | Theo Teacher; docente de la asignatura "Introducción al Desarrollo Web"; tiene una notificación "Nueva entrega para corregir" |
| `student@demo` | Alumno | Sam Student; matriculado en las cohortes 2025-2026 y 2024-2025; una lección completada, solicitud de amistad pendiente de Diego, 3 notificaciones y actividad académica (ver más abajo) |
| `dev@example.com` | Alumno | Lucía Molina; amiga de Diego, con tres notificaciones, una lección completada y actividad académica calificada |
| `diego@example.com` | Profesor | Diego Torres; docente de la misma asignatura; autor del foro y de la plantilla "Examen mixto"; tiene una solicitud pendiente hacia Sam y una entrega por corregir |
| `admin@example.com` | Administrador | Admin Klass |
| `PLATFORM_SUPERADMIN_EMAIL` de `.env` (por defecto `admin@platform.local`) | Administrador de plataforma | Contraseña `PLATFORM_SUPERADMIN_PASSWORD` de `.env`; entra por `/platform/login`, sin código de organización |

Grafana: `https://localhost:4150`, usuario y contraseña de `.env` (`GF_SECURITY_ADMIN_USER` /
`GF_SECURITY_ADMIN_PASSWORD`).

Contenido que crea el seed estándar: dos cohortes "1º A" (2025-2026 activa, 2024-2025
archivada), dos asignaturas ("Introducción al Desarrollo Web" y su edición 2024-2025), dos
libros con tres lecciones, tres tareas publicadas en la asignatura activa ("Autoevaluación de la
unidad", cuestionario de opción múltiple y verdadero/falso; "Tarea · Ensayo y fichero"; y
"Quiz rápido · HTTP y HTML", que vence en 3 días y nadie ha empezado), la plantilla "Examen
mixto", un hilo de foro ("Presentaciones", con dos mensajes), una amistad aceptada (Lucía y
Diego) y una solicitud de amistad pendiente (Diego a Sam).

Actividad académica de la asignatura activa (fechas relativas al momento de ejecutar el seed,
repartidas en los últimos 9 días):

| Tarea | Lucía (`dev@example.com`) | Sam (`student@demo`) |
|---|---|---|
| Autoevaluación de la unidad (máx. 10) | Intento 1: 5/10 (hace 9 días); intento 2: 10/10 (hace 7 días); cuenta el mejor | Intento 1: 5/10 (hace 5 días), calificado automáticamente; le queda 1 intento |
| Tarea · Ensayo y fichero (máx. 10) | Calificada por Diego: 8,5/10, con comentario general y comentario en la respuesta del ensayo (hace 3 días, calificada hace 2) | Entregada hace 1 día, **por calificar** |
| Quiz rápido · HTTP y HTML (máx. 10) | Sin intentos | Sin intentos; es su "Próxima entrega" |

Notificaciones: Sam recibe "Tarea calificada" (quiz, leída), "Nueva tarea publicada" (quiz
rápido) y "Tienes una nueva solicitud de amistad"; Lucía, "Nota publicada" (la original),
"Nueva tarea publicada" y "Tarea calificada" (ensayo); Theo y Diego, "Nueva entrega para
corregir" (enlaza a `/grades` con el intento de Sam). Lecciones completadas: Lucía y Sam, la
primera cada uno.

Números esperados con `teacher@demo` o `diego@example.com` en `/analytics` (asignatura activa):
2 alumnos, 3 tareas, 3 lecciones; entregas 4/6 (67 %), 3 calificadas y 1 pendiente; nota media
78,3 % (50 %, 100 % y 85 %); distribución de notas: una en 50-60, una en 80-90 y una en 90-100;
entregas por día: 5 intentos entregados, uno cada día en los días -9, -7, -5, -3 y -1;
finalización de lecciones 2/6 (33 %); foro 1 hilo y 2 mensajes. Nota final del curso: Lucía
92,5 %, Sam 50 % (la tarea por calificar y el quiz rápido aún no cuentan). En `/grades` Sam
muestra "Por calificar" en el ensayo y en "Mis notas" el 5/10 del cuestionario.

**No crea:** ficheros subidos (las respuestas de tipo fichero van vacías, sin blobs), recursos de
biblioteca, invitaciones, otras organizaciones ni datos académicos de la cohorte archivada
2024-2025.

## 3. Módulo a pantalla con datos del seed

Módulos tomados de la tabla de [README.md](../README.md#modules). "Seed" = datos que existen tras
`make re` / `make db-seed`. Los marcados con **PREPARAR** necesitan datos que el seed no crea.

| Módulo (puntos) | Dónde se demuestra | Datos del seed | Estado |
|---|---|---|---|
| Framework front y back (2) | Código: React 19 + Vite (`apps/frontend`), NestJS 10 (`apps/backend`); toda la app sirve de demo | Cualquiera | Listo |
| WebSocket en tiempo real (2) | Dos navegadores: `teacher@demo` y `student@demo`. El profesor responde en el hilo "Presentaciones" (`/forums`) o califica; el alumno ve la campana (`/notifications`) actualizarse sin recargar. Presencia en `/friends` con `dev@example.com` y `diego@example.com` | Hilo "Presentaciones"; amistad Lucía-Diego | Listo (la presencia solo se ve entre Lucía y Diego; Sam solo tiene una solicitud pendiente de Diego) |
| ORM (1) | Código: `apps/backend/prisma/schema.prisma`, migraciones y `seed.ts` | Todo el seed | Listo |
| Gestión de usuarios estándar (2) | `/profile` (nombre, foto, contraseña, preferencias) con `student@demo`; `/admin/users` con `admin@demo`; `/friends` con `dev@example.com` | 6 usuarios de la org `klass`; amistad Lucía-Diego; solicitud pendiente Diego-Sam | Listo (con `student@demo` en `/friends` se acepta la solicitud de Diego; para enviar una nueva, buscar a otra persona) |
| Permisos avanzados / RBAC (2) | Entrar con los tres roles y comparar menús: el administrador ve Usuarios y Organización, el profesor Analíticas y Biblioteca, el alumno ninguno. Un alumno que abre `/analytics` vuelve al inicio. Aislamiento entre organizaciones: ver la fila Organización | Cuentas admin/teacher/student | Listo |
| Sistema de organizaciones (2) | `/platform/login` → Organizaciones (lista con Klass Academy, crear una nueva, ver detalle); `/org` y `/org/members` con `admin@demo`; invitar en `/admin/users/invite` | Org `klass`, 3 roles | **PREPARAR**: el seed estándar solo tiene una organización. Para enseñar aislamiento entre organizaciones, crear una segunda desde `/platform` antes de la defensa, o usar `make db-seed-small` / `make db-seed-e2e`, que **reemplazan** Klass Academy. No hay invitaciones pendientes: crearlas en directo |
| Sistema de notificaciones (1) | Campana y `/notifications`. Con `student@demo` aparecen la nota del cuestionario, la tarea nueva y la solicitud de amistad; con `teacher@demo`, "Nueva entrega para corregir". Más se generan al crear/editar contenido, responder en foros o calificar | Notificaciones para Sam, Lucía, Theo y Diego | Listo (para verlas llegar en vivo: el profesor califica la entrega de Sam o publica una tarea) |
| Dashboard de analíticas avanzadas (2) | `/analytics` con `teacher@demo` o `diego@example.com` (KPIs, entregas en el tiempo, distribución de notas, exportación CSV/PDF, refresco en vivo) | 5 intentos (4 calificados, 1 por calificar) repartidos en los últimos 9 días; números esperados en la sección 2 | Listo. En `/grades` el profesor puede calificar la entrega de Sam y ver cómo cambian los KPI en vivo. Calificarla altera los números de arriba; `make db-seed` los restaura |
| Subida de ficheros (1) | Alumno: entregar la tarea "Tarea · Ensayo y fichero" adjuntando un PNG/PDF (`/activities`); profesor: adjuntar un fichero en una lección o subir un recurso en `/resources`; foto de perfil en `/profile` | Pregunta de tipo fichero (máx. 3) en la tarea; los intentos del seed no llevan ficheros | **PREPARAR**: el seed no sube ningún fichero; se enseña en directo con un fichero pequeño de prueba: los dos alumnos ya han agotado el único intento del ensayo, así que o bien el profesor sube un fichero a una lección o a `/resources`, o bien crea una tarea nueva con una pregunta de fichero y `student@demo` la entrega |
| OAuth 2.0 (Google) (1) | Botón "Continuar con Google" en `/login` | Ninguno | **PREPARAR**: requiere `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env` y el URI de redirección registrado en Google (ver README, "Google OAuth setup"); sin `GOOGLE_CLIENT_ID` el botón no se muestra. Guion en la sección 6 |
| Monitorización Prometheus + Grafana (2) | Grafana en `:4150` (3 dashboards: Platform overview, NestJS backend, Infrastructure); `make smoke` comprueba targets y reglas. Demo de alerta: `docker compose stop backend` → `ServiceProbeFailed` pasa a Pending y luego Firing (~90 s); `docker compose start backend` la resuelve | No usa datos del seed | Listo. Para que los paneles de tráfico no estén vacíos, navegar un poco antes de enseñarlos |
| Design system propio (1, margen) | `/design` con `admin@demo`: paleta, tipografía y espaciado leídos de las variables CSS en vivo, iconos y los 19 componentes con variantes/estados; enseñar que el resto de pantallas usa los mismos componentes | Ninguno | Listo |
| Módulo a elección: motor de actividades (2, margen) | `teacher@demo`: crear actividad con varios tipos de bloque, vista previa (`preview/grade`, no escribe nada); `student@demo`: empezar intento, autoguardado, enviar → nota automática con crédito parcial; profesor corrige el ensayo a mano con feedback | Actividades e intentos del seed | Listo |
| Desactivar miembro (dentro de Organizaciones) | `admin@demo` → `/admin/users` → *Quitar* a un alumno con sesión abierta en otro navegador: se le corta el socket y la sesión; no puede volver a entrar; *Reactivar* lo devuelve con sus notas | Cualquier alumno | Listo (#134/#135) |
| Seguridad de registro (dentro de Gestión de usuarios) | `/register` con slug `klass` y un e-mail nuevo; repetir con un e-mail existente y con un slug inexistente | Ninguno | Listo: en producción (`make`) las tres respuestas son idénticas («recibirás un enlace para confirmar tu correo») y **no** se entregan tokens hasta verificar el e-mail (#74, #140). Fuera de producción la cuenta se auto-verifica y entra directamente |

Nota: la tabla del README reclama 18 puntos (el subject exige 14) + 3 de margen (design system y
módulo a elección) por si algún módulo no se valida.

## 4. Guion mínimo recomendado

1. `make re` y `make smoke` (todo en verde).
2. Preparar los datos marcados **PREPARAR** que se vayan a enseñar (un fichero, segunda
   organización, Google OAuth si se reclama) y cerrar sesión. Los intentos y calificaciones ya
   los crea el seed.
3. Alumno y profesor en dos navegadores: foro, notificación en vivo, entrega y calificación.
4. Administrador: usuarios, organización; plataforma: organizaciones.
5. Analíticas con los datos preparados; Grafana y la demo de alerta.
6. Mostrar los enlaces "Privacidad" y "Términos" del pie de página (visibles con y sin sesión).

## 5. Huecos conocidos de la demo

- El seed genera intentos y calificaciones, pero ningún fichero subido: la subida de ficheros se
  enseña en directo. Las fechas del seed son relativas al momento de ejecutarlo: si la demo se
  prepara con muchos días de antelación, volver a ejecutar `make db-seed` justo antes para que
  las gráficas por fecha y la "Próxima entrega" (3 días) sigan siendo coherentes.
- Los usuarios `dev@example.com`, `diego@example.com` y `admin@example.com` (legado de desarrollo)
  conviven con las cuentas `*@demo`; las cuentas `*@demo` solo tienen la actividad descrita en la sección 2.

## 6. Guion OAuth 2.0 (Google) (#136)

Preparación (una vez, antes de la defensa):

1. Cliente OAuth creado en Google Cloud (README, "Google OAuth setup") con redirect URI
   `https://localhost:4443/api/auth/google/callback` y las cuentas de la demo como *Test users*.
2. `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en el `.env` local (nunca en el repo); `make up`.
3. `curl -k https://localhost:4443/api/auth/providers` devuelve `{"google":true}` y en `/login`
   aparece "Continuar con Google".
4. Tener dos cuentas Google: una **nueva** (su e-mail no existe en `klass`) y otra cuyo e-mail
   coincida con un usuario existente de `klass` (crearlo antes o invitarlo con ese e-mail).

Demo:

| Paso | Acción | Resultado esperado |
|---|---|---|
| 1. Alta nueva | `/login`, slug `klass`, "Continuar con Google" con la cuenta nueva | Vuelve por `/auth/callback` y entra en Klass Academy como alumno nuevo; aparece en `/admin/users` (con `admin@demo`) |
| 2. Vincular e-mail existente | Cerrar sesión; "Continuar con Google" con la cuenta cuyo e-mail ya existe en `klass` | Entra como **ese** usuario (mismo nombre, rol y datos), sin crear un duplicado |
| 3. Login posterior | Cerrar sesión y repetir el paso 1 o 2 | Entra directamente, reutilizando la vinculación |
| 4. Errores (opcional) | Slug inexistente, o cuenta Google ya vinculada en otra org | Vuelve a `/login` con un error claro (`unknown_organization` / `wrong_organization`) |
| 5. Seguridad (explicar) | — | `state` firmado de un solo uso en cookie HttpOnly; secretos solo en `.env`; mismo par JWT que el login con contraseña |

## 7. Ensayo completo y cierre (#140)

Ensayo (en la máquina de la defensa, Chrome, consola de DevTools abierta):

1. `git switch staging && git pull` y comprobar que el CI de `staging` está en verde.
2. `make re` desde limpio (borra volúmenes; regenera `.env` solo si no existe) y luego
   `make smoke`: las 12 comprobaciones en verde.
3. Seguir el guion de la sección 4 módulo a módulo (tabla de la sección 3), con **cero errores
   en la consola** del navegador. Anotar cualquier error en una issue antes de seguir.
4. `docker compose stop backend` / `start backend` para la alerta de Grafana.
5. `make db-seed` al terminar para dejar los datos como al principio.

Cierre `staging → master` (lo hace el equipo, no automáticamente):

1. Todos los PR del plan mergeados en `staging` y CI en verde.
2. Ensayo anterior completado sin errores.
3. PR `staging → master`, revisión de al menos un compañero, merge.
4. En `master`: clon limpio, `make`, `make smoke`.

