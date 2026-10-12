# Biblioteca de recursos — diseño MVP

## Decisión

La academia necesita una **biblioteca de recursos reutilizables**, no un modelo `Book` aislado. Un libro es uno de los tipos de recurso, junto con documentos, enlaces, vídeos y audio. Los bytes permanecen en el modelo `File` y en el almacenamiento de objetos; esta funcionalidad solo añade metadatos, publicación y asignación a cursos.

No entra en este MVP: DRM, visor EPUB/PDF propio, anotaciones, préstamos, compra de licencias, carpetas anidadas, SCORM/xAPI ni versiones de un mismo recurso.

## Casos de uso que debe resolver

1. Un profesor sube una vez un PDF de libro, añade título, autores, idioma y licencia.
2. El profesor lo publica en uno o varios cursos que imparte.
3. Un alumno inscrito encuentra los recursos publicados de su curso, puede buscar/filtrar y abrir o descargar los permitidos.
4. Un recurso en borrador o archivado no es visible para alumnado.
5. Un alumno de otro curso u organización no puede enumerar, abrir ni obtener una URL de descarga del recurso.

## Modelo de datos

Se añaden los modelos `LearningResource` y `CourseResource` y los enums `LearningResourceType` y `LearningResourceStatus`.

`LearningResource` pertenece siempre a una organización e incluye:

- Identidad y propiedad: `id`, `organizationId`, `createdById`, `createdAt`, `updatedAt`, `publishedAt`.
- Catálogo: `title`, `description`, `type`, `authors String[]`, `publisher`, `isbn`, `language`, `license`, `tags String[]`.
- Contenido: exactamente una de estas fuentes en la validación de servicio: `fileId` para un archivo almacenado o `externalUrl` para un enlace externo.
- Ciclo de vida: `DRAFT`, `PUBLISHED`, `ARCHIVED`.

`CourseResource` es la relación muchos-a-muchos entre recurso y curso. Contiene `resourceId`, `courseId`, `order` y `required`; su clave compuesta evita duplicados. La relación es a nivel de curso. Para una lección concreta se siguen utilizando los adjuntos de lección existentes.

Los tipos del MVP son `BOOK`, `DOCUMENT`, `LINK`, `VIDEO` y `AUDIO`. Los metadatos como ISBN son opcionales: un libro puede ser un PDF interno sin ISBN.

## Permisos

- Un profesor o admin puede crear recursos de su organización.
- Solo el creador o un admin puede editar, archivar o borrar un recurso.
- Para vincular/desvincular un recurso a un curso, el actor debe ser staff (`TEACHER` o `ASSISTANT`) de ese curso, o admin de la organización.
- El alumno solo puede listar y abrir recursos `PUBLISHED` vinculados a cursos en los que está inscrito.
- Todas las consultas derivan la organización de la identidad autenticada; los IDs de curso/recurso nunca autorizan por sí solos.

## API y UI

Rutas de backend:

- `GET /resources`: biblioteca del staff, con búsqueda y filtros de tipo/estado.
- `POST /resources`: crear recurso a partir de metadatos y un `fileId` ya subido, o una URL externa.
- `GET/PATCH/DELETE /resources/:id`: detalle y gestión, sujetos a propiedad/admin.
- `POST /resources/:id/courses` y `DELETE /resources/:id/courses/:courseId`: publicar o retirar de un curso.
- `GET /courses/:courseId/resources`: recursos visibles para miembros del curso.

La UI añade una pantalla **Biblioteca** para staff y una pestaña **Recursos** en la página de curso. La primera permite crear, buscar y publicar; la segunda permite al alumno buscar, filtrar y abrir los recursos de ese curso.

## Archivos y seguridad

La URL de descarga de un `File` debe concederse tras comprobar que el usuario puede acceder al recurso que lo referencia. No basta con pertenecer a la misma organización. La validación de tipo/tamaño se hace en backend y frontend, y el driver S3/Garage debe subir, firmar y borrar objetos reales antes de considerar esta función lista.

## Criterios de aceptación

- Un PDF se puede crear como `BOOK`, publicar en dos cursos y conservar una única referencia de archivo.
- Un alumno inscrito en uno de esos cursos lo ve y puede descargarlo; un alumno de otro curso no lo ve ni obtiene URL.
- Un recurso borrador/archivado desaparece para alumnado sin borrar el archivo ni la relación histórica.
- Búsqueda por título/autores/etiquetas y filtros por tipo funcionan dentro de la organización y del curso.
- No se aceptan fuentes ausentes, ni `fileId` de otra organización, ni una combinación de archivo y URL externa.

## Estado de implementación (2026-09-03)

- Implementados: esquema y migración Prisma; CRUD y publicación en curso; UI de biblioteca y pestaña de curso; aislamiento por organización, rol y matrícula; validación de ficheros; y tests de servicio/controladores relevantes.
- Implementado para desarrollo: driver local persistente y acceso a los archivos a través de Caddy/Vite. El nombre original no se usa como ruta de disco.
- Implementado pero pendiente de infraestructura: driver S3 compatible con Garage (subir, firmar URL y borrar) y sus tests unitarios. Garage, bucket, credenciales y una prueba de subida real deben entregarse por separado antes de activar `STORAGE_DRIVER=s3`.
- Pendiente de aceptación: automatizar los criterios anteriores con Playwright y una prueba de descarga autorizada/no autorizada contra Compose.
