# Política de ficheros huérfanos

## Objetivo y alcance

Un fichero es un objeto de almacenamiento y una fila `File` de Prisma. Un huérfano es un objeto sin fila `File`, o una fila `File` que no está vinculada a un recurso, adjunto de lección, adjunto de tarea o entrega. La prioridad es no romper contenido ni borrar evidencia antes de tiempo; por ello esta política aplica tanto al driver local como a S3/Garage.

## Invariantes actuales

- La organización procede de la sesión autenticada; no se acepta del cliente.
- La validación de MIME/tamaño ocurre antes de escribir bytes.
- Si la escritura de metadatos falla después de subir bytes, el backend intenta borrar el objeto inmediatamente. Si ese borrado falla, registra la clave como huérfano inaccesible.
- `DELETE /files/:id` solo admite al uploader de la misma organización y rechaza un fichero con relaciones de recurso, lección, tarea, entrega, actividad, respuesta o avatar. Primero se elimina la fila, y después el objeto: un error del storage deja bytes no accesibles, nunca una relación viva sin bytes.
- Un recurso/adjunto se debe desvincular desde su endpoint de dominio antes de solicitar el borrado físico del fichero.
- Al borrar un recurso, el `File` que queda sin referencias conserva sus bytes durante el periodo de gracia. Al borrar una organización definitivamente, se capturan sus claves en la transacción de borrado y se eliminan los objetos después del commit; un error deja un huérfano inaccesible para revisión.

## Retención y barrido seguro

1. **Periodo de gracia:** mantener filas `File` no vinculadas al menos 30 días desde `createdAt`. Esto permite terminar formularios, reintentos de subida y recuperación de errores de cliente.
2. **Candidatos:** un trabajo de mantenimiento, inicialmente en modo `dry-run`, lista exclusivamente objetos con prefijo de organización que no tengan fila `File`, y filas no vinculadas que hayan superado los 30 días. Considera las relaciones de lección, tarea, entrega, actividad y recurso, además de los `fileIds` en `Answer.response` y las URLs de avatar. Nunca infiere pertenencia por el nombre original.
3. **Revalidación justo antes de borrar:** para cada candidato, volver a consultar por Prisma la fila, su `organizationId` y los cuatro tipos de relación. Si aparece cualquier relación o se modifica la fecha, se omite. Las consultas y el borrado se procesan por organización y en lotes pequeños.
4. **Auditoría y recuperación:** registrar organización, `fileId`/`objectKey`, causa, fecha de detección y resultado. Conservar el informe 90 días. En Garage/S3, habilitar versionado o un periodo de recuperación equivalente antes de activar borrado automático; en local, tomar copia del volumen antes de la primera ejecución productiva.
5. **Exclusiones:** no borrar mientras haya una investigación, retención legal, organización suspendida, error de storage o incertidumbre de referencias. Esos elementos pasan a una cola de revisión humana.

## Estado operativo

No hay cron de borrado automático aún. Antes de activarlo se necesita: revisión de DevOps, copia/versionado confirmado en el backend de objetos, métrica/alerta para errores de compensación y una ejecución `dry-run` revisada por un admin de plataforma. El borrado real debe hacerse mediante Prisma para filas y el driver de almacenamiento para bytes; nunca con SQL o comandos recursivos manuales.
