# Epic 7b — Frontend Admin User Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `features/admin/` frontend (list/create/edit/delete of users) that consumes the existing backend `GET/POST/PATCH/DELETE /users[/:id]` endpoints, gated to ADMIN via `ProtectedRoute roles={['ADMIN']}`.

**Architecture:** Three page components under `features/admin/` (`AdminUsersPage` list, `AdminUserCreatePage`, `AdminUserEditPage`) plus an internal shared `UserForm`. Fetch via new `useUsers`/`useUser` hooks mirroring `useCourses.ts`; mutations inline in pages. Routes nested under an admin `ProtectedRoute roles={['ADMIN']}` subtree. New `adminOnly: true` flag on the sidebar nav item.

**Tech Stack:** React 19, react-router-dom 7, lucide-react, existing `apiClient`/`useAuth`/`useIsAdmin`, `@/components/ui` (Button, Input, Card, Spinner). No new deps. No frontend test infra (smoke = manual).

**Spec:** `docs/superpowers/specs/2026-07-17-epic7b-admin-pages-design.md`

**Conventions (from `AGENTS.md` §7):**
- No comments unless asked.
- TypeScript end-to-end; match existing style.
- Build gate per task: `pnpm --filter @ft-trascendence/frontend run build` must be clean (tsc + vite).
- Commit prefix: `feat(frontend):` or `refactor(frontend):` etc.

---

### Task 1: Types + fetch hooks

**Files:**
- Create: `apps/frontend/src/features/admin/types.ts`
- Create: `apps/frontend/src/lib/api/hooks/useUsers.ts`
- Modify: `apps/frontend/src/lib/api/hooks/index.ts` (append 2 exports)

- [ ] **Step 1: Create `apps/frontend/src/features/admin/types.ts`**

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

- [ ] **Step 2: Create `apps/frontend/src/lib/api/hooks/useUsers.ts`**

Mirrors `useCourses.ts` pattern exactly: `useState` for data/loading/error, `useEffect` with `let cancelled = false` flag and cleanup.

```ts
import { useState, useEffect } from 'react';
import { apiClient } from '../client';
import type { UserDTO } from '@/features/admin/types';

interface UseUsersResult {
  data: UserDTO[] | null;
  isLoading: boolean;
  error: Error | null;
}

export function useUsers(): UseUsersResult {
  const [data, setData] = useState<UserDTO[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<UserDTO[]>('/users')
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

interface UseUserResult {
  data: UserDTO | null;
  isLoading: boolean;
  error: Error | null;
}

export function useUser(id: string | undefined): UseUserResult {
  const [data, setData] = useState<UserDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiClient
      .get<UserDTO>(`/users/${id}`)
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
  }, [id]);

  return { data, isLoading, error };
}
```

- [ ] **Step 3: Modify `apps/frontend/src/lib/api/hooks/index.ts`**

Append at the end:

```ts
export { useUsers, useUser } from './useUsers';
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @ft-trascendence/frontend run build`
Expected: clean, no TS errors, no new warnings.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/admin/types.ts \
        apps/frontend/src/lib/api/hooks/useUsers.ts \
        apps/frontend/src/lib/api/hooks/index.ts
git commit -m "feat(frontend): add UserDTO types + useUsers/useUser hooks

Mirrors useCourses.ts pattern. Reads /users and /users/:id via apiClient
(backend reads organizationId via @CurrentUser)."
```

---

### Task 2: UserForm (internal shared form)

**Files:**
- Create: `apps/frontend/src/features/admin/UserForm.module.css`
- Create: `apps/frontend/src/features/admin/UserForm.tsx`

`UserForm` is controlled (useState per field), with per-field validation, error mapping from `ApiError`, and `isSelf` handling (disables role `<select>`).

- [ ] **Step 1: Create `apps/frontend/src/features/admin/UserForm.module.css`**

```css
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.selectWrapper,
.textareaWrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.select,
.textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;
  font-family: inherit;
}

.select:focus,
.textarea:focus {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 3px var(--color-accent-muted);
}

.select:disabled,
.textarea:disabled {
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.textarea {
  min-height: 84px;
  resize: vertical;
}

.hint {
  font-size: 12px;
  color: var(--color-text-muted);
}

.fieldError {
  font-size: 12px;
  color: var(--color-danger, #c0392b);
}

.formError {
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(192, 57, 43, 0.08);
  border: 1px solid rgba(192, 57, 43, 0.35);
  color: #c0392b;
  font-size: 13px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
```

- [ ] **Step 2: Create `apps/frontend/src/features/admin/UserForm.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Mail, Lock, User as UserIcon } from 'lucide-react';
import { Input, Button } from '@/components/ui';
import { ApiError, type GlobalRole } from '@/lib/api/types';
import type { UserDTO, UpdateUserInput } from './types';
import styles from './UserForm.module.css';

export type UserFormMode = 'create' | 'edit';

export interface UserFormProps {
  mode: UserFormMode;
  initial?: UserDTO;
  isSelf?: boolean;
  onSubmit: (values: FormValues) => Promise<ApiError | null>;
}

export interface FormValues {
  name: string;
  email: string;
  password?: string;
  role: GlobalRole;
  bio: string;
}

const ROLE_OPTIONS: GlobalRole[] = ['STUDENT', 'TEACHER', 'ADMIN'];
const ROLE_LABEL: Record<GlobalRole, string> = {
  ADMIN: 'Admin',
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
};
const PASSWORD_REGEX = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export function UserForm({ mode, initial, isSelf, onSubmit }: UserFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<GlobalRole>(initial?.role ?? 'STUDENT');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCreate = mode === 'create';
  const roleDisabled = !isCreate && isSelf === true;

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'El nombre es obligatorio.';
    if (!email.trim()) {
      errors.email = 'El email es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Email no válido.';
    }
    if (isCreate) {
      if (!password) {
        errors.password = 'La contraseña es obligatoria.';
      } else if (password.length < 8) {
        errors.password = 'Mínimo 8 caracteres.';
      } else if (!PASSWORD_REGEX.test(password)) {
        errors.password =
          'Debe incluir una mayúscula, una minúscula y un número.';
      }
    }
    return errors;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const values: FormValues = { name: name.trim(), email: email.trim(), password: isCreate ? password : undefined, role, bio };
    setIsSubmitting(true);
    const apiError = await onSubmit(values);
    setIsSubmitting(false);
    if (!apiError) return;

    if (apiError.isConflict) {
      setFieldErrors((prev) => ({ ...prev, email: 'Este email ya está registrado.' }));
      return;
    }
    if (apiError.isValidationError && apiError.errors?.length) {
      const next: Record<string, string> = {};
      const leftover: string[] = [];
      for (const msg of apiError.errors) {
        const lower = msg.toLowerCase();
        if (lower.includes('name')) next.name = msg;
        else if (lower.includes('email')) next.email = msg;
        else if (lower.includes('password')) next.password = msg;
        else if (lower.includes('bio')) next.bio = msg;
        else leftover.push(msg);
      }
      setFieldErrors((prev) => ({ ...prev, ...next }));
      if (leftover.length) setFormError(leftover.join(' '));
      return;
    }
    setFormError(apiError.message || 'Ocurrió un error inesperado.');
  }

  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {formError && <div className={styles.formError} role="alert">{formError}</div>}

      <Input
        label="Nombre completo"
        value={name}
        onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
        error={fieldErrors.name}
        leftIcon={<UserIcon size={18} />}
        autoComplete="name"
      />

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
        error={fieldErrors.email}
        leftIcon={<Mail size={18} />}
        autoComplete="email"
      />

      {isCreate && (
        <Input
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
          error={fieldErrors.password}
          hint="Mínimo 8 caracteres, una mayúscula, una minúscula y un número."
          leftIcon={<Lock size={18} />}
          autoComplete="new-password"
        />
      )}

      <div className={styles.selectWrapper}>
        <label className={styles.label}>Rol</label>
        <select
          className={styles.select}
          value={role}
          onChange={(e) => setRole(e.target.value as GlobalRole)}
          disabled={roleDisabled}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        {roleDisabled && (
          <p className={styles.hint}>No puedes cambiar tu propio rol.</p>
        )}
      </div>

      <div className={styles.textareaWrapper}>
        <label className={styles.label}>Bio</label>
        <textarea
          className={styles.textarea}
          value={bio}
          onChange={(e) => { setBio(e.target.value); clearFieldError('bio'); }}
          placeholder="Breve descripción (opcional)"
        />
        {fieldErrors.bio && <p className={styles.fieldError}>{fieldErrors.bio}</p>}
      </div>

      <div className={styles.actions}>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {isCreate ? 'Crear usuario' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}

export function diffForPatch(values: FormValues, initial?: UserDTO): UpdateUserInput {
  if (!initial) return { name: values.name, email: values.email, role: values.role, bio: values.bio };
  const patch: UpdateUserInput = {};
  if (values.name !== initial.name) patch.name = values.name;
  if (values.email !== initial.email) patch.email = values.email;
  if (values.role !== initial.role) patch.role = values.role;
  if (values.bio !== (initial.bio ?? '')) patch.bio = values.bio;
  return patch;
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @ft-trascendence/frontend run build`
Expected: clean. Fix any TS errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/admin/UserForm.tsx \
        apps/frontend/src/features/admin/UserForm.module.css
git commit -m "feat(frontend): add internal UserForm for admin create/edit

Controlled form with per-field validation, ApiError mapping (409 → email
field, 400 ValidationError → per-field heuristic), isSelf disables role
select. Used by AdminUserCreatePage and AdminUserEditPage."
```

---

### Task 3: AdminUsersPage (list)

**Files:**
- Create: `apps/frontend/src/features/admin/AdminUsersPage.module.css`
- Create: `apps/frontend/src/features/admin/AdminUsersPage.tsx`

HTML table, role badge via `ROLE_LABEL`, "Nuevo usuario" button, loading/error/empty states.

- [ ] **Step 1: Create `apps/frontend/src/features/admin/AdminUsersPage.module.css`**

```css
.page {
  padding: 30px 40px;
  max-width: 960px;
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

- [ ] **Step 2: Create `apps/frontend/src/features/admin/AdminUsersPage.tsx`**

```tsx
import { useNavigate } from 'react-router-dom';
import { UserPlus, Pencil } from 'lucide-react';
import { useUsers } from '@/lib/api/hooks';
import { Button, Spinner } from '@/components/ui';
import type { GlobalRole } from '@/lib/api/types';
import type { UserDTO } from './types';
import styles from './AdminUsersPage.module.css';

const ROLE_LABEL: Record<GlobalRole, string> = {
  ADMIN: 'Admin',
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
};

export function AdminUsersPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useUsers();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Usuarios</h1>
        <Button
          variant="primary"
          leftIcon={<UserPlus size={18} />}
          onClick={() => navigate('/admin/users/new')}
        >
          Nuevo usuario
        </Button>
      </div>

      {error && (
        <div className={styles.banner} role="alert">
          No se pudieron cargar los usuarios.
        </div>
      )}

      {isLoading && (
        <div className={styles.loadingWrap}>
          <Spinner size="lg" label="Cargando usuarios..." />
        </div>
      )}

      {!isLoading && !error && data && data.length === 0 && (
        <div className={styles.center}>Aún no hay usuarios.</div>
      )}

      {!isLoading && !error && data && data.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Nombre</th>
              <th className={`${styles.th} ${styles.emailHeader}`}>Email</th>
              <th className={styles.th}>Rol</th>
              <th className={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map((u: UserDTO) => (
              <tr key={u.id} className={styles.tr}>
                <td className={`${styles.td} ${styles.nameCell}`}>{u.name}</td>
                <td className={`${styles.td} ${styles.emailCell}`}>{u.email}</td>
                <td className={styles.td}>
                  <span className={styles.roleBadge}>{ROLE_LABEL[u.role]}</span>
                </td>
                <td className={styles.td}>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Pencil size={14} />}
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                  >
                    Editar
                  </Button>
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
git add apps/frontend/src/features/admin/AdminUsersPage.tsx \
        apps/frontend/src/features/admin/AdminUsersPage.module.css
git commit -m "feat(frontend): AdminUsersPage list with HTML table

Shows all org users from GET /users. Loading/error/empty states.
'Nuevo usuario' button → /admin/users/new. 'Editar' button →
/admin/users/:id. Email column hidden under 768px (responsive)."
```

---

### Task 4: AdminUserCreatePage

**Files:**
- Create: `apps/frontend/src/features/admin/AdminUserCreatePage.tsx`

Centered card with title, `UserForm mode="create"`, POST `/users`, navigate back on success.

- [ ] **Step 1: Create `apps/frontend/src/features/admin/AdminUserCreatePage.tsx`**

```tsx
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/api/types';
import { UserForm, type FormValues } from './UserForm';
import type { UserDTO } from './types';

const wrapper: React.CSSProperties = {
  padding: '30px 40px',
  maxWidth: 480,
  margin: '0 auto',
};

const backLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 16,
  color: 'var(--color-text-secondary)',
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
};

export function AdminUserCreatePage() {
  const navigate = useNavigate();

  async function handleCreate(values: FormValues): Promise<ApiError | null> {
    try {
      await apiClient.post<UserDTO>('/users', {
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
      });
      navigate('/admin/users');
      return null;
    } catch (err) {
      return err instanceof ApiError ? err : new ApiError(0, 'No se pudo conectar con el servidor.');
    }
  }

  return (
    <div style={wrapper}>
      <Link to="/admin/users" style={backLink}>
        <ArrowLeft size={16} /> Volver a usuarios
      </Link>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
        Nuevo usuario
      </h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: '0 0 22px' }}>
        Crea una cuenta para un miembro de tu organización.
      </p>
      <UserForm mode="create" onSubmit={handleCreate} />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @ft-trascendence/frontend run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/admin/AdminUserCreatePage.tsx
git commit -m "feat(frontend): AdminUserCreatePage with UserForm create mode

Centered card, POST /users on submit, navigate back to list on 201."
```

---

### Task 5: AdminUserEditPage (edit + delete with 5s double-press)

**Files:**
- Create: `apps/frontend/src/features/admin/AdminUserEditPage.module.css`
- Create: `apps/frontend/src/features/admin/AdminUserEditPage.tsx`

Loads via `useUser(id)`, renders `UserForm mode="edit"` with `initial` and `isSelf`. PATCH `/users/:id` (only diffed fields). Delete section hidden if `isSelf`; otherwise double-press button with 5s timer.

- [ ] **Step 1: Create `apps/frontend/src/features/admin/AdminUserEditPage.module.css`**

```css
.page {
  padding: 30px 40px;
  max-width: 480px;
  margin: 0 auto;
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

.title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 4px;
}

.subtitle {
  color: var(--color-text-muted);
  font-size: 14px;
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

.dangerZone {
  margin-top: 32px;
  padding: 18px 20px;
  border: 1px solid rgba(192, 57, 43, 0.35);
  border-radius: 13px;
  background: rgba(192, 57, 43, 0.04);
}

.dangerTitle {
  font-size: 14px;
  font-weight: 700;
  color: #c0392b;
  margin: 0 0 8px;
}

.dangerHint {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0 0 14px;
}

.dangerActions {
  display: flex;
  gap: 10px;
}

.infoBox {
  margin-top: 32px;
  padding: 16px 18px;
  border: 1px solid var(--color-border-primary);
  border-radius: 13px;
  background: var(--color-bg-secondary);
  font-size: 13px;
  color: var(--color-text-secondary);
}
```

- [ ] **Step 2: Create `apps/frontend/src/features/admin/AdminUserEditPage.tsx`**

```tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiClient, useAuth } from '@/lib/api';
import { ApiError } from '@/lib/api/types';
import { Button, Spinner } from '@/components/ui';
import { useUser } from '@/lib/api/hooks';
import { UserForm, diffForPatch, type FormValues } from './UserForm';
import type { UserDTO } from './types';
import styles from './AdminUserEditPage.module.css';

export function AdminUserEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { data, isLoading, error } = useUser(id);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loadingWrap}>
        <Spinner size="lg" label="Cargando usuario..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.center}>
        <p>Usuario no encontrado.</p>
        <Button variant="ghost" onClick={() => navigate('/admin/users')}>
          Volver a usuarios
        </Button>
      </div>
    );
  }

  const isSelf = currentUser?.userId === id;

  async function handleUpdate(values: FormValues): Promise<ApiError | null> {
    try {
      const patch = diffForPatch(values, data);
      await apiClient.patch<UserDTO>(`/users/${id}`, patch);
      navigate('/admin/users');
      return null;
    } catch (err) {
      return err instanceof ApiError ? err : new ApiError(0, 'No se pudo conectar con el servidor.');
    }
  }

  function handleDeleteClick() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setDeleteError(null);
      deleteTimerRef.current = setTimeout(() => {
        setConfirmingDelete(false);
        deleteTimerRef.current = null;
      }, 5000);
      return;
    }
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    void performDelete();
  }

  async function performDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/users/${id}`);
      navigate('/admin/users');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.';
      setDeleteError(msg);
      setConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCancelDelete() {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setConfirmingDelete(false);
    setDeleteError(null);
  }

  return (
    <div className={styles.page}>
      <Link to="/admin/users" className={styles.backLink}>
        <ArrowLeft size={16} /> Volver a usuarios
      </Link>
      <h1 className={styles.title}>Editar usuario</h1>
      <p className={styles.subtitle}>{data.name}</p>

      <UserForm
        mode="edit"
        initial={data}
        isSelf={isSelf}
        onSubmit={handleUpdate}
      />

      {isSelf ? (
        <div className={styles.infoBox}>
          No puedes eliminar tu propia cuenta desde aquí. Usa tu Perfil para
          gestionar tu avatar y datos personales.
        </div>
      ) : (
        <div className={styles.dangerZone}>
          <p className={styles.dangerTitle}>Zona de peligro</p>
          <p className={styles.dangerHint}>
            Esta acción no se puede deshacer. El usuario y todos sus datos
            asociados se eliminarán.
          </p>
          {deleteError && (
            <div className={styles.banner} role="alert">{deleteError}</div>
          )}
          <div className={styles.dangerActions}>
            <Button
              variant="danger"
              loading={isDeleting}
              onClick={handleDeleteClick}
            >
              {confirmingDelete ? 'Confirmar eliminación' : 'Eliminar usuario'}
            </Button>
            {confirmingDelete && (
              <Button variant="ghost" onClick={handleCancelDelete}>
                Cancelar
              </Button>
            )}
          </div>
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
git add apps/frontend/src/features/admin/AdminUserEditPage.tsx \
        apps/frontend/src/features/admin/AdminUserEditPage.module.css
git commit -m "feat(frontend): AdminUserEditPage with PATCH + delete double-press

Loads user via useUser(id), UserForm mode=edit with isSelf (disables role
select). PATCH /users/:id with diffed fields only. Delete section hidden
for self; double-press button with 5s window. 404 + back button on
missing user."
```

---

### Task 6: Barrel export for features/admin

**Files:**
- Create: `apps/frontend/src/features/admin/index.ts`

- [ ] **Step 1: Create `apps/frontend/src/features/admin/index.ts`**

```ts
export { AdminUsersPage } from './AdminUsersPage';
export { AdminUserCreatePage } from './AdminUserCreatePage';
export { AdminUserEditPage } from './AdminUserEditPage';
export type { UserDTO, CreateUserInput, UpdateUserInput } from './types';
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @ft-trascendence/frontend run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/admin/index.ts
git commit -m "feat(frontend): barrel export for features/admin"
```

---

### Task 7: Routes + sidebar nav wiring

**Files:**
- Modify: `apps/frontend/src/app/routes.tsx`
- Modify: `apps/frontend/src/app/AppLayout.tsx`

- [ ] **Step 1: Modify `apps/frontend/src/app/routes.tsx`**

Add `Outlet` to the imports from `react-router-dom` (current import list: `lazy, Suspense`, `createBrowserRouter, Navigate, RouteObject`).

After the existing `ProfilePage` lazy import (around line 53-55), add:

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

In the `children` array of the outer `ProtectedRoute`+`AppLayout` route (the block that starts at line 111 and currently ends at line 200), add a nested admin subtree as the last entry inside `children`, before the closing `]` of that array:

```tsx
{
  path: 'admin',
  element: <ProtectedRoute roles={['ADMIN']}><Outlet /></ProtectedRoute>,
  children: [
    { path: 'users', element: (<Suspense fallback={<PageLoader />}><AdminUsersPage /></Suspense>) },
    { path: 'users/new', element: (<Suspense fallback={<PageLoader />}><AdminUserCreatePage /></Suspense>) },
    { path: 'users/:id', element: (<Suspense fallback={<PageLoader />}><AdminUserEditPage /></Suspense>) },
  ],
},
```

> Order matters: `users/new` must come **before** `users/:id` in the children array so react-router matches the literal path first. (react-router v6/v7 score-based ranking usually handles this, but explicit ordering is safer and clearer.)

- [ ] **Step 2: Modify `apps/frontend/src/app/AppLayout.tsx`**

In the `lucide-react` import block (around lines 3-16), add `Users` to the named imports (alphabetical-ish; insert after `User`):

```tsx
  User,
  Users,
  LogOut,
```

In `NAV_ITEMS` (lines 24-31), add a new entry before the closing `] as const;`. Place it as the last item in the array (after analytics), so the order is: dashboard, courses, assignments, forums, grades, analytics, **usuarios**.

```tsx
  { to: '/admin/users', icon: <Users size={20} />, label: 'Usuarios', adminOnly: true },
```

In the `.map((item) => { ... })` body (around lines 112-134), add the new guard at the top of the callback, before the existing `staffOnly`/`student`/`teacher` checks:

```tsx
if ('adminOnly' in item && item.adminOnly && user?.role !== 'ADMIN') {
  return null;
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @ft-trascendence/frontend run build`
Expected: clean. If TS complains about the `as const` literal union not having `adminOnly`, widen the type by adding `adminOnly?: boolean` — but since the array is `as const` and the existing items use optional flags inline, TS infers a union of literal object types; adding `adminOnly: true` to one entry widens that one element's type. The `.map` callback parameter is inferred as the union, so `'adminOnly' in item` is fine. If TS errors, change the array declaration from `as const` to a typed array:

```tsx
interface NavItem {
  to: string;
  icon: ReactNode;
  label: string;
  staffOnly?: boolean;
  student?: boolean;
  teacher?: boolean;
  adminOnly?: boolean;
}
const NAV_ITEMS: readonly NavItem[] = [ ... ];
```

Prefer the smaller change first; fall back to this typed interface only if TS errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/app/routes.tsx apps/frontend/src/app/AppLayout.tsx
git commit -m "feat(frontend): wire /admin/users* routes + 'Usuarios' nav item

3 lazy routes nested under ProtectedRoute roles={['ADMIN']} + Outlet.
NAV_ITEMS gains adminOnly: true item 'Usuarios' (lucide Users icon),
guarded so non-ADMINs don't see it."
```

---

### Task 8: Build + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Full build**

Run: `pnpm -r run build`
Expected: clean for both backend and frontend (tsc + vite + nest build). No TS errors, no new warnings.

- [ ] **Step 2: Bring up dev stack**

Run: `make up`
Expected: all containers healthy. Backend on :3000, frontend on :5173.

- [ ] **Step 3: Seed if needed**

Run: `make db-seed` (only if DB was reset; otherwise skip).
Expected: 8 seed rows.

- [ ] **Step 4: Smoke checklist (manual, latest Chrome, dev tools open)**

Log in as the seeded admin (`admin@demo` / `demo1234`) at http://localhost:5173/login.

- [ ] Sidebar shows "Usuarios" link (and admin can click it).
- [ ] TEACHER/STUDENT login: sidebar hides "Usuarios"; navigating directly to `/admin/users` shows ProtectedRoute forbidden view.
- [ ] `/admin/users` renders a `<table>` with 8 seed rows, columns: Nombre, Email, Rol, Acciones. Zero console warnings/errors.
- [ ] Click "Nuevo usuario" → `/admin/users/new` → form with name/email/password/role/bio.
- [ ] Submit with a fresh email (e.g. `nuevo@demo`, password `Demo1234`, role STUDENT) → 201, redirect to `/admin/users`, new row appears.
- [ ] Submit with a duplicate email (already exists) → "Este email ya está registrado." pinned on email field. No network error shown as banner.
- [ ] Submit with weak password `abc` → per-field error matching backend rules. Form stays on page.
- [ ] Click "Editar" on a non-self user → `/admin/users/:id` → form prefilled.
- [ ] Edit name → "Guardar cambios" → 200 → redirect to `/admin/users`, row updated.
- [ ] Edit role of non-self user to ADMIN → 200.
- [ ] Click "Editar" on your own admin user → role `<select>` is disabled with hint "No puedes cambiar tu propio rol."; "Eliminar usuario" section is hidden (info box shown instead). Name/email/bio still editable and saveable.
- [ ] On a non-self user's edit page: click "Eliminar usuario" → button flips to "Confirmar eliminación" + shows "Cancelar" button. Wait 6 seconds without second click → button reverts to "Eliminar usuario".
- [ ] Click "Eliminar usuario" then "Confirmar eliminación" within 5s → 204 → redirect to `/admin/users`, row gone.
- [ ] Navigate to `/admin/users/does-not-exist` → "Usuario no encontrado." + "Volver a usuarios" button.
- [ ] Resize Chrome to <768px width → Email column disappears (responsive CSS).
- [ ] Browser back from `/admin/users/new` lands on `/admin/users`.
- [ ] No console warnings/errors at any point in this list.

- [ ] **Step 5: Final commit (docs only, if any tweaks were made during smoke)**

If smoke surfaced bugs, fix them and commit per-fix. If everything passes clean, no commit needed here.

---

## Self-Review Notes

**Spec coverage check** (each spec section → task):

- Spec §5 Routes → Task 7 (routes wiring with nested ProtectedRoute).
- Spec §6 File layout → all 9 new files created across Tasks 1-6; 2 modified files in Task 7.
- Spec §7 Types → Task 1 Step 1.
- Spec §8 Hooks (`useUsers`, `useUser`) → Task 1 Step 2.
- Spec §9 AdminUsersPage → Task 3.
- Spec §10 AdminUserCreatePage → Task 4.
- Spec §11 AdminUserEditPage (incl. back link + delete section) → Task 5.
- Spec §12 UserForm (props, fields, isSelf, submit, error mapping) → Task 2.
- Spec §13 AppLayout nav (`adminOnly: true` + guard) → Task 7 Step 2.
- Spec §14 Routes wiring (lazy + nested) → Task 7 Step 1.
- Spec §15 Error handling & edge cases → covered inline in Tasks 2 (UserForm error mapping), 3 (banner), 5 (404 view, delete error banner), 7 (forbidden via ProtectedRoute).
- Spec §16 Out of scope → respected (no pagination, no bulk ops, no Modal, no member removal endpoint, no avatar editing for others, no toast system).
- Spec §17 Tests → Task 8 (manual smoke; no frontend test infra, matches Epic 7a precedent).
- Spec §18 No new dependencies → verified: only `react`, `react-router-dom`, `lucide-react`, `@/lib/api`, `@/components/ui` imports used.

**Type consistency check:**

- `UserDTO` defined in Task 1 (Step 1) is imported by `useUsers.ts` (Task 1 Step 2), `UserForm.tsx` (Task 2), `AdminUsersPage.tsx` (Task 3), `AdminUserCreatePage.tsx` (Task 4), `AdminUserEditPage.tsx` (Task 5). Property names match across all uses.
- `FormValues` exported from `UserForm.tsx` (Task 2) and imported by both `AdminUserCreatePage.tsx` (Task 4) and `AdminUserEditPage.tsx` (Task 5). Field names consistent.
- `diffForPatch` exported from `UserForm.tsx` (Task 2 Step 2) and used by `AdminUserEditPage.tsx` (Task 5 Step 2). Only one diff helper is defined (no duplication) — the internal `diffAgainstInitial` draft was removed during plan self-review before the plan was finalized.
- `ROLE_LABEL` is duplicated in `UserForm.tsx` (for select labels) and `AdminUsersPage.tsx` (for badge labels). Acceptable: they serve different purposes (select options vs. badge rendering) and the const is small; DRY-ing them would require a shared module that doesn't exist yet. Left as-is.
- `useUsers`/`useUser` exports added to `hooks/index.ts` (Task 1 Step 3); imported in `AdminUsersPage` (Task 3) and `AdminUserEditPage` (Task 5). Paths match.

**Inline fix to apply before finalising:** Remove the unused internal `diffAgainstInitial` from `UserForm.tsx` Step 2.

— End of plan.