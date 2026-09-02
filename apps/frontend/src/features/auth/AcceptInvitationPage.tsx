import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api';
import { Button, Card, Input, Spinner } from '@/components/ui';
import styles from './AcceptInvitationPage.module.css';

type Invitation = { email: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT'; organization: { name: string; slug: string; logoUrl: string | null; primaryColor: string | null } };
const roleLabel: Record<Invitation['role'], string> = { ADMIN: 'Administrador', TEACHER: 'Profesor', STUDENT: 'Alumno' };
const passwordRule = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export function AcceptInvitationPage() {
  const { token = '' } = useParams();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    apiClient.get<Invitation>(`/auth/invitations/${token}`, { skipAuth: true }).then(setInvitation).catch(() => setError('Esta invitación no es válida, ya se ha usado o ha caducado.')).finally(() => setIsLoading(false));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError('El nombre es obligatorio.'); return; }
    if (password.length < 8 || !passwordRule.test(password)) { setError('La contraseña debe tener 8 caracteres, mayúscula, minúscula y número.'); return; }
    setError(null); setIsSubmitting(true);
    try { await apiClient.post(`/auth/invitations/${token}/accept`, { name: name.trim(), password }, { skipAuth: true }); setIsComplete(true); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : 'No se pudo activar la cuenta. Inténtalo de nuevo.'); }
    finally { setIsSubmitting(false); }
  }

  if (isLoading) return <main className={styles.page}><Spinner size="lg" label="Validando invitación..." /></main>;
  if (!invitation) return <main className={styles.page}><Card className={styles.card} padding="lg"><div className={styles.invalidIcon}><ShieldCheck size={26} /></div><h1>Invitación no disponible</h1><p>{error}</p><Button as={Link} to="/login" fullWidth>Ir a iniciar sesión</Button></Card></main>;
  if (isComplete) return <main className={styles.page}><Card className={styles.card} padding="lg"><div className={styles.completeIcon}><Check size={28} /></div><span className={styles.eyebrow}>Cuenta activada</span><h1>¡Todo listo, {name.split(' ')[0]}!</h1><p>Tu cuenta para <strong>{invitation.organization.name}</strong> ya está preparada.</p><Button as={Link} to="/login" fullWidth>Iniciar sesión</Button></Card></main>;

  return <main className={styles.page}><div className={styles.container}>
    <div className={styles.organization}><div className={styles.logo} style={invitation.organization.primaryColor ? { background: invitation.organization.primaryColor } : undefined}>{invitation.organization.logoUrl ? <img src={invitation.organization.logoUrl} alt="" /> : invitation.organization.name.slice(0, 1).toUpperCase()}</div><span>Te han invitado a</span><strong>{invitation.organization.name}</strong></div>
    <Card className={styles.card} padding="lg"><span className={styles.eyebrow}>Invitación de {roleLabel[invitation.role]}</span><h1>Activa tu cuenta</h1><p className={styles.intro}>Elige una contraseña para empezar a usar Klass.</p><form onSubmit={submit} noValidate className={styles.form}>{error && <div className={styles.error} role="alert">{error}</div>}<Input label="Email" value={invitation.email} readOnly leftIcon={<Mail size={18} />} /><Input label="Nombre completo" value={name} onChange={(event) => { setName(event.target.value); setError(null); }} leftIcon={<UserRound size={18} />} autoComplete="name" autoFocus required /><Input label="Crea una contraseña" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(null); }} leftIcon={<Lock size={18} />} hint="Mínimo 8 caracteres, mayúscula, minúscula y número." autoComplete="new-password" required /><Button type="submit" fullWidth loading={isSubmitting}>Activar cuenta</Button></form></Card>
    <p className={styles.footer}>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
  </div></main>;
}
