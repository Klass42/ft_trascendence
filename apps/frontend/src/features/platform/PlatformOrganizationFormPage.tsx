import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Check, Clipboard, Copy, Link as LinkIcon, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';
import styles from './PlatformOrganizationFormPage.module.css';

type FormState = { name: string; slug: string; adminName: string; adminEmail: string };
type ProvisionResult = { organization: { id: string; name: string; slug: string }; invitationToken: string };
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function PlatformOrganizationFormPage() {
  const [form, setForm] = useState<FormState>({ name: '', slug: '', adminName: '', adminEmail: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'form', string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const inviteLink = result ? `${window.location.origin}/invite/${result.invitationToken}` : '';

  function update(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: key === 'slug' ? value.toLowerCase().replace(/\s+/g, '-') : value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  }

  function validate() {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'El nombre de la organización es obligatorio.';
    if (!form.slug) next.slug = 'El código de acceso es obligatorio.';
    else if (!slugPattern.test(form.slug)) next.slug = 'Usa minúsculas, números y guiones simples.';
    if (!form.adminName.trim()) next.adminName = 'Indica el nombre de la persona administradora.';
    if (!form.adminEmail.trim()) next.adminEmail = 'El correo electrónico es obligatorio.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail)) next.adminEmail = 'Introduce un correo electrónico válido.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const response = await apiClient.post<ProvisionResult>('/platform/organizations', {
        ...form,
        name: form.name.trim(), slug: form.slug.trim(), adminName: form.adminName.trim(), adminEmail: form.adminEmail.trim().toLowerCase(),
      });
      setResult(response);
    } catch (error) {
      setErrors({ form: error instanceof ApiError ? error.message : 'No se pudo crear la organización. Comprueba tu conexión.' });
    } finally { setIsSubmitting(false); }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2000);
    } catch { setErrors({ form: 'No se pudo copiar el enlace. Selecciónalo y cópialo manualmente.' }); }
  }

  if (result) return (
    <div className={styles.page}>
      <section className={styles.successPanel} aria-labelledby="provisioned-title">
        <div className={styles.successIcon}><Check size={28} /></div>
        <span className={styles.eyebrow}>Organización preparada</span>
        <h1 id="provisioned-title">{result.organization.name} ya tiene su espacio.</h1>
        <p>Comparte este enlace privado con {form.adminName}. Le permitirá activar su cuenta de administrador en un único paso.</p>
        <div className={styles.inviteBox}>
          <div className={styles.inviteHeading}><LinkIcon size={17} /><span>Enlace de invitación · caduca en 7 días</span></div>
          <div className={styles.inviteControl}>
            <input aria-label="Enlace de invitación" readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} />
            <Button type="button" size="sm" variant={isCopied ? 'secondary' : 'primary'} onClick={copyInvite} leftIcon={isCopied ? <Check size={15} /> : <Copy size={15} />}>{isCopied ? 'Copiado' : 'Copiar'}</Button>
          </div>
        </div>
        {errors.form && <div className={styles.error} role="alert">{errors.form}</div>}
        <div className={styles.successActions}>
          <Button as={Link} to="/platform/organizations" variant="outline">Ver organizaciones</Button>
          <Button type="button" onClick={() => { setResult(null); setForm({ name: '', slug: '', adminName: '', adminEmail: '' }); }}>Crear otra</Button>
        </div>
      </section>
    </div>
  );

  return (
    <div className={styles.page}>
      <Link to="/platform/organizations" className={styles.backLink}><ArrowLeft size={16} /> Volver a organizaciones</Link>
      <div className={styles.heading}>
        <span className={styles.eyebrow}>Aprovisionamiento</span><h1>Nueva organización</h1><p>Configura su identidad y entrega el acceso inicial a la persona que la administrará.</p>
      </div>
      <div className={styles.layout}>
        <Card className={styles.formCard} padding="lg">
          <form onSubmit={submit} noValidate>
            {errors.form && <div className={styles.error} role="alert">{errors.form}</div>}
            <div className={styles.formSection}>
              <div className={styles.sectionTitle}><span><Building2 size={18} /></span><div><h2>Identidad de la organización</h2><p>Así la reconocerán sus miembros.</p></div></div>
              <Input label="Nombre" placeholder="Ej. Academia Horizonte" value={form.name} maxLength={100} onChange={(event) => update('name', event.target.value)} error={errors.name} autoFocus required />
              <Input label="Código de acceso" placeholder="academia-horizonte" value={form.slug} onChange={(event) => update('slug', event.target.value)} error={errors.slug} hint="Solo minúsculas, números y guiones. Se usará al iniciar sesión." required />
            </div>
            <div className={styles.formSection}>
              <div className={styles.sectionTitle}><span><UserRound size={18} /></span><div><h2>Administrador inicial</h2><p>Recibirá el enlace para activar la organización.</p></div></div>
              <Input label="Nombre completo" placeholder="Ej. Elena García" value={form.adminName} maxLength={100} onChange={(event) => update('adminName', event.target.value)} error={errors.adminName} leftIcon={<UserRound size={18} />} autoComplete="name" required />
              <Input label="Correo electrónico de trabajo" type="email" placeholder="elena@academia.es" value={form.adminEmail} maxLength={254} onChange={(event) => update('adminEmail', event.target.value)} error={errors.adminEmail} leftIcon={<Mail size={18} />} autoComplete="email" required />
            </div>
            <div className={styles.formActions}><Button as={Link} to="/platform/organizations" variant="ghost">Cancelar</Button><Button type="submit" loading={isSubmitting} leftIcon={<Clipboard size={18} />}>Crear y generar enlace</Button></div>
          </form>
        </Card>
        <aside className={styles.guide}><div className={styles.guideIcon}><ShieldCheck size={22} /></div><h2>Un acceso, un responsable</h2><p>La primera persona administradora podrá invitar después a otros administradores, profesores y alumnos desde su organización.</p><ol><li><span>1</span> Crea la organización.</li><li><span>2</span> Copia el enlace seguro.</li><li><span>3</span> La persona invitada define su contraseña.</li></ol></aside>
      </div>
    </div>
  );
}
