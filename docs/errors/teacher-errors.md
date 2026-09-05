# Errores y Warnings — Rol TEACHER

> Generado con Playwright · sesión: `teacher@demo / demo1234 / org: klass`  
> Páginas visitadas: `/dashboard`, `/courses`, `/courses/:id`, `/courses/:id/assignments`, `/courses/:id/grades`, `/courses/:id/forums`, `/courses/:id/roster`, `/profile`, `/notifications`  
> Acciones realizadas: creación de curso desde modal, navegación a detalle de curso recién creado

---

## E-T-01 · WebSocket cerrado antes de establecerse

**Mensaje**
```
WebSocket connection to 'wss://localhost:4443/socket.io/?EIO=4&transport=websocket&sid=...'
failed: WebSocket is closed before the connection is established.
```
**Tipo:** `warning`  
**Aparece en:** todas las páginas

**Qué significa**  
Idéntico a E-A-01. El socket se intenta abrir al montar el componente pero la navegación entre rutas lo destruye antes de que el handshake WebSocket termine.

**Posibilidades de solución**

1. **Socket global en un contexto React persistente (recomendado):** crear la conexión una sola vez en `App.tsx` o en un provider de alto nivel y reutilizarla en toda la app. El socket no se destruye al cambiar de página.

2. **Transporte inicial `polling` con upgrade posterior:** `transports: ['polling', 'websocket']` permite que la conexión se establezca de forma más robusta antes de intentar el upgrade a WS.

3. **Añadir cleanup explícito:** `return () => socket.disconnect()` en el `useEffect` que inicializa el socket, para evitar sesiones huérfanas en el servidor aunque no elimine el warning.

---

## E-T-02 · HTTP 400 en socket.io polling

**Mensaje**
```
Failed to load resource: the server responded with a status of 400 ()
```
**URL afectada:** `https://localhost:4443/socket.io/?EIO=4&transport=polling&t=...&sid=...`  
**Tipo:** `error`  
**Aparece en:** todas las páginas

**Qué significa**  
Consecuencia directa de E-T-01. El servidor rechaza el intento de fallback a polling porque la sesión (`sid`) ya está invalidada tras el fallo del WebSocket.

**Posibilidades de solución**

1. **Resolver E-T-01** elimina este error en cascada.

2. **Configurar `transports: ['polling']` en desarrollo** para desactivar temporalmente el upgrade WS y aislar si los 400 vienen del ciclo de vida o de la configuración del servidor.

3. **Revisar la configuración de Caddy/proxy** para asegurarse de que los headers `Upgrade: websocket` y `Connection: Upgrade` se pasan correctamente al backend. Un proxy mal configurado puede impedir el upgrade y forzar reintentos de polling que el servidor luego rechaza.

---

## E-T-03 · HTTP 404 al consultar progreso del curso siendo profesor

**Mensaje**
```
Failed to load resource: the server responded with a status of 404 ()
```
**URLs afectadas:**
- `GET /api/courses/:id/progress?organizationId=...&userId=...`
- `GET /api/courses/:id/completed-lessons?organizationId=...&userId=...`

**Tipo:** `error`  
**Aparece en:** `/courses/:id` (detalle de cualquier curso)

**Qué significa**  
El frontend solicita el progreso personal y las lecciones completadas para el usuario logado, sin distinguir el rol. Estos endpoints están pensados para alumnos. Un profesor que abre su propio curso ve errores 404 porque el backend no tiene esas rutas implementadas (o no las devuelve) para el rol TEACHER.

**Posibilidades de solución**

1. **Guard por rol en el frontend (recomendado):** en el hook o componente que dispara estas peticiones, comprobar `user.role === 'STUDENT'` antes de llamar. Un profesor no necesita ver su propio progreso como alumno.

2. **Devolver respuesta vacía en el backend para no-alumnos:** implementar los endpoints de forma que devuelvan `{ progress: 0 }` y `[]` respectivamente cuando el rol del JWT no es STUDENT, evitando el 404 y haciendo el sistema más tolerante.

3. **Endpoint unificado con lógica de rol:** sustituir ambas llamadas por un único `GET /api/courses/:id/my-context` que devuelva datos distintos según el rol (progreso para alumno, estadísticas de clase para profesor).

---

## E-T-04 · Curso recién creado devuelve 404 en endpoints de progreso

**Mensaje**
```
Failed to load resource: the server responded with a status of 404 ()
```
**URLs afectadas:**
- `GET /api/courses/cmtofdoxa000apb07cwgyh9kv/progress?...`
- `GET /api/courses/cmtofdoxa000apb07cwgyh9kv/completed-lessons?...`

**Tipo:** `error`  
**Aparece en:** `/courses/:id` inmediatamente tras crear un curso nuevo

**Qué significa**  
Al crear un curso y navegar a su detalle, el frontend lanza las mismas llamadas de progreso/lecciones completadas que en E-T-03, ahora para un curso que acaba de nacer y no tiene datos de progreso. Doble problema: el rol no es alumno, y aunque lo fuera el curso no tiene lecciones ni matrículas aún.

**Posibilidades de solución**

1. **Resolver E-T-03** elimina estas llamadas para roles no-alumno en cualquier curso.

2. **Backend resiliente:** si los endpoints existen para alumnos, deben devolver valores vacíos (`0` / `[]`) cuando no hay datos en lugar de 404. Un 404 debería reservarse para "el curso no existe", no para "no hay progreso aún".

3. **Redirigir al profesor a la vista de edición tras crear un curso:** evitar la vista de detalle de alumno justo después de la creación, navegando directamente al panel de gestión del curso donde estas llamadas no se hacen.
