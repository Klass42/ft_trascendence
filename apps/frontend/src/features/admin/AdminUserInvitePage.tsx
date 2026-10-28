import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Link as LinkIcon, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api';
import { isValidEmail } from '@/lib/email';
import { Button, Card, Input } from '@/components/ui';
import styles from './AdminUserInvitePage.module.css';

type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';
type InvitationResult = { email: string; role: Role; invitationToken: string; expiresAt: string; replacedPending?: boolean };
const roles: Array<{ value: Role; label: string; note: string }> = [
  { value: 'TEACHER', label: 'Profesor', note: 'Crea y gestiona asignaturas y contenido.' },
  { value: 'ADMIN', label: 'Administrador', note: 'Gestiona personas y ajustes de la organización.' },
  { value: 'STUDENT', label: 'Alumno', note: 'Accede al aprendizaje y a sus tareas.' },
];

export function AdminUserInvitePage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('TEACHER');
  const [result, setResult] = useState<InvitationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const inviteLink = result ? `${window.location.origin}/invite/${result.invitationToken}` : '';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(email.trim())) { setError('Introduce un correo electrónico válido.'); return; }
    setError(null); setIsSubmitting(true);
    try { setResult(await apiClient.post<InvitationResult>('/organizations/me/invitations', { email: email.trim().toLowerCase(), role })); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : 'No se pudo crear la invitación.'); }
    finally { setIsSubmitting(false); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(inviteLink); setIsCopied(true); window.setTimeout(() => setIsCopied(false), 2000); }
    catch { setError('No se pudo copiar el enlace. Selecciónalo y cópialo manualmente.'); }
  }

  if (result) return <div className={styles.page}><Card className={styles.successCard} padding="lg"><div className={styles.successIcon}><Check size={28} /></div><span className={styles.eyebrow}>Invitación lista</span><h1>El acceso está preparado.</h1><p>Comparte este enlace privado con <strong>{result.email}</strong>. Caduca en 7 días y solo se puede usar una vez.</p>{result.replacedPending && <div className={styles.error} role="status">Ya había una invitación pendiente para este email: el enlace anterior ha dejado de funcionar.</div>}<div className={styles.linkBox}><div><LinkIcon size={16} /> Enlace de activación</div><section><input aria-label="Enlace de activación" value={inviteLink} readOnly onFocus={(event) => event.currentTarget.select()} /><Button type="button" size="sm" onClick={copyLink} variant={isCopied ? 'secondary' : 'primary'} leftIcon={isCopied ? <Check size={15} /> : <Copy size={15} />}>{isCopied ? 'Copiado' : 'Copiar'}</Button></section></div>{error && <div className={styles.error} role="alert">{error}</div>}<div className={styles.actions}><Button as={Link} to="/admin/users" variant="outline">Ver usuarios</Button><Button type="button" onClick={() => { setResult(null); setEmail(''); }}>Invitar a otra persona</Button></div></Card></div>;

  return <div className={styles.page}><Link className={styles.backLink} to="/admin/users"><ArrowLeft size={16} /> Volver a usuarios</Link><div className={styles.heading}><span className={styles.eyebrow}>Equipo</span><h1>Invitar a una persona</h1><p>La persona elegirá su propia contraseña mediante un enlace seguro.</p></div><Card className={styles.formCard} padding="lg"><form onSubmit={submit} noValidate>{error && <div className={styles.error} role="alert">{error}</div>}<Input label="Correo electrónico" type="email" placeholder="nombre@organizacion.es" value={email} maxLength={254} onChange={(event) => { setEmail(event.target.value); setError(null); }} leftIcon={<Mail size={18} />} autoFocus required /><fieldset className={styles.roleField}><legend>Rol en la organización</legend><div className={styles.roles}>{roles.map((item) => <label key={item.value} className={`${styles.role} ${role === item.value ? styles.selected : ''}`}><input type="radio" name="role" value={item.value} checked={role === item.value} onChange={() => setRole(item.value)} /><span><strong>{item.label}</strong><small>{item.note}</small></span></label>)}</div></fieldset><div className={styles.actions}><Button as={Link} to="/admin/users" variant="ghost">Cancelar</Button><Button type="submit" loading={isSubmitting} leftIcon={<UserPlus size={18} />}>Generar invitación</Button></div></form></Card><aside className={styles.note}><ShieldCheck size={18} /> No compartas el enlace fuera de la persona invitada.</aside></div>;
}
