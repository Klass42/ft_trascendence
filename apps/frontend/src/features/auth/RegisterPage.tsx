import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, UserPlus } from 'lucide-react';
import { useAuth, ApiError } from '@/lib/api';
import { Button, Input, Card } from '@/components/ui';
import { mapApiValidationErrors } from '@/lib/form-errors';
import { GoogleIcon, useGoogleEnabled } from './GoogleSignIn';
import { isValidEmail } from '@/lib/email';
import styles from './RegisterPage.module.css';

const PASSWORD_RULES = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useAuth();
  const googleEnabled = useGoogleEnabled();

  const [name, setName] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; organization?: string; email?: string; password?: string; form?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'El nombre es obligatorio';
    else if (name.trim().length > 100) next.name = 'El nombre no puede superar los 100 caracteres.';
    if (!organizationSlug.trim()) next.organization = 'El código de organización es obligatorio';
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organizationSlug.trim().toLowerCase())) {
      next.organization = 'El código solo puede contener letras minúsculas, números y guiones.';
    }
    if (!email.trim()) {
      next.email = 'El correo electrónico es obligatorio.';
    } else if (!isValidEmail(email.trim())) {
      next.email = 'Introduce un correo electrónico válido.';
    } else if (email.trim().length > 254) {
      next.email = 'El correo electrónico no puede superar los 254 caracteres.';
    }
    if (!password) {
      next.password = 'La contraseña es obligatoria';
    } else if (password.length < 8) {
      next.password = 'Mínimo 8 caracteres';
    } else if (!PASSWORD_RULES.test(password)) {
      next.password = 'Debe contener mayúscula, minúscula y número';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function mapServerErrors(err: ApiError) {
    if (err.isValidationError && err.errors) {
      const mapped = mapApiValidationErrors(err.errors);
      setErrors({
        name: mapped.fields.name,
        organization: mapped.fields.organization,
        email: mapped.fields.email,
        password: mapped.fields.password,
        form: mapped.form,
      });
    } else if (err.status === 409) {
      setErrors({ form: 'No se ha podido crear la cuenta con estos datos. Si ya tienes una cuenta, inicia sesión o recupera tu contraseña.' });
    } else {
      setErrors({ form: err.message || 'Error al crear la cuenta. Inténtalo de nuevo.' });
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      const result = await register(name.trim(), email.trim(), password, organizationSlug.trim().toLowerCase());
      if (result === true) navigate('/dashboard', { replace: true });
      else setPendingMessage(result);
    } catch (err) {
      if (err instanceof ApiError) mapServerErrors(err);
      else setErrors({ form: 'Error de red. Comprueba tu conexión.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'var(--color-accent-primary)', color: 'var(--color-text-inverse)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 24, margin: '0 auto 16px',
          }}>
            K
          </div>
          <h1 className={styles.title}>Klass</h1>
          <p className={styles.subtitle}>Crea tu cuenta</p>
        </div>

        <Card className={styles.card}>
          {pendingMessage ? (
            <div role="status" className={styles.form}>
              <p>{pendingMessage}</p>
              <Link to="/login">Ir a iniciar sesión</Link>
            </div>
          ) : (
          <form onSubmit={handleSubmit} noValidate className={styles.form}>
            {errors.form && (
              <div className={styles.error} role="alert">{errors.form}</div>
            )}

            <Input
              type="text"
              label="Nombre completo"
              placeholder="Tu nombre"
              value={name}
              maxLength={100}
              onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
              leftIcon={<User size={18} />}
              error={errors.name}
              required
              autoComplete="name"
              autoFocus
            />

            <Input
              label="Código de organización"
              placeholder="tu-centro"
              value={organizationSlug}
              maxLength={63}
              onChange={(e) => { setOrganizationSlug(e.target.value.toLowerCase()); setErrors((p) => ({ ...p, organization: undefined })); }}
              error={errors.organization}
              required
              autoComplete="organization"
            />

            <Input
              type="email"
              label="Correo electrónico"
              placeholder="nombre@ejemplo.es"
              value={email}
              maxLength={254}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
              leftIcon={<Mail size={18} />}
              error={errors.email}
              required
              autoComplete="email"
            />

            <Input
              type="password"
              label="Contraseña"
              placeholder="••••••••"
              value={password}
              maxLength={128}
              onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
              leftIcon={<Lock size={18} />}
              error={errors.password}
              hint="Mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 número"
              required
              autoComplete="new-password"
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isLoading}
              leftIcon={<UserPlus size={18} />}
            >
              Crear cuenta
            </Button>

            {googleEnabled && (
              <>
              <div className={styles.divider}>
                <span>o continuar con</span>
              </div>

              <Button
                type="button"
                variant="outline"
                leftIcon={<GoogleIcon />}
                fullWidth
                onClick={() => {
                  const slug = organizationSlug.trim().toLowerCase();
                  if (!slug) {
                    setErrors((p) => ({ ...p, form: 'El código de organización es obligatorio.' }));
                    return;
                  }
                  if (!loginWithGoogle(slug)) {
                    setErrors((p) => ({ ...p, form: 'El código de organización no es válido. Usa minúsculas, números y guiones, sin espacios.' }));
                  }
                }}
              >
                Continuar con Google
              </Button>
              </>
            )}
          </form>
          )}
        </Card>

        <p className={styles.footer}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className={styles.link}>
            Inicia sesión
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
