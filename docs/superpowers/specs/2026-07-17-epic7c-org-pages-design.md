# Epic 7c — Frontend Organization Pages (Design Spec)

**Owner:** Jorge (@SrJorgeG) — Identity & Access, Tech Lead
**Branch:** `jorge` → `staging` → `master`
**Date:** 2026-07-17
**Status:** Draft
**Scope:** Sub-epic 7c of `docs/planning/Jorge.md` Epic 7. Epics 7a (auth pages) and 7b (admin users) are done. This is the last Jorge frontend epic.

---

## 1. Purpose

Build the `features/org/` frontend that consumes the existing backend organization
endpoints from Epic 4: every authenticated user can see their organization's
info, and an ADMIN can edit the name/logo and manage the member list (remove
users).

This closes the "Organization system" Major module: the backend is done, the
UI finishes it.

---

## 2. Constraints (hard)

- **Reuse Aloiki's design system** — `Button`, `Input`, `Card`, `Spinner`,
  `FileUpload` from `components/ui`. No new component primitives.
- **Reuse `ProtectedRoute`'s `roles` prop** — already handles forbidden views.
- **Reuse `useIsAdmin()` from `lib/api`** — no new auth hooks.
- **No new backend code** — all endpoints already exist.
- **No form library** — plain React `useState`, mirroring existing patterns.
- **No new dependencies** — imports from `react`, `react-router-dom`,
  `lucide-react`, `@/lib/api`, `@/components/ui`.
- **No new components in `components/ui/`** — the delete double-press logic
  is page-local (mirrors `AdminUserEditPage` from Epic 7b).
- **Spanish UI text** — matches existing pages.
- **Fetch pattern follows `useUsers.ts`** (Epic 7b pattern): `useState` +
  `useEffect` with `cancelled` flag, cleanup on unmount.
- **Single-organization scope** — the backend reads `@CurrentUser()`.

---

## 3. Design decisions (from brainstorm)

| Topic | Decision | Rationale |
|---|---|---|
| Layout structure | **Two pages** `/org` (settings) + `/org/members` (members) | Clean separation, mirrors Epic 7b multi-route pattern |
| Nav item | **Single item "Organización" → /org**, visible to all roles | Members link is in-page (not sidebar), avoiding sidebar sub-items (YAGNI) |
| Logo field | **Text URL Input** | Backend only stores a `logoUrl` string; no multipart endpoint for org logo upload. YAGNI. |
| Delete member | **Double-press in table row (5s window)** | Consistent with user delete in Epic 7b. No Modal primitive. Self row doesn't show the button. |
| Settings edit UX | **Inline reveal:** read-only card by default; ADMIN clicks "Editar" → form appears | Keeps the page clean for non-ADMINs. No separate edit route needed (2 fields). |
| Members access | **ADMIN only via `ProtectedRoute roles={['ADMIN']}`** | Backend already enforces `@Roles('ADMIN')` on members endpoints |
| Org info for non-ADMINs | **Read-only display** — name, slug, logo preview. Edit button hidden. | Every user should see their organization. AGENTS.md §5: the org is the core tenant scope. |

---

## 4. Architecture

```
User navigates /org
        │
        ▼
  ProtectedRoute (any authenticated user)
        │
        ▼
OrgSettingsPage
   ├─ useOrg()  GET /organizations/me → OrgDTO
   ├─ Read-only card: name, slug, logoUrl (img preview if set)
   ├─ If ADMIN: "Editar" button → reveals inline form (name + logoUrl inputs)
   │     └─ "Guardar cambios" → PATCH /organizations/:id → refreshing the display
   └─ If ADMIN: "Miembros" button → navigate /org/members

User navigates /org/members
        │
        ▼
  ProtectedRoute roles={['ADMIN']}
        │
        ▼
OrgMembersPage
   ├─ useOrg() → get orgId, then:
   ├─ useOrgMembers(orgId)  GET /organizations/:id/members → MemberDTO[]
   ├─ Table: Nombre, Email, Rol, Acciones
   └─ Each row: "Eliminar" button (hidden on self row)
        └─ Double-press (5s window) → DELETE /organizations/:id/members/:userId → 204 → re-fetch list
```

---

## 5. Routes

| Route | Component | Access |
|---|---|---|
| `/org` | `OrgSettingsPage` | Any authenticated user |
| `/org/members` | `OrgMembersPage` | `ProtectedRoute roles={['ADMIN']}` |

`/org` is a child of the existing `ProtectedRoute`+`AppLayout` parent (no extra
`roles` filter). `/org/members` is nested under an inner `ProtectedRoute
roles={['ADMIN']}` subtree, exactly like the `/admin` subtree in Epic 7b.

---

## 6. File layout

```
apps/frontend/src/features/org/          NEW directory
├── OrgSettingsPage.tsx
├── OrgSettingsPage.module.css
├── OrgMembersPage.tsx
├── OrgMembersPage.module.css
├── types.ts
└── index.ts

apps/frontend/src/lib/api/hooks/
└── useOrganization.ts                    NEW (useOrg + useOrgMembers)

apps/frontend/src/lib/api/hooks/
└── index.ts                              MODIFY: add export

apps/frontend/src/app/
├── AppLayout.tsx                         MODIFY: add "Organización" nav item
└── routes.tsx                            MODIFY: add 2 lazy routes + org subtree
```

---

## 7. Types (`features/org/types.ts`)

```ts
export interface OrgDTO {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberDTO {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  bio: string | null;
  onlineAt: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

`OrgDTO` mirrors the Prisma `Organization` model. `MemberDTO` mirrors the
backend `OrganizationsService.Member` interface (the `select` projection on
`findMembers`). Dates are ISO strings from JSON serialization.

---

## 8. Hooks (`lib/api/hooks/useOrganization.ts`)

### `useOrg(): { data: OrgDTO | null; isLoading: boolean; error: Error | null }`

Pattern identical to `useUsers.ts`:
- `useState` for data/loading/error.
- `useEffect` with `let cancelled = false` + cleanup.
- `apiClient.get<OrgDTO>('/organizations/me')`.
- No query params.

### `useOrgMembers(orgId: string | undefined): { data: MemberDTO[] | null; isLoading: boolean; error: Error | null }`

- If `orgId` is falsy → `setIsLoading(false)` immediately.
- Otherwise `apiClient.get<MemberDTO[]>(`/organizations/${orgId}/members`)`.
- Re-fetches when `orgId` changes (dep array `[orgId]`).
- Used only in `OrgMembersPage` (ADMIN-gated).

---

## 9. OrgSettingsPage (`/org`)

**Layout:**
```
┌────────────────────────────────────────────┐
│  Organización                              │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  [logo img 64px]   KlassDemo         │  │
│  │                     klass-demo        │  │
│  │                     slug (read-only)  │  │
│  │                                       │  │
│  │  [Editar] (solo ADMIN)               │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  [Miembros] (solo ADMIN)                   │
└────────────────────────────────────────────┘
```

**States:**
- `isLoading` → `<Spinner label="Cargando organización..." />`
- `error || !data` → banner "No se pudo cargar la organización."
- `data` → render card.

**Read-only card (all roles):**
- Logo: if `data.logoUrl` → `<img src={logoUrl}>` 64x64 rounded. Else → placeholder with org initial letter.
- Org name (bold, large).
- Slug (small, muted, "slug: klass-demo").
- If ADMIN: "Editar" button that toggles `isEditing = true`.

**Inline edit form (ADMIN only, when `isEditing`):**
- Replaces the card content with a mini form:
  - `Input label="Nombre"` pre-filled with `data.name`.
  - `Input label="Logo URL"` pre-filled with `data.logoUrl ?? ''`, hint "URL de la imagen del logo".
  - Buttons: "Guardar cambios" (primary, loading) + "Cancelar" (ghost).
- Submit: `PATCH /organizations/${data.id}` with `{ name, logoUrl }` (only changed fields).
- On success (200): `data` refreshed (re-fetch or optimistic update), `isEditing = false`.
- Error mapping: 403 → "No tienes permiso." (shouldn't happen, button hidden for non-ADMIN). 400 ValidationError → per-field. Network → banner.
- No `FileUpload` component. Field is plain text URL.

**"Miembros" button (ADMIN only, below the card):**
- `<Button variant="secondary" leftIcon={<Users />}>Miembros</Button>` → `navigate('/org/members')`.

No back link needed (sidebar already has "Organización" active).

---

## 10. OrgMembersPage (`/org/members`)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  ← Volver a organización                            │
│  Miembros                                           │
├─────────────────────────────────────────────────────┤
│  Nombre        Email              Rol     Acciones  │
│  Ada Admin     admin@demo          Admin   (— self) │
│  Diego Torres  diego@example.com   Teacher [Eliminar]│
│  ...                                                 │
└─────────────────────────────────────────────────────┘
```

**Header:** back link "← Volver a organización" → `/org`. Title "Miembros".

**Table:** Same HTML `<table>` pattern as `AdminUsersPage` (Epic 7b):
- Columns: Nombre, Email, Rol, Acciones.
- Role rendered as badge (`ROLE_LABEL` map).
- Responsive: Email column hidden under 768px.

**Acciones column (per-row):**
- If `row.id === currentUser.userId` → "—" dash (no button, no text button).
- Else → "Eliminar" button with double-press pattern (same as `AdminUserEditPage` delete):
  - First click → label "Confirmar eliminación", danger style, 5s timer.
  - Second click within 5s → `DELETE /organizations/${orgId}/members/${userId}`.
  - 204 → re-fetch list (data refreshed).
  - Error → banner above table.
  - Timer expiry → revert to "Eliminar".
  - "Cancelar" button resets.

**States:**
- `isLoading` → Spinner.
- `error` → banner "No se pudieron cargar los miembros."
- `data` empty → "Esta organización no tiene miembros."
- `data.length > 0` → table.

---

## 11. AppLayout nav changes

In `AppLayout.tsx`, add to `NAV_ITEMS`:

```ts
{ to: '/org', icon: <Building2 size={20} />, label: 'Organización' },
```

No `adminOnly`, no `staffOnly` — visible to all roles. Order: after "Analíticas" and before "Usuarios" (admin), so the sidebar reads:

Inicio · Cursos · Tareas · Foros · Datos · Analíticas · **Organización** · Usuarios (admin)

---

## 12. Routes wiring (`app/routes.tsx`)

Add two lazy imports:

```tsx
const OrgSettingsPage = lazy(() =>
  import('@/features/org').then((m) => ({ default: m.OrgSettingsPage }))
);
const OrgMembersPage = lazy(() =>
  import('@/features/org').then((m) => ({ default: m.OrgMembersPage }))
);
```

Inside the `children` array of the `ProtectedRoute`+`AppLayout` route (after
the `admin` subtree or as a separate sibling entry), add:

```tsx
{
  path: 'org',
  children: [
    {
      index: true,
      element: (
        <Suspense fallback={<PageLoader />}>
          <OrgSettingsPage />
        </Suspense>
      ),
    },
    {
      path: 'members',
      element: (
        <ProtectedRoute roles={['ADMIN']}>
          <Suspense fallback={<PageLoader />}>
            <OrgMembersPage />
          </Suspense>
        </ProtectedRoute>
      ),
    },
  ],
},
```

Use `index: true` for `/org` → the settings page renders at the parent path
without a trailing segment.

Note: `Outlet` is already imported (from Epic 7b). No new import.

---

## 13. Error handling & edge cases

| Case | Behavior |
|---|---|
| Non-ADMIN navigates to `/org/members` | `ProtectedRoute roles={['ADMIN']}` shows forbidden view |
| Non-ADMIN on `/org` | Sees read-only card. "Editar" and "Miembros" buttons hidden via `useIsAdmin()` check |
| `GET /organizations/me` fails | Banner "No se pudo cargar la organización." |
| `PATCH` fails 403 | Defensive banner (shouldn't happen since button hidden for non-ADMIN). Patch sends `{ name?, logoUrl? }` — only changed fields |
| `DELETE` fails 400 self-delete | Defensive banner (button hidden for self). Should never reach the backend. |
| `DELETE` fails 404 | Banner "Miembro no encontrado." Re-fetch list. |
| Self row in members table | "Eliminar" button hidden (dash). Backend also blocks with 400 if somehow called. |
| Network error | Banner genérico "No se pudo conectar con el servidor." |
| Page unmounts during async op | `cancelled` flag prevents `setState` |

---

## 14. Out of scope

- Creating a new organization (`POST /organizations` — Phase 2, backend doesn't expose this endpoint).
- Uploading a logo image (the backend has no multipart endpoint for org logo; only a string URL field).
- Editing the slug (read-only; backend `UpdateOrganizationDto` doesn't include `slug`).
- Adding members to the org (members join via registration — `POST /auth/register` — or admin creates via `POST /users`).
- Changing member role from this page (use the admin `/admin/users/:id` page for that).
- Pagination, search, filter on members list.
- Audit log.

---

## 15. No new dependencies

Imports only: `react`, `react-router-dom` (`Link`, `useNavigate`, `useParams` not needed here since orgId comes from auth), `lucide-react` (`Building2`, `Users`, `Pencil`, `ArrowLeft`), `@/lib/api` (`apiClient`, `useAuth`, `useIsAdmin`, `ApiError`), `@/components/ui` (`Button`, `Input`, `Spinner`).

---

## 16. Tests

No frontend test infrastructure (same as Epics 7a, 7b). Verification is manual smoke:
- [ ] `/org` shows org info (name, slug) for all roles.
- [ ] ADMIN sees "Editar" and "Miembros" buttons.
- [ ] Non-ADMIN does not see "Editar" or "Miembros".
- [ ] ADMIN clicks "Editar" → form appears; edit name → "Guardar cambios" → PATCH 200 → card updates.
- [ ] ADMIN clicks "Editar" → "Cancelar" → form disappears, original values restored.
- [ ] "/org/members" accessible to ADMIN; non-ADMIN sees forbidden view.
- [ ] Members table shows all users in org. Self row shows dash instead of "Eliminar".
- [ ] Delete other member: double-press works (first press → "Confirmar eliminación", 5s timer, second press → 204 → row gone).
- [ ] Timer expires → button reverts to "Eliminar".
- [ ] Back link "← Volver a organización" navigates to `/org`.
- [ ] `pnpm -r run build` clean.
- [ ] Latest Chrome: zero console warnings/errors.

---

End of spec.
