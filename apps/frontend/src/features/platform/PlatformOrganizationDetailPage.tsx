import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Check, Copy, Link as LinkIcon, PlayCircle, UserPlus } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api';
import { Badge, Button, Card, ConfirmDialog, Input, Select, Spinner, useToast } from '@/components/ui';
import { plural } from '@/lib/format';
import styles from './PlatformOrganizationDetailPage.module.css';

type PlanValue = 'STARTER' | 'GROWTH' | 'ENTERPRISE' | 'CUSTOM';
type OrgStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  plan: PlanValue;
  maxUsers: number | null;
  maxCourses: number | null;
  maxStorageMb: number | null;
  createdAt: string;
  logoUrl: string | null;
  primaryColor: string | null;
  timezone: string | null;
  defaultLanguage: string | null;
  _count: { users: number; invitations: number };
  /** #134: only on GET; PATCH/suspend responses omit it, so they are merged. */
  usage?: {
    users: { used: number; deactivated: number; limit: number | null };
    courses: { used: number; limit: number | null };
    storage: { usedBytes: number; usedMb: number; limitMb: number | null };
  };
  users?: Array<{ id: string; name: string; email: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT'; emailVerifiedAt: string | null; deactivatedAt: string | null; createdAt: string }>;
}

const ROLE_LABEL = { ADMIN: 'Administrador', TEACHER: 'Profesor', STUDENT: 'Alumno' } as const;
const LANGUAGE_OPTIONS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

function usageLine(used: number, limit: number | null, unit = '') {
  return limit === null ? `${used}${unit} / ilimitado` : `${used}${unit} / ${limit}${unit}`;
}

interface AdminInvitationResult {
  invitationToken: string;
}

const PLAN_OPTIONS = [
  { value: 'STARTER', label: 'Starter' },
  { value: 'GROWTH', label: 'Growth' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
  { value: 'CUSTOM', label: 'Custom' },
];

const STATUS_LABEL: Record<OrgStatus, string> = { ACTIVE: 'Activa', SUSPENDED: 'Suspendida', ARCHIVED: 'Archivada' };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function limitToInput(value: number | null): string {
  return value === null ? '' : String(value);
}

/** Empty string → unlimited (null). Otherwise a positive integer, or `undefined` when invalid. */
function inputToLimit(value: string): number | null | undefined {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function PlatformOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [plan, setPlan] = useState<PlanValue>('STARTER');
  const [maxUsers, setMaxUsers] = useState('');
  const [maxCourses, setMaxCourses] = useState('');
  const [maxStorageMb, setMaxStorageMb] = useState('');
  const [limitErrors, setLimitErrors] = useState<Record<string, string>>({});
  const [savingLimits, setSavingLimits] = useState(false);

  const [details, setDetails] = useState({ name: '', logoUrl: '', primaryColor: '', timezone: '', defaultLanguage: 'es' });
  const [savingDetails, setSavingDetails] = useState(false);

  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const [adminEmail, setAdminEmail] = useState('');
  const [adminEmailError, setAdminEmailError] = useState<string | null>(null);
  const [invitingAdmin, setInvitingAdmin] = useState(false);
  const [adminInviteLink, setAdminInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    apiClient
      .get<OrganizationDetail>(`/platform/organizations/${id}`)
      .then((data) => {
        setOrg(data);
        setPlan(data.plan);
        setMaxUsers(limitToInput(data.maxUsers));
        setMaxCourses(limitToInput(data.maxCourses));
        setMaxStorageMb(limitToInput(data.maxStorageMb));
        setDetails({
          name: data.name,
          logoUrl: data.logoUrl ?? '',
          primaryColor: data.primaryColor ?? '',
          timezone: data.timezone ?? '',
          defaultLanguage: data.defaultLanguage ?? 'es',
        });
        setHasError(false);
      })
      .catch(() => setHasError(true))
      .finally(() => setIsLoading(false));
  }, [id]);

  async function saveLimits(event: FormEvent) {
    event.preventDefault();
    if (!id) return;

    const users = inputToLimit(maxUsers);
    const courses = inputToLimit(maxCourses);
    const storage = inputToLimit(maxStorageMb);
    const errors: Record<string, string> = {};
    const rangeMessage = 'Número entero positivo, o vacío para ilimitado';
    if (users === undefined) errors.maxUsers = rangeMessage;
    if (courses === undefined) errors.maxCourses = rangeMessage;
    if (storage === undefined) errors.maxStorageMb = rangeMessage;
    setLimitErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingLimits(true);
    try {
      const updated = await apiClient.patch<OrganizationDetail>(`/platform/organizations/${id}`, {
        plan,
        maxUsers: users,
        maxCourses: courses,
        maxStorageMb: storage,
      });
      setOrg((current) => ({ ...current, ...updated }));
      toast({ message: 'Plan y límites actualizados.', variant: 'success' });
    } catch (error) {
      toast({ message: error instanceof ApiError ? error.message : 'No se pudo actualizar la organización.', variant: 'error' });
    } finally {
      setSavingLimits(false);
    }
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setSavingDetails(true);
    try {
      const updated = await apiClient.patch<OrganizationDetail>(`/platform/organizations/${id}`, {
        name: details.name.trim(),
        logoUrl: details.logoUrl.trim() || null,
        ...(details.primaryColor.trim() && { primaryColor: details.primaryColor.trim() }),
        ...(details.timezone.trim() && { timezone: details.timezone.trim() }),
        defaultLanguage: details.defaultLanguage,
      });
      setOrg((current) => ({ ...current, ...updated }));
      toast({ message: 'Datos de la organización actualizados.', variant: 'success' });
    } catch (error) {
      toast({ message: error instanceof ApiError ? error.message : 'No se pudo actualizar la organización.', variant: 'error' });
    } finally {
      setSavingDetails(false);
    }
  }

  async function toggleStatus() {
    if (!id || !org) return;
    setTogglingStatus(true);
    try {
      const nextStatus: OrgStatus = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      // Suspend goes through POST /suspend so sessions are revoked (issue #106).
      const updated = nextStatus === 'SUSPENDED'
        ? await apiClient.post<OrganizationDetail>(`/platform/organizations/${id}/suspend`)
        : await apiClient.patch<OrganizationDetail>(`/platform/organizations/${id}`, { status: nextStatus });
      setOrg((current) => ({ ...current, ...updated }));
      toast({
        message: nextStatus === 'SUSPENDED' ? 'Organización suspendida.' : 'Organización reactivada.',
        variant: 'success',
      });
    } catch (error) {
      toast({ message: error instanceof ApiError ? error.message : 'No se pudo cambiar el estado.', variant: 'error' });
    } finally {
      setTogglingStatus(false);
      setConfirmSuspend(false);
    }
  }

  async function inviteAdmin(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    if (!EMAIL_PATTERN.test(adminEmail)) {
      setAdminEmailError('Introduce un correo electrónico válido.');
      return;
    }
    setAdminEmailError(null);
    setInvitingAdmin(true);
    try {
      const result = await apiClient.post<AdminInvitationResult>(`/platform/organizations/${id}/admins`, {
        email: adminEmail,
      });
      setAdminInviteLink(`${window.location.origin}/invite/${result.invitationToken}`);
      setAdminEmail('');
      setOrg((current) =>
        current ? { ...current, _count: { ...current._count, invitations: current._count.invitations + 1 } } : current,
      );
    } catch (error) {
      toast({ message: error instanceof ApiError ? error.message : 'No se pudo crear la invitación.', variant: 'error' });
    } finally {
      setInvitingAdmin(false);
    }
  }

  async function copyLink() {
    if (!adminInviteLink) return;
    try {
      await navigator.clipboard.writeText(adminInviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ message: 'No se pudo copiar el enlace. Selecciónalo manualmente.', variant: 'error' });
    }
  }

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" label="Cargando organización..." />
      </div>
    );
  }

  if (hasError || !org) {
    return (
      <div className={styles.page}>
        <Link to="/platform/organizations" className={styles.backLink}>
          <ArrowLeft size={16} /> Volver a organizaciones
        </Link>
        <p className={styles.error}>No se pudo cargar esta organización.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to="/platform/organizations" className={styles.backLink}>
        <ArrowLeft size={16} /> Volver a organizaciones
      </Link>

      <header className={styles.header}>
        <div>
          <h1>{org.name}</h1>
          <p>
            klass.app/{org.slug} · {plural(org._count.users, 'usuario', 'usuarios')} · {plural(org._count.invitations, 'invitación pendiente', 'invitaciones pendientes')}
          </p>
        </div>
        <Badge variant={org.status === 'ACTIVE' ? 'success' : 'warning'} dot>
          {STATUS_LABEL[org.status]}
        </Badge>
      </header>

      <div className={styles.grid}>
        {org.usage && (
          <Card padding="lg">
            <h2>Uso del plan</h2>
            <dl className={styles.form}>
              <div><dt>Usuarios activos</dt><dd>{usageLine(org.usage.users.used, org.usage.users.limit)}{org.usage.users.deactivated > 0 ? ` · ${org.usage.users.deactivated} desactivados` : ''}</dd></div>
              <div><dt>Cohortes</dt><dd>{usageLine(org.usage.courses.used, org.usage.courses.limit)}</dd></div>
              <div><dt>Almacenamiento</dt><dd>{usageLine(org.usage.storage.usedMb, org.usage.storage.limitMb, ' MB')}</dd></div>
            </dl>
          </Card>
        )}

        <Card padding="lg">
          <h2>Datos de la organización</h2>
          <form onSubmit={saveDetails} noValidate className={styles.form}>
            <Input label="Nombre" value={details.name} maxLength={100} onChange={(e) => setDetails({ ...details, name: e.target.value })} required />
            <Input label="URL del logo (https)" value={details.logoUrl} onChange={(e) => setDetails({ ...details, logoUrl: e.target.value })} placeholder="https://…" />
            <Input label="Color principal" value={details.primaryColor} onChange={(e) => setDetails({ ...details, primaryColor: e.target.value })} placeholder="#4f46e5" />
            <Input label="Zona horaria (IANA)" value={details.timezone} onChange={(e) => setDetails({ ...details, timezone: e.target.value })} placeholder="Europe/Madrid" />
            <Select label="Idioma por defecto" value={details.defaultLanguage} onChange={(e) => setDetails({ ...details, defaultLanguage: e.target.value })} options={LANGUAGE_OPTIONS} />
            <Button type="submit" loading={savingDetails}>Guardar datos</Button>
          </form>
        </Card>

        <Card padding="lg">
          <h2>Plan y límites</h2>
          <p className={styles.hint}>Deja un campo vacío para dejarlo sin límite.</p>
          <form onSubmit={saveLimits} noValidate className={styles.form}>
            <Select label="Plan" value={plan} onChange={(e) => setPlan(e.target.value as PlanValue)} options={PLAN_OPTIONS} />
            <Input
              label="Máx. usuarios"
              inputMode="numeric"
              value={maxUsers}
              onChange={(e) => setMaxUsers(e.target.value)}
              error={limitErrors.maxUsers}
              placeholder="Ilimitado"
            />
            <Input
              label="Máx. cohortes"
              inputMode="numeric"
              value={maxCourses}
              onChange={(e) => setMaxCourses(e.target.value)}
              error={limitErrors.maxCourses}
              placeholder="Ilimitado"
            />
            <Input
              label="Almacenamiento máx. (MB)"
              inputMode="numeric"
              value={maxStorageMb}
              onChange={(e) => setMaxStorageMb(e.target.value)}
              error={limitErrors.maxStorageMb}
              placeholder="Ilimitado"
            />
            <Button type="submit" loading={savingLimits}>
              Guardar cambios
            </Button>
          </form>
        </Card>

        <Card padding="lg">
          <h2>Estado</h2>
          <p className={styles.hint}>
            {org.status === 'ACTIVE'
              ? 'Suspender revoca de inmediato las sesiones activas de todos sus miembros.'
              : 'Reactivar permite a sus miembros volver a iniciar sesión.'}
          </p>
          <Button
            variant={org.status === 'ACTIVE' ? 'danger' : 'primary'}
            leftIcon={org.status === 'ACTIVE' ? <Ban size={16} /> : <PlayCircle size={16} />}
            onClick={() => (org.status === 'ACTIVE' ? setConfirmSuspend(true) : toggleStatus())}
            loading={togglingStatus}
          >
            {org.status === 'ACTIVE' ? 'Suspender organización' : 'Reactivar organización'}
          </Button>
        </Card>

        {org.users && (
          <Card padding="lg" className={styles.wide}>
            <h2>Usuarios</h2>
            <p className={styles.hint}>
              Solo lectura. Quitar o reactivar miembros lo hace la administración de la organización en Usuarios.
              {org.users.length >= 200 ? ' Se muestran los 200 primeros.' : ''}
            </p>
            {org.users.length === 0 ? (
              <p className={styles.hint}>Aún no hay usuarios.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr><th align="left">Nombre</th><th align="left">Correo electrónico</th><th align="left">Rol</th><th align="left">Cuenta</th></tr>
                </thead>
                <tbody>
                  {org.users.map((member) => (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      <td>{member.email}</td>
                      <td>{ROLE_LABEL[member.role]}</td>
                      <td>
                        {member.deactivatedAt
                          ? <Badge variant="neutral">Desactivada</Badge>
                          : member.emailVerifiedAt
                            ? <Badge variant="success" dot>Activa</Badge>
                            : <Badge variant="warning" dot>Pendiente</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        <Card padding="lg" className={styles.wide}>
          <h2>Administrador de recuperación</h2>
          <p className={styles.hint}>
            Genera un acceso de administrador nuevo si esta organización perdió el suyo. SUPERADMIN no ve ni modifica
            sus cursos o usuarios existentes — solo entrega este acceso.
          </p>

          {adminInviteLink && (
            <div className={styles.inviteBox}>
              <div className={styles.inviteHeading}>
                <LinkIcon size={16} />
                <span>Enlace de invitación · caduca en 7 días</span>
              </div>
              <div className={styles.inviteControl}>
                <input
                  aria-label="Enlace de invitación"
                  readOnly
                  value={adminInviteLink}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  size="sm"
                  variant={copied ? 'secondary' : 'primary'}
                  onClick={copyLink}
                  leftIcon={copied ? <Check size={15} /> : <Copy size={15} />}
                >
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={inviteAdmin} noValidate className={styles.inviteForm}>
            <Input
              label="Correo electrónico del nuevo administrador"
              type="email"
              value={adminEmail}
              maxLength={254}
              onChange={(e) => setAdminEmail(e.target.value)}
              error={adminEmailError || undefined}
              placeholder="admin@organizacion.demo"
              required
            />
            <Button type="submit" loading={invitingAdmin} leftIcon={<UserPlus size={16} />}>
              Crear invitación
            </Button>
          </form>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmSuspend}
        title="Suspender organización"
        message="Esto cerrará la sesión de todos sus miembros de inmediato. Podrás reactivarla cuando quieras."
        confirmLabel="Suspender"
        variant="danger"
        loading={togglingStatus}
        onConfirm={toggleStatus}
        onCancel={() => setConfirmSuspend(false)}
      />
    </div>
  );
}
