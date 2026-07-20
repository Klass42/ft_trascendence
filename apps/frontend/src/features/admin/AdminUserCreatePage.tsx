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
      return err instanceof ApiError
        ? err
        : new ApiError(0, 'No se pudo conectar con el servidor.');
    }
  }

  return (
    <div style={wrapper}>
      <Link to="/admin/users" style={backLink}>
        <ArrowLeft size={16} /> Volver a usuarios
      </Link>
      <h1
        style={{
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          margin: '0 0 4px',
        }}
      >
        Nuevo usuario
      </h1>
      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 14,
          margin: '0 0 22px',
        }}
      >
        Crea una cuenta para un miembro de tu organización.
      </p>
      <UserForm mode="create" onSubmit={handleCreate} />
    </div>
  );
}
