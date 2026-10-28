import { useId, useState, type FormEvent } from 'react';
import { isValidEmail } from '@/lib/email';
import { Mail, Lock, User as UserIcon } from 'lucide-react';
import { Input, Button } from '@/components/ui';
import { ApiError, type GlobalRole } from '@/lib/api/types';
import type { UserDTO, UpdateUserInput } from './types';
import styles from './UserForm.module.css';
import { mapApiValidationErrors } from '@/lib/form-errors';

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
  ADMIN: 'Administrador',
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
};
const PASSWORD_REGEX = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export function diffForPatch(
  values: FormValues,
  initial?: UserDTO,
): UpdateUserInput {
  if (!initial) {
    return {
      name: values.name,
      email: values.email,
      role: values.role,
      bio: values.bio,
    };
  }
  const patch: UpdateUserInput = {};
  if (values.name !== initial.name) patch.name = values.name;
  if (values.email !== initial.email) patch.email = values.email;
  if (values.role !== initial.role) patch.role = values.role;
  if (values.bio !== (initial.bio ?? '')) patch.bio = values.bio;
  return patch;
}

export function UserForm({ mode, initial, isSelf, onSubmit }: UserFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<GlobalRole>(initial?.role ?? 'STUDENT');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roleId = useId();
  const bioId = useId();
  const isCreate = mode === 'create';
  const roleDisabled = !isCreate && isSelf === true;

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'El nombre es obligatorio.';
    else if (name.trim().length > 100) errors.name = 'El nombre no puede superar los 100 caracteres.';
    if (!email.trim()) {
      errors.email = 'El correo electrónico es obligatorio.';
    } else if (!isValidEmail(email.trim())) {
      errors.email = 'Introduce un correo electrónico válido.';
    } else if (email.length > 254) {
      errors.email = 'El correo electrónico no puede superar los 254 caracteres.';
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

    const values: FormValues = {
      name: name.trim(),
      email: email.trim(),
      password: isCreate ? password : undefined,
      role,
      bio,
    };
    setIsSubmitting(true);
    const apiError = await onSubmit(values);
    setIsSubmitting(false);
    if (!apiError) return;

    if (apiError.status === 409) {
      setFieldErrors((prev) => ({
        ...prev,
        email: 'Este email ya está registrado.',
      }));
      return;
    }
    if (apiError.isValidationError && apiError.errors?.length) {
      const mapped = mapApiValidationErrors(apiError.errors);
      setFieldErrors((prev) => ({ ...prev, ...mapped.fields }));
      if (mapped.form) setFormError(mapped.form);
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
      {formError && (
        <div className={styles.formError} role="alert">
          {formError}
        </div>
      )}

      <Input
        label="Nombre completo"
        value={name}
        maxLength={100}
        onChange={(e) => {
          setName(e.target.value);
          clearFieldError('name');
        }}
        error={fieldErrors.name}
        leftIcon={<UserIcon size={18} />}
        autoComplete="name"
      />

      <Input
        label="Correo electrónico"
        type="email"
        value={email}
        maxLength={254}
        onChange={(e) => {
          setEmail(e.target.value);
          clearFieldError('email');
        }}
        error={fieldErrors.email}
        leftIcon={<Mail size={18} />}
        autoComplete="email"
      />

      {isCreate && (
        <Input
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearFieldError('password');
          }}
          error={fieldErrors.password}
          hint="Mínimo 8 caracteres, una mayúscula, una minúscula y un número."
          leftIcon={<Lock size={18} />}
          autoComplete="new-password"
        />
      )}

      <div className={styles.selectWrapper}>
        <label className={styles.label} htmlFor={roleId}>Rol</label>
        <select
          id={roleId}
          className={styles.select}
          value={role}
          onChange={(e) => setRole(e.target.value as GlobalRole)}
          disabled={roleDisabled}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        {roleDisabled && (
          <p className={styles.hint}>No puedes cambiar tu propio rol.</p>
        )}
      </div>

      <div className={styles.textareaWrapper}>
        <label className={styles.label} htmlFor={bioId}>Bio</label>
        <textarea
          id={bioId}
          className={styles.textarea}
          value={bio}
          onChange={(e) => {
            setBio(e.target.value);
            clearFieldError('bio');
          }}
          placeholder="Breve descripción (opcional)"
        />
        {fieldErrors.bio && (
          <p className={styles.fieldError}>{fieldErrors.bio}</p>
        )}
      </div>

      <div className={styles.actions}>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {isCreate ? 'Crear usuario' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}
