# Errores y Warnings — Rol ADMIN

> Generado con Playwright · sesión: `admin@demo / demo1234 / org: klass`  
> Páginas visitadas: `/dashboard`, `/courses`, `/courses/:id`, `/notifications`, `/profile`, `/admin`, `/admin/users`

---

## E-A-01 · WebSocket cerrado antes de establecerse

**Mensaje**
```
WebSocket connection to 'wss://localhost:4443/socket.io/?EIO=4&transport=websocket&sid=...'
failed: WebSocket is closed before the connection is established.
```
**Tipo:** `warning`  
**Aparece en:** todas las páginas

**Qué significa**  
Socket.IO intenta conectar mediante WebSocket (upgrade desde HTTP). Al navegar entre páginas, el componente React que gestiona el socket se desmonta antes de que el handshake termine, cerrando la conexión prematuramente.

**Posibilidades de solución**

1. **Gestionar el ciclo de vida del socket correctamente (recomendado):** mover la instancia del socket a un contexto global (React Context / Zustand) que persista entre navegaciones, en lugar de crearlo en cada componente de página. Así el socket solo se crea una vez y no se destruye al cambiar de ruta.

2. **Forzar solo polling como transporte inicial:** configurar el cliente con `transports: ['polling', 'websocket']` para que negocie el upgrade de forma más ordenada y no lance el warning cuando la página cambia antes de completar el upgrade.

3. **Limpiar el socket en `useEffect` cleanup:** si el socket vive en un hook, asegurarse de que `socket.disconnect()` se llama en el cleanup del efecto. Evita reconexiones zombie pero no elimina el warning si el componente se desmonta durante el handshake.

---

## E-A-02 · HTTP 400 en socket.io polling

**Mensaje**
```
Failed to load resource: the server responded with a status of 400 ()
```
**URL afectada:** `https://localhost:4443/socket.io/?EIO=4&transport=polling&t=...&sid=...`  
**Tipo:** `error`  
**Aparece en:** todas las páginas

**Qué significa**  
Consecuencia directa de E-A-01. Cuando el WebSocket falla, Socket.IO intenta el fallback a long-polling con el mismo `sid`. El servidor rechaza el polling con 400 porque la sesión asociada a ese `sid` ya fue invalidada o nunca llegó a establecerse correctamente.

**Posibilidades de solución**

1. **Resolver E-A-01 primero:** si el socket no se destruye prematuramente, este 400 desaparece también.

2. **Configurar `allowUpgrades: false` en el servidor temporalmente (diagnóstico):** fuerza solo polling en el backend para aislar si el problema es del upgrade o de la gestión del ciclo de vida.

3. **Aumentar `pingTimeout` en el servidor:** da más margen para que el handshake complete antes de que el cliente abandone la sesión.

---

## E-A-03 · HTTP 404 en endpoints de progreso al visitar detalle de curso

**Mensaje**
```
Failed to load resource: the server responded with a status of 404 ()
```
**URLs afectadas:**
- `GET /api/courses/course-web-101/progress?organizationId=org-klass-0001&userId=...`
- `GET /api/courses/course-web-101/completed-lessons?organizationId=org-klass-0001&userId=...`

**Tipo:** `error`  
**Aparece en:** `/courses/:id`

**Qué significa**  
El frontend llama a estos endpoints para cualquier usuario que abre el detalle de un curso. Sin embargo, son endpoints semánticos de alumno (progreso personal, lecciones completadas). El backend no los tiene implementados para el rol ADMIN, o simplemente no existen aún en la API.

**Posibilidades de solución**

1. **Guard en el frontend por rol (recomendado):** solo hacer estas peticiones si el usuario tiene rol `STUDENT`. Un admin o teacher que visita un curso no necesita ver su propio progreso de alumno.

2. **Implementar los endpoints devolviendo vacío para roles no-alumno:** que el backend devuelva `{ progress: 0, completedLessons: [] }` para ADMIN/TEACHER en lugar de 404, tolerando la llamada aunque sea innecesaria.

3. **Unificar en un único endpoint `/api/courses/:id/my-progress`** que resuelva internamente según el rol del token JWT, devolviendo datos o un objeto vacío según corresponda.
