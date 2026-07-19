# Jorge — Plan 2 (Fase A · Identity, Admin & Roster)

> Segundo bloque (Fase A del rediseño, ver [`LMS-redesign.md`](./LMS-redesign.md)). Rama **`jorge`** →
> `staging`. Tu backend de auth/orgs/users/friends ya está; esto es sobre todo **UI + integrar tu
> frontend pendiente**, más un par de endpoints pequeños.

**Estándares (obligatorios, ver LMS-redesign §6):** componer `components/ui` (los nuevos de la Épica 0
de Aloiki) · responsive · estados vacío/carga/error · **sin mock** · validación front+back · a11y ·
cero errores de consola · **un test E2E Playwright** por flujo.

## Contrato anti-bloqueo
- **Consumes** la Épica 0 de Aloiki (componentes) → mientras no esté, construye contra sus props
  publicadas (Modal/Table/FormField/ConfirmDialog…). El `AdminDashboard` lo rellenas en el stub que
  deja Aloiki (no toques su fichero de split).
- **Entregas** un endpoint que otros pueden necesitar: `POST /auth/change-password` (ver A5).

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
      /courses/:courseId/enroll`), **añadir alumno** por email/lista (si falta endpoint de "staff añade a
      un userId", créalo pequeño en enrollments — es dominio de curso, coordina con Aloiki).
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
- [ ] Rellena el stub `AdminDashboard` (de Aloiki) con datos reales: usuarios (`GET /users`), nº cursos,
      info de organización (`GET /organizations/me`). Elimina KPIs hardcodeados ("1.284 usuarios", etc.).
- [ ] E2E: admin ve cifras reales, sin datos inventados.

## Consumes
- Componentes de Aloiki (Épica 0). Nada más te bloquea (tu backend existe).
