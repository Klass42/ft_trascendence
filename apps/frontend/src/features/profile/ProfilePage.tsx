import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { apiClient, useAuth, useUpdateProfile, useChangePassword } from '@/lib/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Select,
  Spinner,
  Toggle,
  useToast,
} from '@/components/ui';
import styles from './ProfilePage.module.css';

const PASSWORD_RULE = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const { updateProfile, isSaving: isSavingProfile } = useUpdateProfile();
  const { changePassword, isSaving: isSavingPassword } = useChangePassword();

  const avatarInput = useRef<HTMLInputElement>(null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string>();

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    if (!AVATAR_TYPES.has(file.type)) {
      setAvatarError('Elige una imagen PNG, JPG o WebP.');
      return;
    }
    if (file.size === 0 || file.size > AVATAR_MAX_BYTES) {
      setAvatarError('La imagen debe ocupar como máximo 2 MB.');
      return;
    }

    setIsSavingAvatar(true);
    setAvatarError(undefined);
    try {
      await apiClient.uploadWithProgress('/users/me/avatar', file, { method: 'PATCH' });
      await refreshUser();
      toast({ variant: 'success', message: 'Foto de perfil actualizada' });
    } catch (err) {
      const message = err instanceof Error && err.message
        ? err.message
        : 'No se pudo subir la imagen. Comprueba el formato y el tamaño.';
      setAvatarError(message);
      toast({ variant: 'error', message });
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setIsSavingAvatar(true);
    setAvatarError(undefined);
    try {
      await apiClient.delete('/users/me/avatar');
      await refreshUser();
      toast({ variant: 'success', message: 'Foto de perfil eliminada' });
    } catch {
      setAvatarError('No se pudo eliminar la foto de perfil. Inténtalo de nuevo.');
      toast({ variant: 'error', message: 'No se pudo eliminar la foto de perfil' });
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const [name, setName] = useState(user?.name ?? '');
  const [nameError, setNameError] = useState<string>();
  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('El nombre no puede estar vacío');
      return;
    }
    setNameError(undefined);
    try {
      await updateProfile({ name: trimmed });
      toast({ variant: 'success', message: 'Nombre actualizado' });
    } catch {
      toast({ variant: 'error', message: 'No se pudo actualizar el nombre' });
    }
  };

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string;
    next?: string;
    confirm?: string;
  }>({});

  const handleChangePassword = async () => {
    const errors: typeof passwordErrors = {};
    if (!currentPassword) errors.current = 'Introduce tu contraseña actual';
    if (newPassword.length < 8 || !PASSWORD_RULE.test(newPassword)) {
      errors.next = 'Mínimo 8 caracteres, con mayúscula, minúscula y número';
    }
    if (confirmPassword !== newPassword) errors.confirm = 'Las contraseñas no coinciden';
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      await changePassword({ currentPassword, newPassword });
    } catch (err) {
      setPasswordErrors({
        current: (err as Error).message || 'No se pudo cambiar la contraseña',
      });
    }
  };

  const handleToggleNotifications = async (next: boolean) => {
    try {
      await updateProfile({ emailNotificationsEnabled: next });
      toast({
        variant: 'success',
        message: next ? 'Notificaciones activadas' : 'Notificaciones desactivadas',
      });
    } catch {
      toast({ variant: 'error', message: 'No se pudo guardar la preferencia' });
    }
  };

  const handleLanguageChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    try {
      await updateProfile({ preferredLanguage: e.target.value });
      toast({ variant: 'success', message: 'Idioma guardado' });
    } catch {
      toast({ variant: 'error', message: 'No se pudo guardar el idioma' });
    }
  };

  if (!user) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  const roleLabel =
    user.role === 'STUDENT' ? 'Alumno' : user.role === 'TEACHER' ? 'Profesor' : 'Admin';

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Perfil</h1>

      <Card title="Identidad" className={styles.section}>
        <div className={styles.identityRow}>
          <Avatar src={user.avatarUrl} size="lg" />
          <div>
            <div className={styles.displayName}>{user.name}</div>
            <div className={styles.meta}>
              {roleLabel} · {user.email}
            </div>
          </div>
        </div>

        <div className={styles.upload}>
          <label className={styles.uploadLabel} htmlFor="profile-avatar-input">Foto de perfil</label>
          <input
            ref={avatarInput}
            id="profile-avatar-input"
            className={styles.fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Foto de perfil en PNG, JPG o WebP"
            aria-describedby="profile-avatar-hint"
            onChange={handleAvatarChange}
          />
          <p className={styles.uploadHint} id="profile-avatar-hint">
            PNG, JPG o WebP. Máximo 2 MB.
          </p>
          <div className={styles.avatarActions}>
            <Button onClick={() => avatarInput.current?.click()} loading={isSavingAvatar}>
              Cambiar foto
            </Button>
            {user.avatarUrl && (
              <Button variant="outline" onClick={handleRemoveAvatar} loading={isSavingAvatar}>
                Quitar foto
              </Button>
            )}
          </div>
          {avatarError && <p className={styles.uploadError} role="alert">{avatarError}</p>}
        </div>

        <div className={styles.nameForm}>
          <Input
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={nameError}
          />
          <div>
            <Button
              onClick={handleSaveName}
              loading={isSavingProfile}
              disabled={name.trim() === user.name}
            >
              Guardar cambios
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Seguridad" className={styles.section}>
        <div className={styles.passwordForm}>
          <Input
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            error={passwordErrors.current}
          />
          <Input
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={passwordErrors.next}
            hint="Mínimo 8 caracteres, con mayúscula, minúscula y número"
          />
          <Input
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={passwordErrors.confirm}
          />
          <div>
            <Button onClick={handleChangePassword} loading={isSavingPassword}>
              Cambiar contraseña
            </Button>
          </div>
        </div>

        <div className={styles.row}>
          <div>
            <div className={styles.rowTitle}>Autenticación en dos pasos</div>
            <div className={styles.rowHint}>Protege tu cuenta con TOTP</div>
          </div>
          <Badge variant="info">Próximamente</Badge>
        </div>
      </Card>

      <Card title="Preferencias" className={styles.section}>
        <div className={styles.row}>
          <div>
            <div className={styles.rowTitle}>Notificaciones por email</div>
            <div className={styles.rowHint}>Resumen semanal de actividad</div>
          </div>
          <Toggle
            checked={user.emailNotificationsEnabled}
            onChange={handleToggleNotifications}
            disabled={isSavingProfile}
            aria-label="Notificaciones por email"
          />
        </div>
        <div className={styles.row}>
          <div>
            <div className={styles.rowTitle}>Idioma</div>
            <div className={styles.rowHint}>
              El idioma de la interfaz llegará en una próxima versión
            </div>
          </div>
          <Select
            value={user.preferredLanguage}
            onChange={handleLanguageChange}
            disabled={isSavingProfile}
            fullWidth={false}
            aria-label="Idioma"
            options={[
              { value: 'es', label: 'Español' },
              { value: 'en', label: 'English' },
            ]}
            className={styles.languageSelect}
          />
        </div>
      </Card>
    </div>
  );
}
