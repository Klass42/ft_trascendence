import { useState } from 'react';
import { useAuth } from '@/lib/api';
import { FileUpload, type FileValue } from '@/components/ui';

export function ProfilePage() {
  const { user } = useAuth();
  const [avatarFiles, setAvatarFiles] = useState<FileValue[]>([]);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const roleLabel = user?.role === 'STUDENT' ? 'Alumno' : user?.role === 'TEACHER' ? 'Profesor' : 'Admin';

  const avatarUrl = avatarFiles.find((f) => f.status === 'done')?.url || user?.avatarUrl;

  return (
    <div style={{ padding: '30px 40px', maxWidth: 640 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 22px', letterSpacing: '-0.02em' }}>
        Perfil
      </h1>

      <div
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 15,
          padding: 24,
          display: 'flex',
          gap: 18,
          alignItems: 'center',
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 66,
            height: 66,
            borderRadius: '50%',
            background: avatarUrl ? 'transparent' : 'var(--color-accent-primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 24,
            flex: 'none',
            overflow: 'hidden',
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initials
          )}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{user?.name || 'Usuario'}</div>
          <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
            {roleLabel} · Klass
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <FileUpload
          accept="image/*"
          maxSizeBytes={5 * 1024 * 1024}
          multiple={false}
          maxFiles={1}
          organizationId={user?.organizationId || ''}
          uploaderId={user?.userId}
          value={avatarFiles}
          onChange={setAvatarFiles}
          autoUpload
          hint="Foto de perfil. Formatos: JPG, PNG, WebP. Máximo 5 MB."
        />
      </div>

      <div
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 15,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '15px 20px',
            borderBottom: '1px solid var(--color-border-primary)',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Notificaciones por email</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
              Resumen semanal de actividad
            </div>
          </div>
          <div
            style={{
              width: 42,
              height: 24,
              borderRadius: 20,
              background: 'var(--color-accent-primary)',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
              }}
            />
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '15px 20px',
            borderBottom: '1px solid var(--color-border-primary)',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Autenticación en dos pasos</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
              Protege tu cuenta con TOTP
            </div>
          </div>
          <div
            style={{
              width: 42,
              height: 24,
              borderRadius: 20,
              background: 'var(--color-border-secondary)',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: 2,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
              }}
            />
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '15px 20px',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Idioma</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Español</div>
          </div>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 600, cursor: 'pointer' }}>
            Cambiar
          </span>
        </div>
      </div>
    </div>
  );
}