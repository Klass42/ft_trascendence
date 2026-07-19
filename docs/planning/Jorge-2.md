# Jorge — Plan 2 (Fase A · Identity, Admin & Roster)

> Segundo bloque (Fase A del rediseño, ver [`LMS-redesign.md`](./LMS-redesign.md)). Rama **`jorge`** →
> `staging`. Tu backend de auth/orgs/users/friends ya está; esto es sobre todo **UI + integrar tu
> frontend pendiente**, más un par de endpoints pequeños.

**Estándares (obligatorios, ver LMS-redesign §6):** componer `components/ui` (los nuevos de la Épica 0
de Aloiki) · responsive · estados vacío/carga/error · **sin mock** · validación front+back · a11y ·
cero errores de consola · **un test E2E Playwright** por flujo.

## Anti-bloqueo — trabajo auto-contenido
No tocas `prisma/` ni ficheros compartidos: **David absorbe lo bloqueante** (schema, split del
dashboard, harness E2E, endpoints compartidos) en su Épica D0. Tú:
- Consumes la **Épica 0** (componentes de `@/components/ui`) — ya en `staging`.
- Rellenas SOLO el stub `AdminDashboard` del split que hace David (no toques Student/Teacher).
- `POST /auth/change-password` (A5) es de tu dominio (auth) y no bloquea a nadie.
- Si el roster necesita un endpoint de "staff añade alumno" y no existe, se lo pides a David (D0) — no
  toques el módulo de enrollments (de Aloiki).

## Épica A6a — Integrar tu frontend de Organización/Amigos (Epic 7c, HOY sin mergear)
- [ ] Tu rama `jorge` tiene `OrgSettingsPage`, `OrgMembersPage`, rutas `/org`, hooks `useOrg`/
      `useOrgMembers` que **no están en `staging`**. Abre PR `jorge → staging` e intégralo (resuelve
      conflictos con lo ya mergeado).
- [ ] Verifica que las páginas usan el design system nuevo y cumplen la DoD (no las dejes a medio).
- [ ] E2E: admin entra a `/org`, edita ajustes y gestiona miembros.

## Épica A3 — Gestión de inscripciones / Roster (backend YA existe)
- [ ] Pestaña **"Alumnos"** en el curso (staff): lista de inscritos (`GET /courses/:id/enrollments`),
      con progreso por alumno (`GET /courses/:id/progress`).
- [ ] Cambiar rol ASSISTANT/STUDENT (`PATCH /enrollments/:id/role`), expulsar (`DELETE
      /courses/:courseId/enroll`), **añadir alumno** por email/lista (el endpoint "staff añade a un
      userId" lo provee David en D0 si falta; tú solo lo consumes).
- [ ] Reutiliza los patrones de tu `OrgMembersPage` (tabla + acciones).
- [ ] E2E: profesor ve el roster, cambia un rol y expulsa a un alumno.

## Épica A5 — Perfil y cuenta reales (hoy son toggles falsos)
- [ ] `ProfilePage`: **editar nombre** (`PATCH /users/me`), avatar (ya existe), y **cambiar contraseña**.
- [ ] **Backend nuevo**: `POST /auth/change-password` (verifica actual con argon2, setea nueva) —
      dominio auth, tuyo. DTO validado.
- [ ] Preferencias de notificación: si no hay backend, deja el toggle **funcional pero honesto** (o
      añade un campo simple), NO un div falso. 2FA: fuera de Fase A (quítalo o márcalo "próximamente"
      de verdad, no un toggle muerto).
- [ ] E2E: usuario cambia su nombre y su contraseña y vuelve a entrar con la nueva.

## Épica A4-admin — Des-mockear el AdminDashboard (backend YA existe)
- [ ] Rellena el stub `AdminDashboard` (del split que hace David en D0) con datos reales: usuarios
      (`GET /users`), nº cursos,
      info de organización (`GET /organizations/me`). Elimina KPIs hardcodeados ("1.284 usuarios", etc.).
- [ ] E2E: admin ve cifras reales, sin datos inventados.

## Consumes
- Componentes de Aloiki (Épica 0). Nada más te bloquea (tu backend existe).
