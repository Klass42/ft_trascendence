import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiClient, useAuth } from '@/lib/api';
import { ApiError } from '@/lib/api/types';
import { Button, Spinner } from '@/components/ui';
import { useUser } from '@/lib/api/hooks';
import { DeleteUserDialog, DELETE_USER_COPY } from './DeleteUserDialog';
import { UserForm, diffForPatch, type FormValues } from './UserForm';
import type { UserDTO } from './types';
import styles from './AdminUserEditPage.module.css';

export function AdminUserEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { data, isLoading, error } = useUser(id);

  const [confirmOpen, setConfirmOpen] = useState(false);

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
  const userData = data;

  async function handleUpdate(values: FormValues): Promise<ApiError | null> {
    try {
      const patch = diffForPatch(values, userData);
      await apiClient.patch<UserDTO>(`/users/${id}`, patch);
      navigate('/admin/users');
      return null;
    } catch (err) {
      return err instanceof ApiError
        ? err
        : new ApiError(0, 'No se pudo conectar con el servidor.');
    }
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
            {DELETE_USER_COPY.hint}
          </p>
          <div className={styles.dangerActions}>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              {DELETE_USER_COPY.action}
            </Button>
          </div>
        </div>
      )}

      <DeleteUserDialog
        target={confirmOpen ? { id: data.id, name: data.name, email: data.email } : null}
        onCancel={() => setConfirmOpen(false)}
        onDeleted={() => navigate('/admin/users')}
      />
    </div>
  );
}
