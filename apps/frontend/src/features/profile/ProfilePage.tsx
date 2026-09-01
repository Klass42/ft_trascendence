import { useEffect, useState, type ChangeEvent } from 'react';
import { useAuth, useUpdateProfile, useChangePassword } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  FileUpload,
  Input,
  Select,
  Spinner,
  Toggle,
  useToast,
  type FileValue,
} from '@/components/ui';
import styles from './ProfilePage.module.css';

const PASSWORD_RULE = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { updateProfile, isSaving: isSavingProfile } = useUpdateProfile();
  const { changePassword, isSaving: isSavingPassword } = useChangePassword();

  const [avatarFiles, setAvatarFiles] = useState<FileValue[]>([]);

  const handleAvatarChange = async (files: FileValue[]) => {
    setAvatarFiles(files);
    const done = files.find((f) => f.status === 'done' && f.url);
    if (done?.url) {
      try {
        await updateProfile({ avatarUrl: done.url });
        toast({ variant: 'success', message: 'Foto de perfil actualizada' });
      } catch {
        toast({ variant: 'error', message: 'No se pudo guardar la foto de perfil' });
      }
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

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const roleLabel =
    user.role === 'STUDENT' ? 'Alumno' : user.role === 'TEACHER' ? 'Profesor' : 'Admin';

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Perfil</h1>

      <Card title="Identidad" className={styles.section}>
        <div className={styles.identityRow}>
          <div className={styles.avatar}>
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}
          </div>
          <div>
            <div className={styles.displayName}>{user.name}</div>
            <div className={styles.meta}>
              {roleLabel} · {user.email}
            </div>
          </div>
        </div>

        {user.organizationId && <div className={styles.upload}>
          <FileUpload
            accept="image/*"
            maxSizeBytes={5 * 1024 * 1024}
            multiple={false}
            maxFiles={1}
            organizationId={user.organizationId}
            uploaderId={user.userId}
            value={avatarFiles}
            onChange={handleAvatarChange}
            autoUpload
            hint="Foto de perfil. Formatos: JPG, PNG, WebP. Máximo 5 MB."
          />
        </div>}

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
