import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailPlus, RotateCw, XCircle } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api';
import { Badge, Button, ConfirmDialog, EmptyState, Spinner, Table } from '@/components/ui';
import { CopyLink, inviteUrl } from './CopyLink';
import styles from './AdminTools.module.css';

type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';
interface PendingInvitation {
  id: string; email: string; role: Role; expiresAt: string; createdAt: string; updatedAt: string; expired: boolean;
  invitedBy: { id: string; name: string } | null;
}
const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', TEACHER: 'Profesor', STUDENT: 'Alumno' };
const fmt = (iso: string) => new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

export function AdminInvitationsPage() {
  const [rows, setRows] = useState<PendingInvitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resent, setResent] = useState<{ email: string; token: string } | null>(null);
  const [toRevoke, setToRevoke] = useState<PendingInvitation | null>(null);

  const load = useCallback(() => {
    setError(null);
    apiClient.get<PendingInvitation[]>('/organizations/me/invitations')
      .then(setRows)
      .catch(() => setError('No se pudieron cargar las invitaciones.'));
  }, []);
  useEffect(load, [load]);

  async function resend(invitation: PendingInvitation) {
    setBusyId(invitation.id); setError(null);
    try {
      const result = await apiClient.post<{ invitationToken: string; email: string }>(`/organizations/me/invitations/${invitation.id}/resend`, {});
      setResent({ email: result.email, token: result.invitationToken });
      load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'No se pudo reenviar la invitación.');
    } finally { setBusyId(null); }
  }

  async function revoke() {
    if (!toRevoke) return;
    setBusyId(toRevoke.id); setError(null);
    try {
      await apiClient.post(`/organizations/me/invitations/${toRevoke.id}/revoke`, {});
      if (resent?.email === toRevoke.email) setResent(null);
      load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'No se pudo revocar la invitación.');
    } finally { setBusyId(null); setToRevoke(null); }
  }

  const columns = [
    { key: 'email', header: 'Correo electrónico', render: (row: PendingInvitation) => row.email },
    { key: 'role', header: 'Rol', render: (row: PendingInvitation) => <Badge variant="accent">{ROLE_LABEL[row.role]}</Badge> },
    { key: 'expires', header: 'Caducidad', render: (row: PendingInvitation) => row.expired
      ? <Badge variant="error" dot>Caducada · {fmt(row.expiresAt)}</Badge>
      : <Badge variant="warning" dot>Caduca {fmt(row.expiresAt)}</Badge> },
    { key: 'by', header: 'Enviada por', render: (row: PendingInvitation) => <span className={styles.muted}>{row.invitedBy?.name ?? '—'} · {fmt(row.updatedAt)}</span> },
    { key: 'actions', header: 'Acciones', align: 'right' as const, render: (row: PendingInvitation) => (
      <div className={styles.actions}>
        <Button size="sm" variant="ghost" leftIcon={<RotateCw size={15} />} loading={busyId === row.id} onClick={() => resend(row)}>Reenviar</Button>
        <Button size="sm" variant="ghost" leftIcon={<XCircle size={15} />} disabled={busyId === row.id} onClick={() => setToRevoke(row)}>Revocar</Button>
      </div>
    ) },
  ];

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to="/admin/users"><ArrowLeft size={16} /> Volver a usuarios</Link>
      <header>
        <h1 className={styles.title}>Invitaciones pendientes</h1>
        <p className={styles.subtitle}>Invitaciones aún no aceptadas. Reenviar genera un enlace nuevo y el anterior deja de funcionar.</p>
      </header>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {resent && (
        <div className={styles.notice} role="status">
          <p>Nuevo enlace para <strong>{resent.email}</strong> (válido 7 días). El enlace anterior ya no funciona.</p>
          <CopyLink label="Nuevo enlace de invitación" url={inviteUrl(resent.token)} />
        </div>
      )}
      {!rows && !error ? <Spinner size="lg" label="Cargando invitaciones…" /> : (
        <Table
          columns={columns}
          data={rows ?? []}
          rowKey={(row) => row.id}
          empty={<EmptyState icon={<MailPlus size={21} />} title="No hay invitaciones pendientes" description="Las invitaciones aceptadas o revocadas no aparecen aquí." action={<Button as={Link} to="/admin/users/invite">Invitar usuario</Button>} />}
        />
      )}
      <ConfirmDialog
        open={!!toRevoke}
        title="Revocar invitación"
        message={<>El enlace enviado a <strong>{toRevoke?.email}</strong> dejará de funcionar.</>}
        confirmLabel="Revocar"
        variant="danger"
        loading={!!toRevoke && busyId === toRevoke.id}
        onConfirm={revoke}
        onCancel={() => setToRevoke(null)}
      />
    </div>
  );
}
