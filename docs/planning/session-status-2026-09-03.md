# Estado de integración — 2026-09-03

Este documento consolida el trabajo realizado durante la revisión funcional del LMS, el diseño de la biblioteca de recursos y la corrección del despliegue. No sustituye los planes por propietario: sirve como punto de reanudación para la siguiente sesión.

## Terminado en la sesión

- **Biblioteca académica reutilizable.** Se ha incorporado `LearningResource`/`CourseResource`, con tipos `BOOK`, `DOCUMENT`, `LINK`, `VIDEO` y `AUDIO`; migración Prisma; API; página Biblioteca para staff y pestaña Recursos por curso. El diseño está en [`resource-library-design.md`](./resource-library-design.md).
- **Permisos de cursos reforzados.** El propietario de un curso queda matriculado como profesor al crearlo; se protegen curso, secciones, lecciones e inscripciones por pertenencia, rol de curso y organización. Se añadió una vista previa pública limitada para permitir la matrícula sin revelar contenido.
- **Recursos y archivos.** La descarga de un recurso comprueba organización, matrícula y publicación antes de entregar una URL. Se validan tipo y tamaño en backend; el almacenamiento local usa nombres no controlados por el cliente, se sirve detrás de Caddy/Vite y persiste en un volumen Docker. El driver S3 está implementado y probado de forma unitaria, pero no es el modo por defecto.
- **Alumno.** Se añadió el reproductor de actividades e intentos en frontend y se conectó a la API.
- **Calidad de frontend.** Se eliminaron importaciones circulares detectadas por Vite y se corrigió la autenticación de sockets en producción.
- **Seed.** El seed estándar, pequeño y grande conocen los modelos nuevos; las preguntas de demo ya usan el contrato real del motor de evaluación (`options: string[]`, `correct: number[]`, `answer: boolean`).
- **Seed y E2E multi-tenant.** Se añadió el escenario Prisma `e2e`, con `e2e-a` y `e2e-b`, un admin, un profesor y dos alumnos por organización. Corrige además la deduplicación de matrículas cuando un escenario tiene un único curso.
- **Sesiones simultáneas.** El hash temporal de una sesión ya no es un literal compartido: se genera criptográficamente por sesión antes de firmar el refresh token. Así dos logins o renovaciones concurrentes no chocan con el índice único de Prisma.
- **Ficheros huérfanos.** `FilesService` compensa una subida si falla el alta de metadatos y no permite borrar un fichero aún vinculado. La política de retención y el procedimiento de barrido seguro están en [`file-orphan-policy.md`](./file-orphan-policy.md); no se ha activado un cron de borrado.
- **Despliegue y objetos.** Compose incluye Garage 2.3 persistente en modo nodo único, con bucket y clave S3 aprovisionados al arrancar. `make garage-init`/`make garage-status` son idempotentes. El stack conserva almacenamiento local como predeterminado; `STORAGE_DRIVER=s3` activa el driver real.
- **Makefile.** `make urls` ya no ejecuta el archivo `.env` como shell (fallaba con valores que contienen espacios), y se corrige la resolución de variables internas de observabilidad para las invocaciones hechas por `make`.
- **Bootstrap Prisma reproducible.** El backend ejecuta `prisma migrate deploy` antes de arrancar y el comando configurado para `prisma db seed` vuelve a aplicar las migraciones versionadas antes del seed. `make db-deploy` expone esa operación sin crear migraciones nuevas.

## Validado

- `make` completo tras los ajustes de Makefile/Vite: Compose reconstruido, migraciones aplicadas y seed estándar ejecutado. `https://localhost:4443/health` respondió `{"status":"ok","database":"up"}`; `http://localhost:4180/health` redirige con `302` a HTTPS.
- Suite unitaria de backend: **29 suites, 279 tests correctos**.
- Integración backend (`test:integration`): **2 suites, 12 tests correctos** (HTTP auth y gateway realtime).
- Build de frontend y backend correcto; Vite ya no emite el aviso por `NODE_ENV` de Compose.
- `make ci` correcto: linters de infraestructura, instalación congelada, `prisma validate + generate` y build pasan. Semgrep/Trivy mantienen hallazgos **informativos** que no bloquean el pipeline.
- Playwright contra Compose/Caddy/HTTPS: **6/6 correctos** en Chromium de escritorio y viewport móvil. Cubre health/redirect, enlaces y contenido legal, y login del seed estándar a través de Caddy. La configuración conserva trace, captura y vídeo al fallar.
- Playwright multi-tenant contra Compose/Caddy/HTTPS: **3/3 correctos** con el seed `e2e`. Cubre lectura cruzada de cursos (404), RBAC de creación de curso (403), URL de fichero ajeno (403), dos entregas simultáneas con adjunto y rechazo de tareas/entregas cruzadas (404).
- Regresión de autenticación y ciclo de fichero: **30 tests correctos** en las suites de `AuthService` y `FilesService`, incluida la creación concurrente de sesiones y la compensación/retención de objetos. `make ci` volvió a pasar tras estos cambios; al cierre, la suite completa suma 29/279 y la integración 2/12.
- Revisión TLS local: `https://localhost:4443/health` mantiene TLS 1.3 y `http://localhost:4180/health` redirige 302 a HTTPS. Chromium 151 está disponible en el entorno. La CA local de Caddy no está aún instalada en el almacén de confianza del sistema (`openssl` devuelve `verify code 20`), por lo que no se puede declarar aprobado el certificado confiado en Chrome.
- Bootstrap desde cero de Prisma: en un proyecto Compose y volúmenes temporales, PostgreSQL vacío recibió las **4 migraciones** con solo `prisma db seed`; el seed estándar terminó correctamente y `prisma migrate status` informó esquema al día. Los recursos temporales se eliminaron al terminar la comprobación.
- Garage/S3 real: se validó con backend en `STORAGE_DRIVER=s3` una subida autorizada, generación de URL firmada, descarga byte a byte y borrado; el backend se restauró después a `STORAGE_DRIVER=local`.

## Pendiente prioritario para la siguiente sesión

1. **E2E automatizado.** La base Compose/HTTPS ya incluye el seed específico, cursos, ficheros, entregas y concurrencia mínima. Faltan recurso publicado/descarga con matrícula, calificación, actividades/intentos, sockets y las demás rutas del [`../testing/E2E_CHECKLIST.md`](../testing/E2E_CHECKLIST.md), sin volver a `x-dev-user`.
2. **Archivos no vinculados.** La política y las defensas inmediatas están implementadas. Antes de activar el barrido real faltan `dry-run`, versionado/copia de Garage confirmado, métrica/alerta y revisión de DevOps; no borrar automáticamente antes de ello.
3. **Gates obligatorios aún abiertos en el plan maestro.** Ejecutar revisión manual de teclado, lector de pantalla, contraste y zoom en Chromium/Chrome con la consola limpia; instalar/confiar la CA local de Caddy para que el certificado sea válido en Chrome; ampliar las pruebas de recuperación de sockets y matrices de roles.
4. **Higiene de entrega.** Pedir review de los commits por dominio y mantener el flujo `staging` → `master`.

## Commits de esta reanudación

- `46682f88` — biblioteca de recursos, almacenamiento local seguro y páginas legales.
- `ee722656` — autorización de cursos con aislamiento de tenant.
- `7ad37d13` — reproductor e intentos de actividades para alumnado.
- `3e65a645` y `5e000747` — autenticación de sockets y estabilización de Compose/Vite.
- `079d1d5f` y `6ce95084` — suites de integración y smoke E2E contra Compose.
- `e1350038` — Garage persistente y prueba S3 real.
- `3932d657` — seed y suite E2E de tenants, y corrección de sesiones concurrentes.
- `c2506d0a` — seguridad de metadatos de fichero y política de huérfanos.

## Riesgos o decisiones a conservar

- La migración `20260902174937_add_learning_resources` incluye también tablas/enums de actividades y adjuntos que estaban en el esquema pero no tenían migración histórica. Es necesario revisarla una vez en equipo antes de integrarla, pero no debe editarse manualmente en base de datos.
- El almacenamiento local sirve para desarrollo y demo autocontenida; Garage ya está disponible en Compose y debe activarse con `STORAGE_DRIVER=s3` solo usando las credenciales coordinadas del entorno.
- `apps/backend/dist` quedó con propietario `nobody` por una construcción anterior y bloqueó el build local. Es un directorio ignorado: si reaparece, limpiar/regenerar el artefacto desde un entorno con permisos correctos, sin tocar código fuente.
- El Dockerfile de frontend usa Node 24 mientras el stack declarado en `AGENTS.md` fija Node 22. Alinear esta versión antes de congelar la entrega o documentar explícitamente la excepción.
- La comprobación de consola se automatiza ahora en el smoke de páginas legales y login, pero no reemplaza una auditoría manual de accesibilidad ni el trust store de Chrome.
