/**
 * LoginPage Component
 * 
 * Login form with email/password and Google OAuth.
 * This is a UI placeholder - actual auth logic will work when Jorge finishes.
 */

import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, Lock, LogIn } from 'lucide-react';
import { ApiError, useAuth } from '@/lib/api';
import { Button, Input, Card } from '@/components/ui';
import { mapApiValidationErrors } from '@/lib/form-errors';
import styles from './LoginPage.module.css';

// =============================================================================
// Component
// =============================================================================

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Get the page they tried to visit before being redirected to login
  const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard';

  // If already authenticated, redirect
  if (isAuthenticated) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsLoading(true);

    try {
      await login(organizationSlug, email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.isValidationError) {
        const mapped = mapApiValidationErrors(err.errors ?? []);
        setFieldErrors(mapped.fields);
        setError(mapped.form ?? null);
      } else if (err instanceof ApiError && err.status === 401) {
        setError('El correo electrónico o la contraseña no son correctos.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('Confirma tu correo electrónico antes de iniciar sesión.');
      } else {
        setError('No se pudo iniciar sesión. Inténtalo de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const slug = organizationSlug.trim().toLowerCase();
    if (!slug) {
      setError('El código de organización es obligatorio.');
      return;
    }
    if (!loginWithGoogle(slug)) {
      setError('El código de organización no es válido. Usa minúsculas, números y guiones, sin espacios.');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'var(--color-accent-primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 24,
            margin: '0 auto 16px',
          }}>
            K
          </div>
          <h1 className={styles.title}>Klass</h1>
          <p className={styles.subtitle}>Inicia sesión en tu cuenta</p>
        </div>

        {/* Login Card */}
        <Card className={styles.card}>
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Error message */}
            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}

            {/* Email */}
            <Input
              label="Código de organización"
              placeholder="tu-centro"
              value={organizationSlug}
              maxLength={63}
              onChange={(e) => { setOrganizationSlug(e.target.value.toLowerCase()); setFieldErrors((current) => ({ ...current, organization: '' })); }}
              error={fieldErrors.organization}
              required
              autoComplete="organization"
              autoFocus
            />
            <Input
              type="email"
              label="Correo electrónico"
              placeholder="you@example.com"
              value={email}
              maxLength={254}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((current) => ({ ...current, email: '' })); }}
              error={fieldErrors.email}
              leftIcon={<Mail size={18} />}
              required
              autoComplete="email"
            />

            {/* Password */}
            <Input
              type="password"
              label="Contraseña"
              placeholder="••••••••"
              value={password}
              maxLength={128}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors((current) => ({ ...current, password: '' })); }}
              error={fieldErrors.password}
              leftIcon={<Lock size={18} />}
              required
              autoComplete="current-password"
            />

            {/* Submit button */}
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isLoading}
              leftIcon={<LogIn size={18} />}
            >
              Iniciar sesión
            </Button>

            {/* Divider */}
            <div className={styles.divider}>
              <span>o continuar con</span>
            </div>

            {/* Google OAuth */}
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={handleGoogleLogin}
            >
              <svg className={styles.googleIcon} viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuar con Google
            </Button>
          </form>
        </Card>

        {/* Footer links */}
        <p className={styles.footer}>
          ¿No tienes cuenta?{' '}
          <Link to="/register" className={styles.link}>
            Regístrate
          </Link>
        </p>
        <p className={styles.legalLinks}>
          <Link to="/privacy">Política de privacidad</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/terms">Términos de servicio</Link>
        </p>
      </div>
    </div>
  );
}
