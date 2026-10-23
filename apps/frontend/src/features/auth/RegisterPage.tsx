import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, UserPlus } from 'lucide-react';
import { useAuth, ApiError } from '@/lib/api';
import { Button, Input, Card } from '@/components/ui';
import { mapApiValidationErrors } from '@/lib/form-errors';
import styles from './RegisterPage.module.css';

const PASSWORD_RULES = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useAuth();

  const [name, setName] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; organization?: string; email?: string; password?: string; form?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'El nombre es obligatorio';
    else if (name.trim().length > 100) next.name = 'El nombre no puede superar los 100 caracteres.';
    if (!organizationSlug.trim()) next.organization = 'El código de organización es obligatorio';
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organizationSlug.trim().toLowerCase())) {
      next.organization = 'El código solo puede contener letras minúsculas, números y guiones.';
    }
    if (!email.trim()) {
      next.email = 'El email es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Formato de email inválido';
    } else if (email.trim().length > 254) {
      next.email = 'El correo no puede superar los 254 caracteres.';
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
      setErrors({ email: 'Este email ya está registrado' });
    } else {
      setErrors({ form: err.message || 'Error al crear la cuenta. Inténtalo de nuevo.' });
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      await register(name.trim(), email.trim(), password, organizationSlug.trim().toLowerCase());
      navigate('/dashboard', { replace: true });
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
            background: 'var(--color-accent-primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 24, margin: '0 auto 16px',
          }}>
            K
          </div>
          <h1 className={styles.title}>Klass</h1>
          <p className={styles.subtitle}>Crea tu cuenta</p>
        </div>

        <Card className={styles.card}>
          <form onSubmit={handleSubmit} className={styles.form}>
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
              placeholder="your-school"
              value={organizationSlug}
              maxLength={63}
              onChange={(e) => { setOrganizationSlug(e.target.value.toLowerCase()); setErrors((p) => ({ ...p, organization: undefined })); }}
              error={errors.organization}
              required
              autoComplete="organization"
            />

            <Input
              type="email"
              label="Email"
              placeholder="tu@email.com"
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

            <div className={styles.divider}>
              <span>o continuar con</span>
            </div>

            <Button
              type="button"
              variant="outline"
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
              <svg className={styles.googleIcon} viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </Button>
          </form>
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
