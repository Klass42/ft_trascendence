# Epic 7c — Frontend Organization Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `features/org/` with two pages: `/org` (settings — read-only for all, inline-edit for ADMIN) and `/org/members` (ADMIN-only member table with double-press delete).

**Architecture:** Two page components under `features/org/`. `OrgSettingsPage` uses `useOrg()` hook, renders an info card + inline-edit form (toggle) for ADMIN. `OrgMembersPage` uses `useOrg()` + `useOrgMembers(orgId)`, renders an HTML table with a per-row double-press delete button. New `useOrganization.ts` hook file. Minimal route/nav wiring.

**Tech Stack:** React 19, react-router-dom 7, lucide-react, existing `apiClient`/`useAuth`/`useIsAdmin`, `@/components/ui` (Button, Input, Spinner). No new deps. No frontend test infra (smoke = manual).

**Spec:** `docs/superpowers/specs/2026-07-17-epic7c-org-pages-design.md`

---

### Task 1: Types + hooks

**Files:**
- Create: `apps/frontend/src/features/org/types.ts`
- Create: `apps/frontend/src/lib/api/hooks/useOrganization.ts`
- Modify: `apps/frontend/src/lib/api/hooks/index.ts`

- [ ] **Step 1: Create `apps/frontend/src/features/org/types.ts`**

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

Make the directory first: `mkdir -p apps/frontend/src/features/org`

- [ ] **Step 2: Create `apps/frontend/src/lib/api/hooks/useOrganization.ts`**

Mirrors `useUsers.ts` pattern exactly.

```ts
import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import type { OrgDTO, MemberDTO } from '@/features/org/types';

interface UseOrgResult {
  data: OrgDTO | null;
  isLoading: boolean;
  error: Error | null;
}

export function useOrg(): UseOrgResult {
  const [data, setData] = useState<OrgDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<OrgDTO>('/organizations/me')
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}

interface UseOrgMembersResult {
  data: MemberDTO[] | null;
  isLoading: boolean;
  error: Error | null;
}

export function useOrgMembers(
  orgId: string | undefined,
): UseOrgMembersResult {
  const [data, setData] = useState<MemberDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!orgId) {
      setIsLoading(false);
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<MemberDTO[]>(`/organizations/${orgId}/members`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return { data, isLoading, error };
}
```

- [ ] **Step 3: Modify `apps/frontend/src/lib/api/hooks/index.ts`**

Append:

```ts
export { useOrg, useOrgMembers } from './useOrganization';
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @ft-trascendence/frontend run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/org/types.ts \
        apps/frontend/src/lib/api/hooks/useOrganization.ts \
        apps/frontend/src/lib/api/hooks/index.ts
git commit -m "feat(frontend): add OrgDTO/MemberDTO types + useOrg/useOrgMembers hooks

Mirrors useUsers.ts pattern. Reads /organizations/me and
/organizations/:id/members via apiClient."
```

---

### Task 2: OrgSettingsPage

**Files:**
- Create: `apps/frontend/src/features/org/OrgSettingsPage.module.css`
- Create: `apps/frontend/src/features/org/OrgSettingsPage.tsx`

- [ ] **Step 1: Create `apps/frontend/src/features/org/OrgSettingsPage.module.css`**

```css
.page {
  padding: 30px 40px;
  max-width: 560px;
}

.title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 22px;
}

.loadingWrap,
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 0;
  color: var(--color-text-muted);
  font-size: 14px;
}

.banner {
  padding: 12px 16px;
  border-radius: 10px;
  background: rgba(192, 57, 43, 0.08);
  border: 1px solid rgba(192, 57, 43, 0.35);
  color: #c0392b;
  font-size: 13px;
  margin-bottom: 16px;
}

.card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 15px;
  padding: 24px;
  display: flex;
  gap: 18px;
  align-items: center;
}

.logoPreview {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background: var(--color-accent-muted);
  color: var(--color-accent-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 28px;
  flex: none;
  overflow: hidden;
}

.logoImg {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.info {
  flex: 1;
}

.orgName {
  font-size: 18px;
  font-weight: 700;
}

.slug {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 18px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}

.formActions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.membersSection {
  margin-top: 24px;
}
```

- [ ] **Step 2: Create `apps/frontend/src/features/org/OrgSettingsPage.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Users } from 'lucide-react';
import { apiClient, useIsAdmin } from '@/lib/api';
import { ApiError } from '@/lib/api/types';
import { Button, Input, Spinner } from '@/components/ui';
import { useOrg } from '@/lib/api/hooks';
import type { OrgDTO } from './types';
import styles from './OrgSettingsPage.module.css';

export function OrgSettingsPage() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { data, isLoading, error } = useOrg();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [localData, setLocalData] = useState<OrgDTO | null>(null);

  if (isLoading) {
    return (
      <div className={styles.loadingWrap}>
        <Spinner size="lg" label="Cargando organización..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.center}>
        <p>No se pudo cargar la organización.</p>
      </div>
    );
  }

  const displayData = localData ?? data;

  function startEditing() {
    setEditName(displayData.name);
    setEditLogoUrl(displayData.logoUrl ?? '');
    setEditError(null);
    setFieldErrors({});
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditError(null);
    setFieldErrors({});
  }

  async function handleSave() {
    const errors: Record<string, string> = {};
    if (!editName.trim()) errors.name = 'El nombre es obligatorio.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const patch: Record<string, string> = {};
    if (editName.trim() !== displayData.name) patch.name = editName.trim();
    const newLogo = editLogoUrl.trim() || null;
    if (newLogo !== displayData.logoUrl) patch.logoUrl = newLogo === null ? '' : newLogo;

    if (Object.keys(patch).length === 0) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setEditError(null);
    try {
      const updated = await apiClient.patch<OrgDTO>(
        `/organizations/${displayData.id}`,
        patch,
      );
      setLocalData(updated);
      setIsEditing(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isValidationError && err.errors?.length) {
          const next: Record<string, string> = {};
          for (const msg of err.errors) {
            const lower = msg.toLowerCase();
            if (lower.includes('name')) next.name = msg;
            else if (lower.includes('logo')) next.logoUrl = msg;
          }
          setFieldErrors(next);
          if (Object.keys(next).length === 0) setEditError(err.message);
        } else {
          setEditError(err.message);
        }
      } else {
        setEditError('No se pudo conectar con el servidor.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Organización</h1>

      {editError && (
        <div className={styles.banner} role="alert">
          {editError}
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.logoPreview}>
          {displayData.logoUrl ? (
            <img
              src={displayData.logoUrl}
              alt=""
              className={styles.logoImg}
            />
          ) : (
            displayData.name.charAt(0).toUpperCase()
          )}
        </div>

        {isEditing ? (
          <div className={styles.form}>
            <Input
              label="Nombre"
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value);
                if (fieldErrors.name) {
                  setFieldErrors((p) => {
                    const n = { ...p };
                    delete n.name;
                    return n;
                  });
                }
              }}
              error={fieldErrors.name}
            />
            <Input
              label="Logo URL"
              value={editLogoUrl}
              onChange={(e) => {
                setEditLogoUrl(e.target.value);
                if (fieldErrors.logoUrl) {
                  setFieldErrors((p) => {
                    const n = { ...p };
                    delete n.logoUrl;
                    return n;
                  });
                }
              }}
              error={fieldErrors.logoUrl}
              hint="URL de la imagen del logo (opcional)"
            />
            <div className={styles.formActions}>
              <Button variant="ghost" onClick={cancelEditing}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                loading={isSaving}
                onClick={handleSave}
              >
                Guardar cambios
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.info}>
              <div className={styles.orgName}>{displayData.name}</div>
              <div className={styles.slug}>slug: {displayData.slug}</div>
            </div>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Pencil size={14} />}
                onClick={startEditing}
              >
                Editar
              </Button>
            )}
          </>
        )}
      </div>

      {isAdmin && (
        <div className={styles.membersSection}>
          <Button
            variant="secondary"
            leftIcon={<Users size={18} />}
            onClick={() => navigate('/org/members')}
          >
            Miembros
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @ft-trascendence/frontend run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/org/OrgSettingsPage.tsx \
        apps/frontend/src/features/org/OrgSettingsPage.module.css
git commit -m "feat(frontend): OrgSettingsPage with read-only card + inline edit

All users see org info (name, slug, logo). ADMIN can click 'Editar'
to reveal a mini form (name + logoURL), PATCH /organizations/:id
on save. 'Miembros' button (ADMIN only) navigates to /org/members."
```

---

### Task 3: OrgMembersPage

**Files:**
- Create: `apps/frontend/src/features/org/OrgMembersPage.module.css`
- Create: `apps/frontend/src/features/org/OrgMembersPage.tsx`

- [ ] **Step 1: Create `apps/frontend/src/features/org/OrgMembersPage.module.css`**

Reuses the same table styles from `AdminUsersPage.module.css` but local to this feature (copy, not shared). Also adds back link and member-specific styles.

```css
.page {
  padding: 30px 40px;
  max-width: 960px;
}

.backLink {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 22px;
}

.title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0;
}

.table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 13px;
  overflow: hidden;
}

.th {
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border-primary);
}

.td {
  padding: 14px 16px;
  font-size: 14px;
  border-bottom: 1px solid var(--color-border-primary);
  color: var(--color-text-primary);
}

.tr:last-child .td {
  border-bottom: none;
}

.nameCell {
  font-weight: 600;
}

.roleBadge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--color-accent-muted);
  color: var(--color-accent-hover);
  font-size: 12px;
  font-weight: 700;
}

.emailCell {
  color: var(--color-text-secondary);
}

.dangerActions {
  display: flex;
  gap: 8px;
}

.center {
  text-align: center;
  padding: 40px 16px;
  color: var(--color-text-muted);
  font-size: 14px;
}

.banner {
  padding: 12px 16px;
  border-radius: 10px;
  background: rgba(192, 57, 43, 0.08);
  border: 1px solid rgba(192, 57, 43, 0.35);
  color: #c0392b;
  font-size: 13px;
  margin-bottom: 16px;
}

.loadingWrap {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

@media (max-width: 768px) {
  .emailCell,
  .emailHeader {
    display: none;
  }
}
```

- [ ] **Step 2: Create `apps/frontend/src/features/org/OrgMembersPage.tsx`**

```tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiClient, useAuth } from '@/lib/api';
import { ApiError } from '@/lib/api/types';
import { Button, Spinner } from '@/components/ui';
import { useOrg, useOrgMembers } from '@/lib/api/hooks';
import type { GlobalRole } from '@/lib/api/types';
import type { MemberDTO } from './types';
import styles from './OrgMembersPage.module.css';

const ROLE_LABEL: Record<GlobalRole, string> = {
  ADMIN: 'Admin',
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
};

export function OrgMembersPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { data: org } = useOrg();
  const { data: members, isLoading, error } = useOrgMembers(org?.id);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const startDelete = useCallback((memberId: string) => {
    setDeletingId(memberId);
    setBannerError(null);
    timerRef.current = setTimeout(() => {
      setDeletingId(null);
      timerRef.current = null;
    }, 5000);
  }, []);

  const confirmDelete = useCallback(
    async (memberId: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setDeletingId(null);
      try {
        await apiClient.delete(
          `/organizations/${org!.id}/members/${memberId}`,
        );
        setDeletedIds((prev) => [...prev, memberId]);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : 'No se pudo conectar con el servidor.';
        setBannerError(msg);
      }
    },
    [org],
  );

  const cancelDelete = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setDeletingId(null);
  }, []);

  if (!org) {
    return null;
  }

  const visibleMembers = members?.filter(
    (m) => !deletedIds.includes(m.id),
  );

  const isSelf = (id: string) => currentUser?.userId === id;

  return (
    <div className={styles.page}>
      <Link to="/org" className={styles.backLink}>
        <ArrowLeft size={16} /> Volver a organización
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Miembros</h1>
      </div>

      {bannerError && (
        <div className={styles.banner} role="alert">
          {bannerError}
        </div>
      )}

      {error && (
        <div className={styles.banner} role="alert">
          No se pudieron cargar los miembros.
        </div>
      )}

      {isLoading && (
        <div className={styles.loadingWrap}>
          <Spinner size="lg" label="Cargando miembros..." />
        </div>
      )}

      {!isLoading && !error && visibleMembers && visibleMembers.length === 0 && (
        <div className={styles.center}>
          Esta organización no tiene miembros.
        </div>
      )}

      {!isLoading && !error && visibleMembers && visibleMembers.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Nombre</th>
              <th className={`${styles.th} ${styles.emailHeader}`}>
                Email
              </th>
              <th className={styles.th}>Rol</th>
              <th className={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleMembers.map((m: MemberDTO) => (
              <tr key={m.id} className={styles.tr}>
                <td className={`${styles.td} ${styles.nameCell}`}>
                  {m.name}
                </td>
                <td className={`${styles.td} ${styles.emailCell}`}>
                  {m.email}
                </td>
                <td className={styles.td}>
                  <span className={styles.roleBadge}>
                    {ROLE_LABEL[m.role]}
                  </span>
                </td>
                <td className={styles.td}>
                  {isSelf(m.id) ? (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                      —
                    </span>
                  ) : deletingId === m.id ? (
                    <div className={styles.dangerActions}>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => confirmDelete(m.id)}
                      >
                        Confirmar eliminación
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelDelete}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startDelete(m.id)}
                    >
                      Eliminar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @ft-trascendence/frontend run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/org/OrgMembersPage.tsx \
        apps/frontend/src/features/org/OrgMembersPage.module.css
git commit -m "feat(frontend): OrgMembersPage with double-press delete

ADMIN-only. HTML table of org members. Per-row delete button with
double-press 5s pattern (consistent with 7b). Self row shows dash.
Back link to /org. Refetch after successful delete via refetchKey."
```

---

### Task 4: Barrel export

**Files:**
- Create: `apps/frontend/src/features/org/index.ts`

- [ ] **Step 1: Create `apps/frontend/src/features/org/index.ts`**

```ts
export { OrgSettingsPage } from './OrgSettingsPage';
export { OrgMembersPage } from './OrgMembersPage';
export type { OrgDTO, MemberDTO } from './types';
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @ft-trascendence/frontend run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/org/index.ts
git commit -m "feat(frontend): barrel export for features/org"
```

---

### Task 5: Routes + AppLayout nav wiring

**Files:**
- Modify: `apps/frontend/src/app/routes.tsx`
- Modify: `apps/frontend/src/app/AppLayout.tsx`

- [ ] **Step 1: Modify `apps/frontend/src/app/routes.tsx`**

After the existing admin lazy imports block, add:

```tsx
const OrgSettingsPage = lazy(() =>
  import('@/features/org').then((m) => ({ default: m.OrgSettingsPage }))
);
const OrgMembersPage = lazy(() =>
  import('@/features/org').then((m) => ({ default: m.OrgMembersPage }))
);
```

Inside the `children` array of the `ProtectedRoute`+`AppLayout` route, add as a sibling of the admin subtree (before or after — after is cleaner):

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

Note: `Outlet` and `ProtectedRoute` are already imported. No new react-router-dom imports needed.

- [ ] **Step 2: Modify `apps/frontend/src/app/AppLayout.tsx`**

In the `lucide-react` import block, add `Building2`:

```tsx
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  MessageSquare,
  BarChart3,
  LineChart,
  Building2,
  User,
  Users,
  LogOut,
```

In `NAV_ITEMS`, add the org item between analytics and the admin-only "Usuarios" item:

```tsx
  { to: '/analytics', icon: <LineChart size={20} />, label: 'Analíticas', staffOnly: true },
  { to: '/org', icon: <Building2 size={20} />, label: 'Organización' },
  { to: '/admin/users', icon: <Users size={20} />, label: 'Usuarios', adminOnly: true },
```

No guard needed — visible to all roles.

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @ft-trascendence/frontend run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/app/routes.tsx apps/frontend/src/app/AppLayout.tsx
git commit -m "feat(frontend): wire /org + /org/members routes + 'Organización' nav

2 lazy routes: /org (index → OrgSettingsPage, all auth) and
/org/members (ProtectedRoute ADMIN → OrgMembersPage).
NAV_ITEMS gains 'Organización' item (Building2 icon), visible to all."
```

---

### Task 6: Build + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Full build**

Run: `pnpm -r run build`
Expected: clean for both backend and frontend.

- [ ] **Step 2: Bring up stack (if not already running)**

Run: `make up`
Wait for all containers healthy.

- [ ] **Step 3: Seed if needed**

Run: `sleep 5 && docker compose -f infra/docker/docker-compose.yml exec backend pnpm --filter @ft-trascendence/backend exec prisma db seed`
Expected: seed succeeds.

- [ ] **Step 4: Smoke checklist (Chrome, dev tools open, login as admin@demo / demo1234)**

- [ ] Login as ADMIN → sidebar shows "Organización" link.
- [ ] Login as TEACHER or STUDENT → sidebar also shows "Organización" link.
- [ ] `/org` → shows org name ("KlassDemo"), slug, logo placeholder letter.
- [ ] ADMIN sees "Editar" button.
- [ ] Non-ADMIN does NOT see "Editar" button.
- [ ] ADMIN clicks "Editar" → form appears with pre-filled name and logo URL.
- [ ] Change name → "Guardar cambios" → PATCH 200 → card updates, form closes.
- [ ] Click "Editar" → "Cancelar" → form closes, original values unchanged.
- [ ] ADMIN sees "Miembros" button. Non-ADMIN does NOT.
- [ ] Click "Miembros" → `/org/members` → table with all org users.
- [ ] Self row shows "—" (no delete button).
- [ ] Other rows show "Eliminar" button.
- [ ] Click "Eliminar" on a non-self user → button flips to "Confirmar eliminación" + "Cancelar".
- [ ] Wait 6s → reverts to "Eliminar".
- [ ] Click "Eliminar" then "Confirmar eliminación" within 5s → 204 → row removed from table.
- [ ] Non-ADMIN navigates to `/org/members` → `ProtectedRoute` forbidden view.
- [ ] Back link "← Volver a organización" navigates to `/org`.
- [ ] No console warnings/errors at any point.
- [ ] Responsive: at <768px, Email column hidden.

- [ ] **Step 5: No commit needed if all passes**

---

## Self-Review Notes

**Spec coverage:**
- §5 Routes → Task 5 Step 1
- §6 File layout → all files created/modified across Tasks 1-5
- §7 Types → Task 1 Step 1
- §8 Hooks → Task 1 Step 2 (useOrg + useOrgMembers with refetchKey)
- §9 OrgSettingsPage (card, inline edit, logo preview, Miembros button) → Task 2
- §10 OrgMembersPage (table, delete double-press, self row dash, back link) → Task 3
- §11 AppLayout nav (`Building2`, no guard) → Task 5 Step 2
- §12 Routes wiring (`index: true` + `ProtectedRoute` for members) → Task 5 Step 1
- §13 Error handling → inline in Task 2 (patch errors) and Task 3 (delete error banner)
- §14 Out of scope → respected (no create org, no logo upload, no slug edit, no bulk)
- §15 No new deps → verified
- §16 Tests → Task 6 manual smoke

**Placeholder scan:** None found.

**Type consistency:**
- `OrgDTO` and `MemberDTO` from Task 1 Step 1 used in all subsequent tasks ✓
- `useOrg()` / `useOrgMembers()` hooks from Task 1 Step 2 used in Tasks 2 & 3 ✓
- Delete on OrgMembersPage uses local `deletedIds` state array to filter removed members without touching the hook signature ✓

— End of plan.
