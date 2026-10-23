import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { tokenStorage } from '@/lib/api';
import { Card, Spinner } from '@/components/ui';
import styles from './RegisterPage.module.css';

function parseHashFragment(): { accessToken?: string; refreshToken?: string; error?: string } {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return {
    accessToken: params.get('accessToken') ?? undefined,
    refreshToken: params.get('refreshToken') ?? undefined,
    error: params.get('error') ?? undefined,
  };
}

export function OAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const { accessToken, refreshToken, error: oauthError } = parseHashFragment();

    if (oauthError === 'unknown_organization') {
      setError('No existe una organización con ese código.');
      return;
    }
    if (oauthError === 'wrong_organization') {
      setError('Esta cuenta de Google ya está vinculada a otra organización.');
      return;
    }
    if (oauthError === 'invalid_state') {
      setError('La solicitud de Google no es válida o ha caducado. Vuelve a intentarlo.');
      return;
    }
    if (oauthError) {
      setError('Error al iniciar sesión con Google. Inténtalo de nuevo.');
      return;
    }

    if (accessToken && refreshToken) {
      tokenStorage.setTokens({ accessToken, refreshToken });
      // This route loads after AuthProvider's first check. A client-side
      // navigation would open the dashboard still logged out.
      window.location.replace('/dashboard');
      return;
    }

    setError('No se recibieron tokens de autenticación.');
  }, []);

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <Card>
            <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
              <AlertTriangle size={48} color="var(--color-warning)" />
              <h3 style={{ margin: 'var(--space-4) 0 var(--space-2)', color: 'var(--color-text-primary)' }}>
                Error de autenticación
              </h3>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                {error}
              </p>
              <Link to="/login" className={styles.link}>
                Volver al inicio de sesión
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
            <Spinner size="lg" />
            <p style={{ marginTop: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
              Iniciando sesión...
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
