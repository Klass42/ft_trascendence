import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api';
import { Card, Spinner } from '@/components/ui';
import styles from './RegisterPage.module.css';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('Token no proporcionado.');
      return;
    }
    let cancelled = false;
    apiClient
      .get<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`, { skipAuth: true })
      .then(() => { if (!cancelled) setStatus('success'); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        const message = err instanceof ApiError ? err.message.trim() : '';
        setErrorMsg(
          message && message !== 'Bad Request Exception'
            ? message
            : 'El enlace de verificación no es válido o ha caducado.',
        );
      });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Card className={styles.card}>
          <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
            {status === 'loading' && (
              <>
                <Spinner size="lg" />
                <p style={{ marginTop: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
                  Verificando tu email...
                </p>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle size={48} color="var(--color-success)" />
                <h3 style={{ margin: 'var(--space-4) 0 var(--space-2)', color: 'var(--color-text-primary)' }}>
                  Correo electrónico verificado
                </h3>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                  Tu cuenta ha sido verificada correctamente.
                </p>
                <Link to="/login" className={styles.link}>
                  Iniciar sesión
                </Link>
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle size={48} color="var(--color-error)" />
                <h3 style={{ margin: 'var(--space-4) 0 var(--space-2)', color: 'var(--color-text-primary)' }}>
                  No se pudo verificar el correo
                </h3>
                <p role="alert" style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                  {errorMsg}
                </p>
                <Link to="/login" className={styles.link}>
                  Volver al inicio de sesión
                </Link>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
