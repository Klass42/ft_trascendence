import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Lock, ShieldCheck } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';
import styles from './AcceptInvitationPage.module.css';

const passwordRule = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

/** Reads the token from the URL fragment so it never reaches server logs. */
function readToken() {
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') ?? '';
}

export function ResetPasswordPage() {
  const [token] = useState(readToken);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8 || !passwordRule.test(password)) { setError('La contraseña debe tener 8 caracteres, mayúscula, minúscula y número.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setError(null); setIsSubmitting(true);
    try { await apiClient.post('/auth/password-reset', { token, password }, { skipAuth: true }); setIsDone(true); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : 'No se pudo restablecer la contraseña.'); }
    finally { setIsSubmitting(false); }
  }

  if (!token) return <main className={styles.page}><Card className={styles.card} padding="lg"><div className={styles.invalidIcon}><ShieldCheck size={26} /></div><h1>Enlace no válido</h1><p>Pide un enlace nuevo desde <Link to="/forgot-password">¿Has olvidado tu contraseña?</Link> o a un administrador de tu organización.</p><Button as={Link} to="/login" fullWidth>Ir a iniciar sesión</Button></Card></main>;
  if (isDone) return <main className={styles.page}><Card className={styles.card} padding="lg"><div className={styles.completeIcon}><Check size={28} /></div><h1>Contraseña actualizada</h1><p>Hemos cerrado tus sesiones abiertas. Inicia sesión con la nueva contraseña.</p><Button as={Link} to="/login" fullWidth>Iniciar sesión</Button></Card></main>;

  return <main className={styles.page}><div className={styles.container}>
    <Card className={styles.card} padding="lg"><span className={styles.eyebrow}>Seguridad</span><h1>Restablece tu contraseña</h1><p className={styles.intro}>Este enlace lo ha generado un administrador de tu organización. Caduca en 24 horas y solo sirve una vez.</p>
      <form onSubmit={submit} noValidate className={styles.form}>{error && <div className={styles.error} role="alert">{error}</div>}
        <Input label="Nueva contraseña" type="password" value={password} maxLength={128} onChange={(event) => { setPassword(event.target.value); setError(null); }} leftIcon={<Lock size={18} />} hint="Mínimo 8 caracteres, mayúscula, minúscula y número." autoComplete="new-password" autoFocus required />
        <Input label="Repite la contraseña" type="password" value={confirm} maxLength={128} onChange={(event) => { setConfirm(event.target.value); setError(null); }} leftIcon={<Lock size={18} />} autoComplete="new-password" required />
        <Button type="submit" fullWidth loading={isSubmitting}>Guardar contraseña</Button>
      </form>
    </Card>
  </div></main>;
}
