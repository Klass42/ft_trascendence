# Checklist E2E del LMS

Este documento es la lista de aceptación end-to-end (E2E) para `ft_trascendence`. Un caso E2E se considera aprobado únicamente cuando recorre la aplicación desplegada tal y como la usará una persona: navegador Chrome → HTTPS/Caddy → frontend → API → PostgreSQL y, cuando proceda, almacenamiento y Socket.io.

No sustituye los tests unitarios o de integración. Su objetivo es comprobar que los módulos se conectan correctamente, que las autorizaciones se respetan y que no se pierden datos entre pantallas o usuarios.

## Cómo usar esta lista

- Cada ítem es un caso que debe acabar marcado con `[x]`, enlazado a su spec de Playwright y ejecutado en CI antes de pasar de `staging` a `master`.
- La etiqueta **Bloqueante** identifica requisitos de aceptación del proyecto o riesgos de seguridad. Ninguno puede quedar pendiente para la entrega.
- La etiqueta **Multiusuario** requiere al menos dos contextos de navegador independientes. La etiqueta **API** exige, además de revisar la UI, intentar directamente la ruta protegida con el usuario incorrecto y comprobar `401`, `403` o `404` según el contrato.
- Evitar `waitForTimeout`: esperar la respuesta, el mensaje de éxito/error o el cambio visible que confirme la operación. Los datos creados deben llevar un prefijo E2E único y limpiarse al terminar.
- Los checks de pantalla se ejecutan contra Chrome de escritorio y móvil. La suite final se ejecuta contra Compose usando `https://localhost:4443`, no solo contra Vite en `http://localhost:5173` ni mediante `x-dev-user`.

## Entorno y datos de prueba

Antes de cada ejecución completa:

- [ ] **E2E-SETUP-01 · Bloqueante** Levantar el stack desde cero con el único comando documentado (`make up` o equivalente), sin imágenes ni volúmenes previos, y esperar a que backend y base de datos estén sanos.
- [ ] **E2E-SETUP-02 · Bloqueante** Aplicar migraciones y cargar un seed idempotente diseñado para E2E; repetir la carga no debe crear duplicados ni dejar datos de una ejecución previa.
- [ ] **E2E-SETUP-03** Disponer de dos organizaciones distintas (`org-a`, `org-b`), un superadmin de plataforma, un admin y un profesor en `org-a`, dos alumnos de `org-a`, y un admin/profesor/alumno en `org-b`.
- [ ] **E2E-SETUP-04** Disponer en `org-a` de un curso publicado y otro borrador, secciones/lecciones, una actividad, una tarea abierta, una tarea futura y una cerrada; `org-b` debe tener recursos equivalentes con identificadores distintos.
- [ ] **E2E-SETUP-05** Disponer de ficheros de fixture válidos (PDF o PNG pequeño) e inválidos (tipo no permitido y tamaño por encima del límite), sin incluir datos personales ni secretos.
- [ ] **E2E-SETUP-06** La suite guarda trace, captura de pantalla y vídeo al fallar; adjunta la consola del navegador, las peticiones fallidas y los logs relevantes de backend para diagnosticarlo.

## Despliegue, red y smoke test

- [ ] **E2E-DEPLOY-01 · Bloqueante** Abrir la URL pública por HTTPS en Chrome y comprobar que el certificado es válido para el entorno (CA local confiada en desarrollo) y que no hay contenido mixto.
- [ ] **E2E-DEPLOY-02 · Bloqueante** Solicitar la URL HTTP pública y comprobar la redirección a la misma ruta HTTPS, incluido query string.
- [ ] **E2E-DEPLOY-03 · Bloqueante** Cargar `/health` a través del proxy y comprobar una respuesta sana que incluya la conectividad real con PostgreSQL.
- [ ] **E2E-DEPLOY-04** Recargar directamente una ruta SPA protegida y otra pública; ambas deben conservar la ruta o redirigir al login según corresponda, sin 404 del proxy.
- [ ] **E2E-DEPLOY-05** Navegar por la aplicación y descargar/subir un fichero: las peticiones API, fichero y Socket.io deben usar HTTPS/WSS y no exponer puertos internos de los contenedores.
- [ ] **E2E-DEPLOY-06** Reiniciar el contenedor del backend durante una sesión: la interfaz debe presentar un error recuperable y volver a funcionar tras la recuperación, sin corromper la operación en curso.
- [ ] **E2E-DEPLOY-07** Abrir Grafana, Prometheus, Tempo y Loki por sus URLs HTTPS configuradas; verificar que no son accesibles por HTTP plano y que el dashboard recibe datos después de usar la app.

## Páginas públicas, legales y navegación base

- [ ] **E2E-PUBLIC-01 · Bloqueante** Las páginas públicas de acceso son navegables sin sesión; una ruta privada redirige a login y, tras autenticarse, vuelve al destino inicial.
- [ ] **E2E-PUBLIC-02 · Bloqueante** El pie de página contiene enlaces accesibles a Política de privacidad y Términos de servicio; ambos muestran contenido real, legible y no una página vacía/404.
- [ ] **E2E-PUBLIC-03** Las rutas inexistentes muestran una página 404 útil, con una acción para volver a una página válida, sin error de consola.
- [ ] **E2E-PUBLIC-04** Abrir URL profundas de curso, lección, actividad, foro y tarea en una pestaña nueva conserva el estado y carga el recurso correcto.
- [ ] **E2E-PUBLIC-05** La navegación lateral y la navegación móvil solo muestran las secciones permitidas para el rol de la sesión.

## Autenticación y ciclo de sesión

- [ ] **E2E-AUTH-01 · Bloqueante** Registrar una cuenta con email, contraseña válida, nombre y organización válida; se crea en la organización correcta, inicia sesión y aparece en su panel.
- [ ] **E2E-AUTH-02 · Bloqueante** Validar en el formulario y en la API email malformado, campos vacíos, contraseña débil o confirmación distinta; no debe crearse ninguna cuenta.
- [ ] **E2E-AUTH-03 · Bloqueante** Intentar registrar el mismo email dos veces en la misma organización: se informa el conflicto sin revelar datos sensibles ni iniciar una segunda cuenta.
- [ ] **E2E-AUTH-04** Registrar el mismo email en otra organización, si el modelo multi-tenant lo permite, crea/inicia una cuenta aislada en esa organización; si se cambia la política, este caso debe reflejar explícitamente la nueva regla.
- [ ] **E2E-AUTH-05 · Bloqueante** Iniciar sesión con organización, email y contraseña correctos; la identidad, el rol y la organización mostrados coinciden con los del usuario autenticado.
- [ ] **E2E-AUTH-06 · Bloqueante** Intentar iniciar sesión con organización inexistente, email inexistente o contraseña incorrecta: se muestra un error genérico y no se filtra qué dato falló.
- [ ] **E2E-AUTH-07 · Bloqueante** Cerrar sesión invalida el refresh token, elimina el estado local y bloquea tanto una ruta protegida como una llamada API con el token revocado.
- [ ] **E2E-AUTH-08 · Multiusuario** Mantener dos sesiones del mismo usuario en navegadores distintos; renovar el access token de una no invalida la otra hasta que se cierre sesión o se cambie la contraseña.
- [ ] **E2E-AUTH-09 · Bloqueante** Con access token caducado y refresh token válido, una petición protegida se recupera una sola vez, conserva el trabajo de la pantalla y no crea un bucle de peticiones.
- [ ] **E2E-AUTH-10 · Bloqueante** Con access y refresh token inválidos/caducados, la sesión finaliza de forma limpia y el usuario vuelve a login.
- [ ] **E2E-AUTH-11** Cambiar contraseña exige la contraseña actual, valida la nueva en cliente y servidor, permite iniciar sesión con la nueva y rechaza la anterior.
- [ ] **E2E-AUTH-12 · Bloqueante** Tras cambiar la contraseña se revocan las demás sesiones y tokens de refresco; cada navegador previo queda desconectado.
- [ ] **E2E-AUTH-13** Verificar email con token válido marca la cuenta como verificada; token manipulado, caducado o reutilizado muestra un resultado seguro y no modifica la cuenta.
- [ ] **E2E-AUTH-14** Completar el flujo OAuth Google con cuenta de prueba: callback, asociación/creación de cuenta, organización, redirección y sesión correctas. Cancelar o denegar el proveedor no deja una sesión parcial.
- [ ] **E2E-AUTH-15 · API** Las rutas protegidas rechazan petición sin token, token malformado, token firmado con secreto incorrecto y token de otro usuario.

## Plataforma y organizaciones

- [ ] **E2E-PLATFORM-01 · Bloqueante** Un superadmin puede iniciar sesión en la plataforma y ver el listado de organizaciones; un usuario sin `SUPERADMIN` recibe acceso denegado tanto en UI como API.
- [ ] **E2E-PLATFORM-02** El superadmin crea una organización con nombre, slug, idioma, zona horaria, color y datos de primer administrador válidos; el slug debe ser único y el resultado genera una invitación utilizable.
- [ ] **E2E-PLATFORM-03** El formulario de aprovisionamiento bloquea slug inválido/duplicado, email inválido y campos requeridos vacíos, sin crear una organización parcial.
- [ ] **E2E-PLATFORM-04** Suspender o archivar una organización impide el acceso según la política definida y no afecta a organizaciones activas.
- [ ] **E2E-ORG-01 · Bloqueante** Un admin ve y actualiza únicamente los datos de su propia organización; modificar el `id` de la URL o llamar a la API de otra organización debe devolver prohibido/no encontrado.
- [ ] **E2E-ORG-02** Un admin invita a un email con rol válido. La invitación aparece pendiente, tiene caducidad y genera el log de auditoría correspondiente.
- [ ] **E2E-ORG-03** El destinatario abre la invitación válida, ve la organización y el rol previstos, define credenciales y entra en esa organización con el rol otorgado.
- [ ] **E2E-ORG-04 · Bloqueante** Una invitación revocada, caducada, manipulada o ya aceptada no puede crear cuenta ni entregar tokens; volver a invitar al mismo email restablece solo la invitación vigente.
- [ ] **E2E-ORG-05** Un admin lista miembros, no puede invitar un email ya miembro, y puede retirar a otro miembro de su organización sin afectar usuarios de otra.
- [ ] **E2E-ORG-06 · Bloqueante** Un profesor o alumno no puede crear/revocar invitaciones, editar datos de organización ni retirar miembros, aunque fuerce las rutas directamente.
- [ ] **E2E-ORG-07** Las acciones de aprovisionar, invitar, revocar y retirar producen registros de auditoría con actor, organización y destino correctos.

## Perfil, preferencias, amistades y presencia

- [ ] **E2E-USER-01** Editar nombre, bio, avatar y preferencias de idioma/notificaciones; recargar y abrir una nueva sesión confirma persistencia y formato correcto.
- [ ] **E2E-USER-02 · Bloqueante** Validar cliente y API para nombre/bio demasiado largos, URL de avatar inválida y valores de preferencias no permitidos; no debe guardarse una actualización parcial.
- [ ] **E2E-USER-03** Subir un avatar válido, ver su previsualización y confirmar que aparece en el perfil y navegación después de recargar.
- [ ] **E2E-USER-04 · Multiusuario** Enviar solicitud de amistad, aceptarla y comprobar que ambos usuarios ven el estado aceptado; rechazar/bloquear debe impedir la relación o visibilidad según la regla de producto.
- [ ] **E2E-USER-05 · API** Un usuario no puede leer ni modificar perfiles, amistades o preferencias de un usuario de otra organización, ni aceptar una solicitud que no le pertenece.
- [ ] **E2E-USER-06 · Multiusuario** Con dos navegadores conectados, el estado online/offline de un amigo cambia en la UI sin recargar; cerrar pestaña o perder conexión actualiza el estado de forma eventual.

## Administración de usuarios y RBAC

- [ ] **E2E-ADMIN-01 · Bloqueante** Un admin puede listar, buscar, crear, editar y desactivar/retirar usuarios de su organización, con mensajes de éxito y recarga consistente.
- [ ] **E2E-ADMIN-02** La búsqueda de usuarios no muestra miembros de otra organización y trata texto vacío, mayúsculas/minúsculas y ausencia de resultados.
- [ ] **E2E-ADMIN-03 · Bloqueante** El admin puede asignar únicamente roles globales válidos; el cambio se refleja en una sesión nueva del usuario y actualiza la navegación/permisos.
- [ ] **E2E-ADMIN-04 · API** Profesor y alumno no pueden consumir rutas de administración ni elevar su propio rol modificando el payload, la URL o almacenamiento local.
- [ ] **E2E-ADMIN-05** La baja de un usuario tiene el efecto documentado en su sesión, cursos, entregas y autoría histórica; no rompe listas, calificaciones ni foros.

## Aislamiento de tenants y autorización transversal

- [ ] **E2E-TENANT-01 · Bloqueante · API** Con una sesión de `org-a`, intentar leer, crear, editar o borrar por ID recursos de `org-b`: organización, usuario, curso, sección, lección, fichero, tarea, entrega, actividad, intento, foro y notificación. Cada operación debe ser rechazada y el recurso de `org-b` permanecer intacto.
- [ ] **E2E-TENANT-02 · Bloqueante** Repetir las pruebas anteriores alterando `organizationId` en query/body o empleando un ID válido de otra organización. La organización debe derivarse del token, nunca confiarse al cliente.
- [ ] **E2E-TENANT-03 · Multiusuario** Operaciones simultáneas de `org-a` y `org-b` con el mismo título/email/código de prueba no mezclan listados, notificaciones, ficheros ni resultados.
- [ ] **E2E-RBAC-01 · Bloqueante · API** Verificar la matriz mínima: superadmin de plataforma; admin global de organización; profesor; asistente de curso; alumno inscrito; alumno no inscrito. Cada operación de esta lista debe ejercitar al menos un permitido y un denegado.

## Cursos e inscripciones

- [ ] **E2E-COURSE-01** Profesor/admin crea un curso borrador con datos mínimos y opcionales; aparece para el creador pero no se ofrece a alumnos hasta publicarlo.
- [ ] **E2E-COURSE-02 · Bloqueante** Alumno no puede crear, editar, publicar, archivar ni eliminar un curso mediante UI o API.
- [ ] **E2E-COURSE-03** El propietario/profesor actualiza título, descripción, categoría, imagen, código y estado; al recargar persisten y los campos inválidos no se guardan.
- [ ] **E2E-COURSE-04** Publicar, devolver a borrador y archivar cambia la visibilidad y acciones disponibles de forma coherente para alumnado y personal.
- [ ] **E2E-COURSE-05** Eliminar un curso pide confirmación, desaparece del listado y aplica de forma coherente el borrado en cascada de secciones, lecciones, tareas, actividades, foros e inscripciones.
- [ ] **E2E-COURSE-06** Un alumno se inscribe con código correcto y ve el curso/panel; con código erróneo, inexistente o curso no disponible no se crea inscripción.
- [ ] **E2E-COURSE-07 · Multiusuario** Dos alumnos intentan inscribirse a la vez; cada uno termina con una sola inscripción y reintentar la propia no crea duplicados.
- [ ] **E2E-COURSE-08** Profesor/asistente ve el roster de su curso y actualiza el rol de curso dentro de los valores permitidos; alumno no ve ni puede forzar esta pestaña/ruta.
- [ ] **E2E-COURSE-09** Un usuario no inscrito no puede leer contenido, tareas, actividades, foro, calificaciones ni roster de un curso al que no tiene acceso.

## Autoría de contenido y progreso

- [ ] **E2E-CONTENT-01** Profesor crea, edita y elimina secciones y lecciones. Los títulos, Markdown, URL de vídeo y adjuntos aparecen correctamente al abrir la lección.
- [ ] **E2E-CONTENT-02** Reordenar secciones y lecciones persiste tras recargar y se ve en el mismo orden para otro alumno inscrito.
- [ ] **E2E-CONTENT-03 · Multiusuario** Dos docentes intentan reordenar simultáneamente: el resultado conserva una orden válida, sin IDs duplicados/perdidos; la UI se reconcilia con la respuesta del servidor.
- [ ] **E2E-CONTENT-04** El alumno visualiza Markdown seguro, vídeo y adjuntos de una lección; HTML/script incrustado no se ejecuta (prevención XSS).
- [ ] **E2E-CONTENT-05** Alumno marca una lección como completada. La marca es idempotente, sobrevive a recarga y el porcentaje de progreso del curso se recalcula correctamente.
- [ ] **E2E-CONTENT-06 · Multiusuario** Dos pestañas del mismo alumno marcan la misma lección: queda una única finalización y el progreso nunca supera 100%.
- [ ] **E2E-CONTENT-07 · API** Alumno no puede crear/editar/reordenar/borrar contenido ni adjuntar/quitar ficheros de una lección por llamada directa.

## Ficheros y almacenamiento

- [ ] **E2E-FILE-01 · Bloqueante** Subir un fichero permitido crea la referencia, muestra progreso/éxito, permite descargarlo por URL firmada y los bytes descargados coinciden con el fixture.
- [ ] **E2E-FILE-02 · Bloqueante** Validar tipo, extensión, MIME efectivo y tamaño en cliente y servidor; un fichero inválido no deja objeto huérfano ni registro `File`.
- [ ] **E2E-FILE-03** Adjuntar y desadjuntar fichero de lección, tarea y entrega actualiza inmediatamente ambas pantallas y persiste tras recargar.
- [ ] **E2E-FILE-04 · Bloqueante · API** Un usuario no puede descargar, adjuntar ni eliminar un fichero de otra organización o de un recurso al que no tiene acceso. Una URL firmada expirada deja de funcionar.
- [ ] **E2E-FILE-05** Fallo o reinicio del backend/almacenamiento durante carga muestra un error claro y permite reintentar; no deja asociaciones incompletas.
- [ ] **E2E-FILE-06** Eliminar un recurso con adjuntos aplica la política definida a los objetos y referencias, sin enlaces rotos ni archivos accesibles indebidamente.

## Tareas, entregas, corrección y libro de calificaciones

- [ ] **E2E-ASSIGN-01** Profesor crea una tarea con título, texto, nota máxima, ventana de apertura/cierre y adjuntos; alumnado inscrito la ve con fecha y recursos correctos.
- [ ] **E2E-ASSIGN-02 · Bloqueante** Validar campos obligatorios, puntuación positiva, fechas coherentes (`openAt ≤ dueAt ≤ closeAt`) y adjuntos inválidos en UI y API.
- [ ] **E2E-ASSIGN-03** Profesor edita y elimina una tarea; la eliminación confirmada borra/oculta sus entregas de forma consistente y el alumno no puede seguir entregando.
- [ ] **E2E-ASSIGN-04** Alumno entrega texto, fichero o ambos durante la ventana abierta. La entrega aparece una única vez en «mi entrega» y para el profesor.
- [ ] **E2E-ASSIGN-05 · Bloqueante** Antes de `openAt` y después de `closeAt`, la UI bloquea la entrega y la API la rechaza. Después de `dueAt` pero antes de cierre se crea estado `LATE` de acuerdo con el contrato.
- [ ] **E2E-ASSIGN-06 · Multiusuario** Dos pestañas del mismo alumno guardan/envían una entrega a la vez; se conserva una única entrega por `(assignmentId, userId)` sin error 500 ni pérdida silenciosa de contenido.
- [ ] **E2E-ASSIGN-07 · API** Alumno no puede listar entregas de otros ni corregir; profesor ajeno al curso no puede leer/corregir; alumno no inscrito no puede entregar.
- [ ] **E2E-ASSIGN-08** Profesor ve todas las entregas de su curso, asigna puntuación dentro del rango y feedback; el estado pasa a calificado y persiste tras recarga.
- [ ] **E2E-ASSIGN-09 · Bloqueante** Una nota negativa, mayor que la nota máxima o con payload manipulado es rechazada por la API y no cambia una calificación previa.
- [ ] **E2E-ASSIGN-10** Alumno solo ve su propia nota/feedback; la nota del profesor aparece sin recargar cuando el flujo real-time esté activo.
- [ ] **E2E-ASSIGN-11** El libro de calificaciones muestra la matriz correcta de alumnos × tareas y el CSV exportado contiene únicamente el curso/organización autorizados, encabezados y puntuaciones correctos.

## Actividades y motor de intentos

- [ ] **E2E-ACTIVITY-01** Profesor crea, edita, publica, archiva y elimina una actividad; un borrador no es iniciable por alumnado y una publicada sí.
- [ ] **E2E-ACTIVITY-02** Profesor añade, edita, elimina y reordena preguntas de todos los tipos soportados: opción múltiple, verdadero/falso, rellenar huecos, emparejar, ordenar y respuesta corta.
- [ ] **E2E-ACTIVITY-03 · Bloqueante** Formularios y API validan la forma JSON específica de cada tipo de pregunta, opciones/soluciones requeridas, puntos no negativos y configuración permitida; los payloads inválidos no crean preguntas corruptas.
- [ ] **E2E-ACTIVITY-04** Alumno inicia un intento, guarda respuestas parciales, recarga y continúa viendo las respuestas guardadas.
- [ ] **E2E-ACTIVITY-05** Enviar un intento autoevalúa las preguntas objetivas, escala la puntuación a `maxScore`, persiste respuestas/resultados y muestra el resultado conforme a la configuración de soluciones.
- [ ] **E2E-ACTIVITY-06** Una respuesta corta sin soluciones configuradas queda pendiente de corrección cuando corresponde; profesor la califica y el alumno ve la puntuación publicada.
- [ ] **E2E-ACTIVITY-07 · Bloqueante** Antes de apertura y después de cierre no se inicia/envía intento; tras `dueAt` se marca tardío según contrato; el límite de tiempo no permite guardar/enviar fuera de plazo.
- [ ] **E2E-ACTIVITY-08 · Multiusuario** Con límite de intentos, dos pestañas intentan iniciarlo a la vez: no se excede `attemptsAllowed`; con `0`, el número de intento incrementa correctamente y no duplica números.
- [ ] **E2E-ACTIVITY-09 · API** Alumno no puede autorizarse con ID de intento ajeno, editar preguntas, ni calificar; profesor de otro curso tampoco puede listar/calificar intentos.

## Foros

- [ ] **E2E-FORUM-01** Un miembro inscrito crea un hilo con título y mensaje inicial; aparece en el curso, se puede abrir por URL directa y muestra autor/fecha/conteo correctos.
- [ ] **E2E-FORUM-02** Crear respuesta y respuesta anidada actualiza el árbol sin perder nivel ni contenido después de recargar.
- [ ] **E2E-FORUM-03** Buscar por texto devuelve solo hilos del curso seleccionado, con cero resultados y términos especiales tratados de forma segura.
- [ ] **E2E-FORUM-04** Profesor/asistente fija y desfija un hilo; los fijados se muestran primero. Alumno no puede cambiar el pin mediante UI ni API.
- [ ] **E2E-FORUM-05 · Bloqueante · API** Usuario no inscrito o de otra organización no puede ver, crear hilo, publicar respuesta, buscar ni fijar contenido del foro.
- [ ] **E2E-FORUM-06 · Multiusuario** Dos usuarios publican respuestas al mismo tiempo: ambas persisten, el contador es exacto y la actualización en vivo llega sin recargar.

## Notificaciones y tiempo real

- [ ] **E2E-REALTIME-01 · Bloqueante** Abrir dos sesiones autenticadas y confirmar que el handshake Socket.io usa identidad válida. Una conexión sin token, token inválido o usuario inexistente es rechazada y no puede unirse a una sala de otro usuario.
- [ ] **E2E-REALTIME-02 · Multiusuario** Crear/publicar una tarea genera una notificación `NEW_ASSIGNMENT` para los destinatarios correctos, no para usuarios no inscritos ni de otra organización; aparece campana, contador y toast sin recargar.
- [ ] **E2E-REALTIME-03 · Multiusuario** Corregir una entrega genera `GRADE_PUBLISHED` únicamente para su autor, con enlace que abre la tarea correcta y estado legible/no leído.
- [ ] **E2E-REALTIME-04 · Multiusuario** Responder un hilo genera `FORUM_REPLY` para el destinatario definido por producto, no se duplica y abre el hilo/respuesta correctos.
- [ ] **E2E-REALTIME-05** La lista de notificaciones es paginable, se ordena de más reciente a más antigua, marcar una/ todas como leídas reduce el contador y conserva estado tras recargar.
- [ ] **E2E-REALTIME-06** Cortar y restablecer la red reconecta el socket; los eventos posteriores llegan una sola vez y una actualización realizada mientras no había conexión se recupera al refetch/reconexión según el contrato.
- [ ] **E2E-REALTIME-07 · API** Un usuario no puede leer, marcar ni usar el enlace de notificaciones pertenecientes a otro usuario.

## Calidad visible, accesibilidad y compatibilidad

- [ ] **E2E-UX-01 · Bloqueante** Recorrer los flujos críticos (registro/login, curso, lección, entrega y foro) sin errores ni warnings de consola, errores de red inesperados o React warnings.
- [ ] **E2E-UX-02 · Bloqueante** Ejecutar los flujos críticos en la versión estable más reciente de Google Chrome, con viewport de escritorio y móvil (aprox. 1280 px y 375 px), sin desbordamiento horizontal ni controles inaccesibles.
- [ ] **E2E-UX-03** Navegar formularios, modal, menú, selector, notificaciones y diálogos de confirmación solo con teclado: foco visible, orden lógico, Escape/cierre y retorno de foco correctos.
- [ ] **E2E-UX-04** Cada campo tiene etiqueta accesible y mensaje de error asociado; botones/iconos, imágenes y cambios de estado cuentan con nombre accesible/alt/anuncio adecuado.
- [ ] **E2E-UX-05** Ejecutar auditoría automatizada de accesibilidad (por ejemplo axe) en login, dashboard, curso, editor, tarea, foro, perfil y páginas legales: cero violaciones críticas/serias sin excepción justificada.
- [ ] **E2E-UX-06** Probar texto largo, caracteres Unicode/acentos, RTL si se habilita, zoom 200 % y preferencias de movimiento reducido: el contenido sigue siendo utilizable.

## Robustez, validación y concurrencia final

- [ ] **E2E-ROBUST-01 · Bloqueante** Para cada formulario anterior, enviar campos ausentes, demasiado largos, tipos incorrectos y JSON inesperado directamente a la API; el backend responde 4xx estructurado y la base de datos no queda alterada.
- [ ] **E2E-ROBUST-02 · Bloqueante** Introducir HTML/JavaScript en nombre, bio, Markdown, foro, tarea, feedback y búsqueda; al volver a visualizarlo no se ejecuta código ni se roba la sesión.
- [ ] **E2E-ROBUST-03** Simular API lenta, 4xx y 5xx para lecturas y mutaciones: la UI muestra carga/error/reintento, no duplica envíos y se recupera al volver el servicio.
- [ ] **E2E-ROBUST-04 · Multiusuario** Ejecutar en paralelo creación de usuario/invitación, inscripción, entrega, intento y respuesta de foro con datos idénticos. Se cumplen las restricciones únicas y se presenta un conflicto manejable, nunca error 500 o datos duplicados.
- [ ] **E2E-ROBUST-05** Tras una suite que falla a mitad de flujo, reiniciar seed/stack y repetirla: no depende del orden de ejecución, de estado del navegador ni de datos residuales.

## Flujos de aceptación completos

Estos son los recorridos que deben existir como specs independientes de alto valor. Reúnen varios casos anteriores y sirven como demostración final.

- [ ] **E2E-JOURNEY-01 · Bloqueante** Superadmin crea una organización e invitación; el administrador acepta, inicia sesión, configura organización e invita a un profesor y un alumno.
- [ ] **E2E-JOURNEY-02 · Bloqueante** Profesor crea y publica un curso, añade sección/lección con adjunto, crea una actividad y una tarea con fecha; alumno se inscribe y consume el contenido.
- [ ] **E2E-JOURNEY-03 · Bloqueante · Multiusuario** Alumno completa una lección, resuelve una actividad y entrega una tarea con fichero; profesor corrige; alumno recibe en vivo la notificación, ve la nota y el progreso; profesor exporta el libro de calificaciones.
- [ ] **E2E-JOURNEY-04 · Bloqueante · Multiusuario** Dos alumnos y un profesor mantienen una conversación de foro: hilo, respuesta, réplica anidada, fijado y búsqueda; las actualizaciones/notificaciones llegan sin recargar y no cruzan organizaciones.
- [ ] **E2E-JOURNEY-05 · Bloqueante** Repetir el recorrido principal desde una segunda organización, intentando deliberadamente acceder a las URLs e IDs de la primera; no se expone ningún dato ni acción.

## Cobertura existente y siguiente paso

Ya existen specs de Playwright para paneles, cursos, autoría de cursos/contenido, tareas, actividades, roster, perfil y presencia en `apps/frontend/e2e/`. Son una buena base, pero hoy usan el servidor Vite y autenticación de desarrollo. La prioridad es migrar los casos bloqueantes a una configuración E2E de Compose/HTTPS/JWT, separar los tests por los identificadores de esta lista y añadir los huecos de organización, aislamiento, ficheros, notificaciones, legales y despliegue.

La entrega está lista para evaluación solo cuando todos los ítems **Bloqueante** estén marcados, automatizados donde sea reproducible y con evidencia de la última ejecución en CI.
