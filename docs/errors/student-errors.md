# Errores y Warnings — Rol STUDENT

> Generado con Playwright · sesión: `student@demo / demo1234 / org: klass`  
> Páginas visitadas: `/dashboard`, `/courses`, `/courses/:id`, `/courses/:id/assignments`, `/courses/:id/grades`, `/courses/:id/forums`, `/grades`, `/notifications`, `/profile`  
> Acciones realizadas: apertura de detalle de curso, navegación a subpáginas, intento de acceso a calificaciones

---

## E-S-01 · WebSocket cerrado antes de establecerse

**Mensaje**
```
WebSocket connection to 'wss://localhost:4443/socket.io/?EIO=4&transport=websocket&sid=...'
failed: WebSocket is closed before the connection is established.
```
**Tipo:** `warning`  
**Aparece en:** todas las páginas

**Qué significa**  
El cliente Socket.IO intenta abrir una conexión WebSocket al montar la página. La navegación SPA entre rutas destruye el componente (y el socket) antes de que el handshake termine, resultando en un cierre prematuro. El alumno lo ve en absolutamente todas las páginas de la app.

**Posibilidades de solución**

1. **Socket global persistente (recomendado):** inicializar el socket en un React Context de alto nivel (`NotificationsProvider` o similar que ya existe en el codebase) y no destruirlo al cambiar de página. Solo conectar una vez por sesión autenticada y desconectar solo al hacer logout.

2. **Opción de transporte ordenado:** configurar `{ transports: ['polling', 'websocket'] }` para que la conexión se establezca primero por polling y luego intente el upgrade, evitando el warning de "cerrado antes de establecerse".

3. **Retry con backoff exponencial:** añadir configuración de reconexión en el cliente (`reconnectionDelay`, `reconnectionAttempts`) para que los intentos fallidos no inunden la consola ni generen sesiones basura en el servidor.

---

## E-S-02 · HTTP 400 en socket.io polling

**Mensaje**
```
Failed to load resource: the server responded with a status of 400 ()
```
**URL afectada:** `https://localhost:4443/socket.io/?EIO=4&transport=polling&t=...&sid=...`  
**Tipo:** `error`  
**Aparece en:** todas las páginas

**Qué significa**  
Consecuencia directa de E-S-01. Tras fallar el WebSocket, Socket.IO intenta el fallback a long-polling con el `sid` de la sesión fallida. El servidor devuelve 400 porque ese `sid` ya fue invalidado o la sesión nunca se completó. Desde el punto de vista del alumno, las notificaciones en tiempo real no funcionan.

**Posibilidades de solución**

1. **Resolver E-S-01** elimina este error como efecto secundario.

2. **Revisar la configuración de Caddy** para que el proxy pase correctamente los headers WebSocket (`Upgrade`, `Connection`) al contenedor del backend. Sin este paso el upgrade nunca puede completarse independientemente del código.

3. **Añadir manejo de error en el cliente Socket.IO:** capturar el evento `connect_error` y mostrar un estado de "desconectado" en la UI en lugar de dejar que los errores aparezcan en consola sin control.

---

## E-S-03 · HTTP 404 en `/api/courses/:id/grades/me`

**Mensaje**
```
Failed to load resource: the server responded with a status of 404 ()
```
**URL afectada:** `GET /api/courses/cmtofdoxa000apb07cwgyh9kv/grades/me`  
**Tipo:** `error`  
**Aparece en:** `/grades` (página de calificaciones global del alumno)

**Qué significa**  
La página `/grades` consulta las calificaciones del alumno para un curso concreto llamando a `grades/me`. El endpoint devuelve 404, lo que puede significar dos cosas: (a) el endpoint no está implementado en el backend, o (b) el curso en cuestión (`cmtofdoxa000apb07cwgyh9kv`, creado durante los tests) no tiene datos de calificaciones porque es nuevo y no tiene entregas ni actividades evaluadas.

**Posibilidades de solución**

1. **Backend devuelve lista vacía en lugar de 404 (recomendado):** si no hay calificaciones para ese curso, el endpoint debería devolver `{ grades: [] }` con status 200. Un 404 debería reservarse para "el curso o el alumno no existen". Esto es el cambio de menor riesgo.

2. **Implementar el endpoint si falta:** verificar que `GET /api/courses/:id/grades/me` existe en el backend con su controlador, servicio y guard de autorización correspondientes. Si no existe, hay que crearlo.

3. **Guard en el frontend antes de llamar:** comprobar que el alumno está matriculado en el curso antes de solicitar sus calificaciones, evitando llamadas innecesarias a cursos a los que el alumno no pertenece.

---

## E-S-04 · Página `/grades` sin datos visibles para el alumno

**Mensaje**
```
Failed to load resource: the server responded with a status of 404 ()
```
**URL afectada:** `GET /api/courses/cmtofdoxa000apb07cwgyh9kv/grades/me`  
**Tipo:** `error`  
**Aparece en:** `/grades`

**Qué significa**  
Relacionado con E-S-03 pero desde el punto de vista de UX: cuando el endpoint falla con 404, el alumno ve la página de calificaciones vacía o con un error sin mensaje amigable. No sabe si no tiene calificaciones aún o si hay un problema técnico.

**Posibilidades de solución**

1. **Estado vacío explícito en el frontend:** mostrar un mensaje del tipo "Aún no tienes calificaciones en este curso" cuando la respuesta sea 404 o la lista venga vacía, en lugar de dejar la página en blanco o en estado de error.

2. **Distinguir 404 de "sin datos" en el frontend:** tratar el 404 del endpoint de grades como una lista vacía (`[]`) en el cliente, en lugar de propagarlo como error. Reservar el estado de error para fallos de red o 5xx.

3. **Añadir skeleton / loading state:** mientras carga, mostrar un esqueleto de tabla para que el alumno sepa que se está consultando, mejorando la percepción de rendimiento.
