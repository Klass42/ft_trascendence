import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { CopyLink, resetUrl } from './CopyLink';
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
  const [reset, setReset] = useState<{ token: string; expiresAt: string } | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  async function issueReset() {
    setIsResetting(true); setResetError(null);
    try {
      const result = await apiClient.post<{ resetToken: string; expiresAt: string }>(`/auth/admin/users/${id}/password-reset`, {});
      setReset({ token: result.resetToken, expiresAt: result.expiresAt });
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : 'No se pudo generar el enlace.');
    } finally { setIsResetting(false); }
  }

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
        <>
        <div className={styles.infoBox}>
          <p className={styles.dangerTitle}>Contraseña</p>
          <p className={styles.dangerHint}>
            Genera un enlace de un solo uso (24 h) para que {data.name} elija una contraseña nueva. Al usarlo se cierran sus sesiones. No se envía correo: compártelo tú; la persona recibe un aviso en la app.
          </p>
          {resetError && <p role="alert">{resetError}</p>}
          {reset ? (
            <CopyLink label="Enlace para restablecer la contraseña" url={resetUrl(reset.token)} />
          ) : (
            <Button variant="outline" leftIcon={<KeyRound size={16} />} loading={isResetting} onClick={issueReset}>
              Generar enlace de restablecimiento
            </Button>
          )}
        </div>
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
        </>
      )}

      <DeleteUserDialog
        target={confirmOpen ? { id: data.id, name: data.name, email: data.email } : null}
        onCancel={() => setConfirmOpen(false)}
        onDeleted={() => navigate('/admin/users')}
      />
    </div>
  );
}
