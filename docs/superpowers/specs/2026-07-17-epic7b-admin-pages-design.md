# Epic 7b — Frontend Admin User Pages (Design Spec)

**Owner:** Jorge (@SrJorgeG) — Identity & Access, Tech Lead
**Branch:** `jorge` → `staging` → `master`
**Date:** 2026-07-17
**Status:** Draft
**Scope:** Sub-epic 7b of `docs/planning/Jorge.md` Epic 7. Epic 7a (auth pages) is done.
Epic 7c (org settings + member management) is out of scope and will be a separate spec.

---

## 1. Purpose

Build the admin user-management frontend (`features/admin/`) that consumes the
backend CRUD already shipped in Epic 5 (`GET/POST/PATCH/DELETE /users[/:id]`).
An ADMIN can list every user in their organization, create a new one, edit
name/email/role/bio, and delete any user other than themselves.

This is the frontend half of the "Advanced permissions" Major module: the
backend RBAC is done, the UI closes the loop with real, usable admin tooling.

---

## 2. Constraints (hard)

- **Reuse Aloiki's design system** — `Button`, `Input`, `Card`, `Spinner` from
  `components/ui`. No new component primitives (matches Epic 7a rule). Native
  `<select>` and `<textarea>` are styled directly, not wrapped as new primitives.
- **Reuse `ProtectedRoute`'s existing `roles` prop** — it already redirects to
  `/login` if unauthenticated and renders a forbidden view if the role doesn't
  match. No new guard component.
- **Reuse `useIsAdmin()` / `useHasRole()` hooks** — already exported from
  `lib/api/auth-context.tsx`. No new auth hooks.
- **No new backend code** — all endpoints already exist. If a needed field is
  missing from a backend DTO, request it instead of patching locally.
- **No form library** — plain React `useState` + per-field validation, mirroring
  `RegisterPage` and `LoginPage`.
- **Validation mirrors backend** — same rules as `CreateUserDto` (email format,
  password ≥8 + upper/lower/digit, name ≥1) and `UpdateUserDto` (all optional,
  same field-level rules).
- **Spanish UI text** — matches `LoginPage`, `RegisterPage`, `ProfilePage`.
- **No new dependencies** — imports only from `react`, `react-router-dom`,
  `lucide-react`, `@/lib/api`, `@/components/ui`.
- **Fetch pattern follows `useCourses.ts`** (Aloiki's pattern): `useState` for
  data/loading/error, `useEffect` with `cancelled` flag, cleanup on unmount.
- **Single-organization scope assumed** — the backend reads `@CurrentUser()`'s
  `organizationId`; the frontend never passes it as a query param.

---

## 3. Design decisions (from brainstorm)

| Topic | Decision | Rationale |
|---|---|---|
| Scope split | **7b admin only** — 7c org will be its own spec | Keeps the methodology of one focused epic per iteration (matches Epics 4/5/6) |
| Actions covered | **Full CRUD: list + create + edit + delete** | User chose this; backend already supports it |
| Edit UX | **Dedicated page `/admin/users/:id`** | Mirrors `/courses/:courseId` pattern; bookmarkable; no Modal primitive needed |
| Delete confirmation | **Double-press in 5s window** | No Modal primitive; user chose this; deterministic on touch + click |
| List layout | **HTML `<table>` styled via `.module.css`** | Semantic, accessible, responsive via media query; no new component |
| Nav item | **Single item "Usuarios" → `/admin/users`**, `adminOnly: true` | Minimal; if 7c adds `/admin/settings`, separate nav item then |
| Self-edit handling | **Disable out-of-bounds fields inline** | Prevent the 400 (backend blocks self-role-change and self-delete); keeps other fields editable |
| Fetch/mutation hooks | **`useUsers` + `useUser` for fetch; mutations inline in pages** | Mirrors `useCourses` pattern; mutations used once each, no shared hook needed (YAGNI) |

---

## 4. Architecture

```
User navigates /admin/users
        │
        ▼
ProtectedRoute roles={['ADMIN']}  ──── role mismatch → forbidden view
        │ ok
        ▼
AdminUsersPage
   └─ useUsers()  GET /users  →  fetchUserDTO[]
                            │
                            └─ renders <table> + Editar button ──→ navigate /admin/users/:id
                                          └─ + Nuevo usuario button ──→ navigate /admin/users/new

User navigates /admin/users/new
   └─ AdminUserCreatePage
        └─ <UserForm mode="create" onSubmit={POST /users} />
              └─ 201 → navigate /admin/users
              └─ 409 → email field error
              └─ 400 ValidationError → per-field error mapping

User navigates /admin/users/:id
   └─ AdminUserEditPage
        ├─ useUser(id) GET /users/:id → fetchUserDTO
        ├─ <UserForm mode="edit" initial={data} isSelf={id===user.userId} onSubmit={PATCH /users/:id} />
        └─ Delete section (hidden if isSelf):
              └─ 1st click → "Confirmar eliminación" (danger style, 5s window)
              └─ 2nd click → DELETE /users/:id → 204 → navigate /admin/users
```

### Architectural choices

- **Nested `ProtectedRoute`** for the `/admin/*` subtree: one outer route
  `path: 'admin'` with `roles={['ADMIN']}`, children are the three leaf routes.
  Avoids tripling the `roles` check and gives room for `/admin/settings` later.
- **`UserForm` is internal to `features/admin`**, not a shared primitive.
  It's only ever used in admin user create/edit. If a generic form library
  emerges later it can be promoted; today it stays local.
- **Hooks for read, inline calls for write.** Reads are cached/reusable state
  (`useUsers`, `useUser`); writes are page-local `useState` (loading/error per
  action). Mirrors `useCourses` (read) vs `RegisterPage` (write inline).

---

## 5. Routes

| Route | Component | Access |
|---|---|---|
| `/admin/users` | `AdminUsersPage` | `ProtectedRoute roles={['ADMIN']}` |
| `/admin/users/new` | `AdminUserCreatePage` | `ProtectedRoute roles={['ADMIN']}` |
| `/admin/users/:id` | `AdminUserEditPage` | `ProtectedRoute roles={['ADMIN']}` |

Routes are nested under the existing default `ProtectedRoute` + `AppLayout`
parent so the sidebar/notifications chrome continues to render. The admin
subtree adds its own `roles={['ADMIN']}` filter.

---

## 6. File layout

```
apps/frontend/src/features/admin/        NEW directory
├── AdminUsersPage.tsx
├── AdminUsersPage.module.css
├── AdminUserCreatePage.tsx
├── AdminUserEditPage.tsx
├── AdminUserEditPage.module.css
├── UserForm.tsx
├── UserForm.module.css
├── types.ts
└── index.ts

apps/frontend/src/lib/api/hooks/
└── useUsers.ts                            NEW (mirrors useCourses.ts)

apps/frontend/src/app/
├── AppLayout.tsx                          MODIFY: add adminOnly nav item
└── routes.tsx                             MODIFY: add 3 lazy admin routes
```

No changes to `components/ui/`, `lib/api/auth-context.tsx`, `lib/api/client.ts`,
or any backend file.

---

## 7. Types (`features/admin/types.ts`)

```ts
import type { GlobalRole } from '@/lib/api/types';

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: GlobalRole;
  bio: string | null;
  onlineAt: string | null;
  emailVerifiedAt: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: GlobalRole;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: GlobalRole;
  bio?: string;
}
```

These mirror the backend `selectUser` Prisma projection. Dates are ISO strings
(the global `BigInt.toJSON` patch + `JSON.stringify` on the backend already
serialize `Date`s this way).

---

## 8. Hooks (`lib/api/hooks/useUsers.ts`)

### `useUsers(): { data: UserDTO[] | null; isLoading: boolean; error: Error | null }`

Pattern identical to `useCourses.ts:1-48`:
- `useState` for data/loading/error (initial loading = true).
- `useEffect` with `let cancelled = false` flag + empty-dep cleanup.
- `apiClient.get<UserDTO[]>('/users')`.
- No query params — backend reads the authenticated user's `organizationId`
  via `@CurrentUser()`.

### `useUser(id: string | undefined): { data: UserDTO | null; isLoading: boolean; error: Error | null }`

Same pattern, depends on `id`:
- If `id` is undefined → `setIsLoading(false)` immediately, no request.
- Otherwise `apiClient.get<UserDTO>(`/users/${id}`)`.
- Re-fetches when `id` changes (dep array `[id]`).

Hooks live in `lib/api/hooks/` alongside `useCourses.ts`, and barrel-export
through that directory's `index.ts` (add the new export).

---

## 9. AdminUsersPage (`/admin/users`)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Usuarios                          [Nuevo usuario]  │   ← header row
├─────────────────────────────────────────────────────┤
│  Nombre        Email              Rol     Acciones  │   ← <thead>
│  Lucía M.      lucia@demo          Alumno  [Editar]  │
│  ...                                                 │
└─────────────────────────────────────────────────────┘
```

States:
- `isLoading` → `<Spinner label="Cargando usuarios..." />`
- `error` → red banner "No se pudieron cargar los usuarios."
- `data && data.length === 0` → "Aún no hay usuarios."
- `data && data.length` → `<table>` (below).

Table:
- `<table className={styles.table}>` with `<thead>` and `<tbody>`.
- Header cells: "Nombre", "Email", "Rol", "Acciones".
- Role rendered as text capitalised via a small `ROLE_LABEL` map:
  `ADMIN → Admin`, `TEACHER → Profesor`, `STUDENT → Alumno`.
- Acciones cell: `<Button variant="ghost" size="sm"` + `lucide-react` `<Pencil>`
  icon, label `Editar`, `onClick={() => navigate(`\`/admin/users/${u.id}\``)}`.
- "Nuevo usuario" button top-right via `<Button variant="primary" ...>` +
  `<UserPlus>` icon → `navigate('/admin/users/new')`.

Responsive:
- `@media (max-width: 768px)`: hide the Email column via
  `.${styles.emailCell} { display: none; }` in `.module.css`.
- No horizontal scroll; the table stays within the main content width.

No pagination, no search, no filter: scope-1 deploy orgs are small (seed = 8
rows). Deferred to a future iteration if needed.

---

## 10. AdminUserCreatePage (`/admin/users/new`)

- Container with same max-width pattern as `LoginPage`/`RegisterPage`
  (`maxWidth: 480px`, centered card).
- Title: "Nuevo usuario". Subtitle: "Crea una cuenta para un miembro de tu organización.".
- Renders `<UserForm mode="create" onSubmit={onCreate} />`.
- `onCreate(values) → Promise<ApiError | void>`:
  - `apiClient.post<UserDTO>('/users', values)` → return `void`.
  - Catch `ApiError`: if `isConflict` (409) → return ApiError to pin on email
    field. Other errors → return ApiError for generic banner.
- After `onSubmit` resolves `void`: `navigate('/admin/users')`.
- Footer link below card: `<Link to="/admin/users">← Volver a usuarios</Link>`.

---

## 11. AdminUserEditPage (`/admin/users/:id`)

- Reads `id` from `useParams()`, calls `useUser(id)`.
- States:
  - `isLoading` → Spinner.
  - `error || (data && 404 path)` → "Usuario no encontrado." + button
    "Volver a usuarios" (`navigate('/admin/users')`).
  - `data` → render the form + delete section.
- Title: "Editar usuario". Subtitle: `data.name`.
- Back link below the title: `<Link to="/admin/users">← Volver a
  usuarios</Link>` (mirrors the create page's back link, so the admin can
  exit without editing or deleting).
- Renders `<UserForm mode="edit" initial={data} isSelf={id === user.userId}
  onSubmit={onUpdate} />`.
- `onUpdate(values) → Promise<ApiError | void>`:
  - Diff `values` against `initial` to omit unchanged fields (avoid sending
    `undefined` for fields the user didn't touch; matches `UpdateUserInput`'s
    all-optional shape).
  - `apiClient.patch<UserDTO>(`/users/${id}`, diff)` → `void`.
  - Catch `ApiError`: 409 → email field; 400 `Cannot change your own role` →
    generic banner (the dropdown should already be disabled if `isSelf`, but
    handle defensively); other → banner.

### Delete section (below the form, separated visually)

- If `isSelf` (`id === user.userId`):
  - Render only an info box: "No puedes eliminar tu propia cuenta desde aquí.
    Usa tu Perfil para gestionar tu avatar y datos personales."
  - No delete button.
- Else:
  - Section titled "Zona de peligro" with light red border.
  - `<Button variant="danger" onClick={handleDelete}>`:
    1. First click: set `confirmingDelete = true`, start a 5-second timer
       (`setTimeout(() => setConfirmingDelete(false), 5000)`). Button label
       changes to "Confirmar eliminación", danger style emphasized.
    2. Second click (while `confirmingDelete` is true): cancel the timer,
       call `apiClient.delete(`/users/${id}`)`:
       - 204 → `navigate('/admin/users')`.
       - 400 (defensive, should be unreachable since `isSelf` is hidden) →
         banner with backend message.
    3. If timer expires without 2nd click → revert to "Eliminar usuario".
- `<Button variant="ghost"` labeled "Cancelar" resets to initial state.

A small touch: also revert `confirmingDelete` if the user unmounts the page
(cleanup the timeout in `useEffect`).

---

## 12. UserForm (`features/admin/UserForm.tsx`, internal)

### Props

```ts
interface UserFormProps {
  mode: 'create' | 'edit';
  initial?: UserDTO;
  isSelf?: boolean;
  onSubmit: (values: FormValues) => Promise<ApiError | null>;
}

interface FormValues {
  name: string;
  email: string;
  password?: string;       // only for create
  role: GlobalRole;
  bio: string;
}
```

### Fields

| Field | Input | Rules (same as backend DTOs) |
|---|---|---|
| `name` | `Input type="text"` | required, minLength 1 |
| `email` | `Input type="email"` | required, email regex |
| `password` | `Input type="password"` | **create only**: required, ≥8, regex `(?=.*[a-z])(?=.*[A-Z])(?=.*\d)` |
| `role` | native `<select>` (ADMIN/TEACHER/STUDENT) | required (defaults to STUDENT on create) |
| `bio` | native `<textarea>` | optional |

### `isSelf` handling (edit only)

- If `isSelf === true`:
  - The role `<select>` is `disabled`, with hint text below: "No puedes cambiar
    tu propio rol."
  - The password field isn't rendered anyway (only create shows password).
  - `name`, `email`, `bio` remain editable.

### Submit

- Validate per-field synchronously (build `Record<fieldName, string>` of
  errors; if any → return without calling `onSubmit`).
- Clear individual error `onChange` of each field (same pattern as
  `RegisterPage`).
- Show per-field error via `Input`'s `error` prop.
- Build `FormValues` object, call `onSubmit`.
- Set `isSubmitting = true` while awaiting; render
  `<Button loading={isSubmitting}>` accordingly.
- If `onSubmit` returns an `ApiError`:
  - If `isConflict` (409) → set email field error "Este email ya está
    registrado".
  - Else if `isValidationError` (400 with `errors[]`) → heuristic mapping:
    if any error string in `errors` contains the field name (e.g. `name`,
    `email`, `password`, `bio`), pin the message to that field; remaining
    messages fall back to a top-of-form banner above the form.
  - Else → show top-of-form banner with `ApiError.message`.
- If `onSubmit` returns `null` → caller navigates away; nothing more to do.

### Buttons

- Create: `<Button type="submit" variant="primary" loading={isSubmitting}>
  Crear usuario</Button>`.
- Edit: `<Button type="submit" variant="primary" loading={isSubmitting}>
  Guardar cambios</Button>`.
- No "Cancelar" button inside the form (caller renders its own back link and
  the edit page renders its own delete section).

### Styling

- `UserForm.module.css` for form spacing, fallback to `style={{}}` only where
  the project does that already (mirrors `RegisterPage.module.css`).
- `<select>` and `<textarea>` are styled minimally to match `Input`'s border
  radius and focus ring (read tokens.css via CSS variable names).

---

## 13. AppLayout nav changes

In `apps/frontend/src/app/AppLayout.tsx`, add to `NAV_ITEMS`:

```ts
{
  to: '/admin/users',
  icon: <Users size={20} />,
  label: 'Usuarios',
  adminOnly: true,
},
```

`Users` already exists in `lucide-react` (no new import cost). Add the
render-time guard, mirroring the existing `staffOnly`/`student`/`teacher`
pattern:

```ts
if ('adminOnly' in item && item.adminOnly && user?.role !== 'ADMIN') {
  return null;
}
```

Place the admin item visually near the bottom of the nav, just above the
"Perfil / collapse" separator, so it doesn't crowd the content items.
Order: dashboard, courses, assignments, forums, grades, analytics, **Usuarios**
(admin), then navBottom (Perfil + collapse).

The TypeScript literal `as const` array needs the new `adminOnly?: boolean`
optional flag to type-check; widen the type accordingly (or add a typed
interface) — keep it as small a change as possible.

---

## 14. Routes wiring (`app/routes.tsx`)

Add three lazy imports at the top alongside the others:

```tsx
const AdminUsersPage = lazy(() =>
  import('@/features/admin').then((m) => ({ default: m.AdminUsersPage }))
);
const AdminUserCreatePage = lazy(() =>
  import('@/features/admin').then((m) => ({ default: m.AdminUserCreatePage }))
);
const AdminUserEditPage = lazy(() =>
  import('@/features/admin').then((m) => ({ default: m.AdminUserEditPage }))
);
```

In the `children` of the existing `ProtectedRoute`+`AppLayout` route block, add
a nested admin subtree:

```tsx
{
  path: 'admin',
  element: <ProtectedRoute roles={['ADMIN']}><Outlet /></ProtectedRoute>,
  children: [
    { path: 'users', element: <Suspense fallback={<PageLoader />}><AdminUsersPage /></Suspense> },
    { path: 'users/new', element: <Suspense fallback={<PageLoader />}><AdminUserCreatePage /></Suspense> },
    { path: 'users/:id', element: <Suspense fallback={<PageLoader />}><AdminUserEditPage /></Suspense> },
  ],
},
```

The inner `<ProtectedRoute roles={['ADMIN']}>` adds a second layer of
role filtering on top of the outer "any authenticated user" `ProtectedRoute`.
The outer one authenticates; the inner one authorizes.

Add `Outlet` to the imports from `react-router-dom` (already imported for the
AppLayout).

---

## 15. Error handling & edge cases

| Case | Behavior |
|---|---|
| Non-ADMIN navigates to `/admin/users*` | Inner `ProtectedRoute roles={['ADMIN']}` shows the existing "no permission" view; sidebar hides the Usuarios link via `adminOnly` guard |
| 401 on any endpoint | `apiClient` 401 handler triggers `logout` already; user lands on `/login` (existing behavior) |
| 403 forbidden on any endpoint | Should not happen (RBAC filtered upstream). If it does: top banner "No tienes permiso para realizar esta acción" |
| 404 on `GET /users/:id` | AdminUserEditPage shows "Usuario no encontrado" + "Volver a usuarios" button |
| 409 on create/edit (duplicate email) | Pin "Este email ya está registrado" on email field |
| 400 self-role-change (defensive) | Top banner with backend message (UI disabled the dropdown already) |
| 400 self-delete (defensive) | Top banner with backend message (UI hides the delete button already) |
| 400 ValidationError | Map `ApiError.errors[]` to fields heuristically; unknown fields fall back to banner |
| Network error | Top banner generic "No se pudo conectar con el servidor" |
| `useUser(id)` abort on unmount | Cancelled flag prevents `setState` on unmounted component |

Reusing `ApiError` from `lib/api/types.ts` for all server-error branching.

---

## 16. Out of scope

- Pagination, search, and column sorting on the list.
- Bulk operations (multi-select/delete).
- `ConfirmDialog` modal primitive (delete uses two-press button per Q4).
- Member removal via the org members endpoint (`DELETE /organizations/:id/members/:userId`)
  — that's Epic 7c (org settings + member management) and a separate spec.
- Avatar editing for *other* users from admin (the `/users/me/avatar` endpoint
  is self-only; admin's avatar comes via their own `/profile`).
- Toast/notification UI system (use inline banners, same as `RegisterPage`).
- Audit log / "last edited by" column.
- 2FA enrollment flow (Epic 8, stretch).
- Any feature gated to TEACHER or STUDENT (this entire spec is ADMIN-only).

---

## 17. Tests

No frontend test infrastructure exists (same situation as Epic 7a, noted in
its spec §10). Verification is manual smoke:

- [ ] `/admin/users` accessible to ADMIN; TEACHER/STUDENT see the
      `ProtectedRoute` forbidden view.
- [ ] Sidebar hides "Usuarios" for non-ADMINs, shows it for ADMIN.
- [ ] List loads seed users (8 rows), no console errors.
- [ ] "Nuevo usuario" → `/admin/users/new` → create with a fresh email →
      redirect to list, new row appears.
- [ ] "Nuevo usuario" with duplicate email → "Este email ya está registrado"
      pinned to email field.
- [ ] "Nuevo usuario" with weak password → per-field error matching backend
      rules.
- [ ] Click "Editar" on a non-self user → form prefilled, edit name → 200 →
      redirect to list, row updated.
- [ ] Edit a non-self user, change role to ADMIN → 200.
- [ ] Edit `self` user → role `<select>` disabled with hint; delete button
      hidden; name/email/bio still editable and save-able.
- [ ] Delete a non-self user: 1st press flips to "Confirmar eliminación";
      5s later reverts to "Eliminar usuario".
- [ ] Delete a non-self user: 2nd press within 5s → 204 → redirect to list,
      row gone.
- [ ] 404 on `useUser('id-inexistente')` → AdminUserEditPage shows "Usuario
      no encontrado" + back button.
- [ ] Browser back from `/admin/users/new` lands on `/admin/users`.
- [ ] `pnpm -r run build` is clean (no TS errors, no lint failures).
- [ ] Latest Chrome: zero console warnings/errors.
- [ ] Responsive at widths 768px and below: Email column hidden, table fits.

---

## 18. No new dependencies

Imports only: `react`, `react-router-dom` (`Link`, `NavLink`, `Navigate`,
`Outlet`, `useNavigate`, `useParams`, `useSearchParams` not needed here),
`lucide-react` (`Users`, `UserPlus`, `Pencil`), `@/lib/api` (`apiClient`,
`useAuth`, `useIsAdmin`, `ApiError`), `@/components/ui` (`Button`, `Spinner`,
`Input`).

—

End of spec.