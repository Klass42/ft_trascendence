import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Check, Copy, Link as LinkIcon, PlayCircle, UserPlus } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api';
import { Badge, Button, Card, ConfirmDialog, Input, Select, Spinner, useToast } from '@/components/ui';
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
  _count: { users: number; invitations: number };
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
      setOrg(updated);
      toast({ message: 'Plan y límites actualizados.', variant: 'success' });
    } catch (error) {
      toast({ message: error instanceof ApiError ? error.message : 'No se pudo actualizar la organización.', variant: 'error' });
    } finally {
      setSavingLimits(false);
    }
  }

  async function toggleStatus() {
    if (!id || !org) return;
    setTogglingStatus(true);
    try {
      const nextStatus: OrgStatus = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      const updated = await apiClient.patch<OrganizationDetail>(`/platform/organizations/${id}`, { status: nextStatus });
      setOrg(updated);
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
      setAdminEmailError('Introduce un email válido.');
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
            klass.app/{org.slug} · {org._count.users} usuarios · {org._count.invitations} invitación
            {org._count.invitations === 1 ? '' : 'es'} pendiente{org._count.invitations === 1 ? '' : 's'}
          </p>
        </div>
        <Badge variant={org.status === 'ACTIVE' ? 'success' : 'warning'} dot>
          {STATUS_LABEL[org.status]}
        </Badge>
      </header>

      <div className={styles.grid}>
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
              label="Máx. cursos"
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
              label="Email del nuevo admin"
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
