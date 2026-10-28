import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, History } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Button, EmptyState, Spinner, Table } from '@/components/ui';
import styles from './AdminTools.module.css';

interface AuditEntry {
  id: string; action: string; targetUserId: string | null; metadata: Record<string, unknown> | null; createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}
interface AuditPage { data: AuditEntry[]; total: number; page: number; pageSize: number; totalPages: number }

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  MEMBER_INVITED: 'Invitación enviada',
  MEMBER_INVITED_CSV: 'Invitación (importación CSV)',
  INVITATION_RESENT: 'Invitación reenviada',
  INVITATION_REVOKED: 'Invitación revocada',
  INVITATION_ACCEPTED: 'Invitación aceptada',
  INVITATIONS_IMPORTED: 'Importación CSV',
  PASSWORD_RESET_ISSUED: 'Enlace de restablecimiento de contraseña',
  PASSWORD_RESET_COMPLETED: 'Contraseña restablecida',
  USER_CREATED: 'Usuario creado',
  USER_UPDATED: 'Usuario modificado',
  USER_ROLE_CHANGED: 'Cambio de rol',
  USER_DELETED: 'Usuario eliminado',
  MEMBER_REMOVED: 'Miembro dado de baja',
  ORGANIZATION_PROVISIONED: 'Organización creada',
  ORGANIZATION_UPDATED: 'Organización actualizada',
  ORGANIZATION_SUSPENDED: 'Organización suspendida',
  ORGANIZATION_DELETION_REQUESTED: 'Solicitud de eliminación',
  ORGANIZATION_DELETION_REQUEST_CANCELLED: 'Solicitud de eliminación cancelada',
  ORGANIZATION_ADMIN_RECOVERY_INVITED: 'Recuperación de admin',
};

function describe(entry: AuditEntry) {
  const meta = entry.metadata ?? {};
  const parts = Object.entries(meta)
    .filter(([key]) => !key.toLowerCase().endsWith('id'))
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
  return parts.join(' · ');
}

export function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AuditPage | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setResult(null); setError(false);
    apiClient.get<AuditPage>(`/organizations/me/audit-logs?page=${page}&pageSize=50`).then(setResult).catch(() => setError(true));
  }, [page]);

  const columns = [
    { key: 'date', header: 'Fecha', render: (row: AuditEntry) => new Date(row.createdAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) },
    { key: 'action', header: 'Acción', render: (row: AuditEntry) => AUDIT_ACTION_LABEL[row.action] ?? row.action },
    { key: 'actor', header: 'Quién', render: (row: AuditEntry) => row.actor ? row.actor.name : <span className={styles.muted}>Sistema / usuario eliminado</span> },
    { key: 'detail', header: 'Detalle', render: (row: AuditEntry) => <span className={styles.mono}>{describe(row)}</span> },
  ];
  const totalPages = Math.max(result?.totalPages ?? 1, 1);

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to="/admin/users"><ArrowLeft size={16} /> Volver a usuarios</Link>
      <header>
        <h1 className={styles.title}>Registro de auditoría</h1>
        <p className={styles.subtitle}>Acciones sensibles de administración en tu organización: invitaciones, importaciones, cambios de rol, bajas y restablecimientos de contraseña.</p>
      </header>
      {error ? <div className={styles.error} role="alert">No se pudo cargar el registro.</div>
        : !result ? <Spinner size="lg" label="Cargando registro…" />
        : (
          <>
            <Table columns={columns} data={result.data} rowKey={(row) => row.id} empty={<EmptyState icon={<History size={21} />} title="Sin actividad registrada" description="Aquí aparecerán las acciones de administración." />} />
            {result.total > 0 && (
              <div className={styles.actions}>
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <span className={styles.muted}>Página {page} de {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
              </div>
            )}
          </>
        )}
    </div>
  );
}
