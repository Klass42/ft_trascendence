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
import { GoogleIcon, useGoogleEnabled } from './GoogleSignIn';
import styles from './LoginPage.module.css';

// =============================================================================
// Component
// =============================================================================

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle, isAuthenticated } = useAuth();
  const googleEnabled = useGoogleEnabled();

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
      } else if (err instanceof ApiError && err.status === 403 && /suspendida/i.test(err.message)) {
        setError('Tu organización está suspendida. Contacta con el soporte de la plataforma.');
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
              placeholder="mi-centro"
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
              placeholder="tu@correo.es"
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
            <p className={styles.forgot}>
              <Link to="/forgot-password" className={styles.link}>¿Has olvidado tu contraseña?</Link>
            </p>

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
            {googleEnabled && (
              <>
              <div className={styles.divider}>
                <span>o continuar con</span>
              </div>

              {/* Google OAuth */}
              <Button
                type="button"
                variant="outline"
                leftIcon={<GoogleIcon />}
                fullWidth
                onClick={handleGoogleLogin}
              >
                Continuar con Google
              </Button>
              </>
            )}
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
