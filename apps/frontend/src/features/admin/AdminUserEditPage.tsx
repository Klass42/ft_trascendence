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
      const msg =
        err instanceof ApiError
          ? err.message
          : 'No se pudo conectar con el servidor.';
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
            <div className={styles.banner} role="alert">
              {deleteError}
            </div>
          )}
          <div className={styles.dangerActions}>
            <Button
              variant="danger"
              loading={isDeleting}
              onClick={handleDeleteClick}
            >
              {confirmingDelete
                ? 'Confirmar eliminación'
                : 'Eliminar usuario'}
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
