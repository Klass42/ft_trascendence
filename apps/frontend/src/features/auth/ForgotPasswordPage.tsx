import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MailCheck, Send } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';
import { isValidEmail } from '@/lib/email';
import { mapApiValidationErrors } from '@/lib/form-errors';
import styles from './AcceptInvitationPage.module.css';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * #110: self-service password recovery. Without an email service the backend notifies the
 * organization's admins, who send a one-use link (same flow as the admin reset in #108).
 * The answer is always the same, whether or not the account exists.
 */
export function ForgotPasswordPage() {
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ organization?: string; email?: string; form?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const slug = organizationSlug.trim().toLowerCase();
    const next: typeof errors = {};
    if (!slug) next.organization = 'El código de organización es obligatorio.';
    else if (!SLUG_RE.test(slug)) next.organization = 'El código solo puede contener letras minúsculas, números y guiones.';
    if (!email.trim()) next.email = 'El correo electrónico es obligatorio.';
    else if (!isValidEmail(email.trim())) next.email = 'Introduce un correo electrónico válido.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/forgot-password', { organizationSlug: slug, email: email.trim() }, { skipAuth: true });
      setIsDone(true);
    } catch (reason) {
      if (reason instanceof ApiError && reason.isValidationError) {
        const mapped = mapApiValidationErrors(reason.errors ?? []);
        setErrors({ organization: mapped.fields.organization, email: mapped.fields.email, form: mapped.form });
      } else if (reason instanceof ApiError && reason.status === 429) {
        setErrors({ form: 'Demasiadas solicitudes. Espera un minuto e inténtalo de nuevo.' });
      } else {
        setErrors({ form: 'No se pudo enviar la solicitud. Inténtalo de nuevo.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isDone) {
    return <main className={styles.page}><Card className={styles.card} padding="lg">
      <div className={styles.completeIcon}><MailCheck size={28} /></div>
      <h1>Solicitud enviada</h1>
      <p>Si existe una cuenta con ese correo en la organización, hemos avisado a sus administradores. Te harán llegar un enlace para crear una contraseña nueva (caduca en 24 horas y solo sirve una vez).</p>
      <Button as={Link} to="/login" fullWidth>Volver a iniciar sesión</Button>
    </Card></main>;
  }

  return <main className={styles.page}><div className={styles.container}>
    <Card className={styles.card} padding="lg">
      <span className={styles.eyebrow}>Seguridad</span>
      <h1>¿Has olvidado tu contraseña?</h1>
      <p className={styles.intro}>Indica tu organización y tu correo. Avisaremos a los administradores de tu centro para que te envíen un enlace de restablecimiento.</p>
      <form onSubmit={submit} noValidate className={styles.form}>
        {errors.form && <div className={styles.error} role="alert">{errors.form}</div>}
        <Input label="Código de organización" placeholder="mi-centro" value={organizationSlug} maxLength={63} onChange={(event) => { setOrganizationSlug(event.target.value.toLowerCase()); setErrors((current) => ({ ...current, organization: undefined })); }} error={errors.organization} autoComplete="organization" autoFocus required />
        <Input type="email" label="Correo electrónico" placeholder="tu@correo.es" value={email} maxLength={254} onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: undefined })); }} error={errors.email} leftIcon={<Mail size={18} />} autoComplete="email" required />
        <Button type="submit" fullWidth loading={isSubmitting} leftIcon={<Send size={18} />}>Solicitar enlace</Button>
      </form>
    </Card>
    <p className={styles.footer}><Link to="/login">Volver a iniciar sesión</Link></p>
  </div></main>;
}
