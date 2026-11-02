import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/api';
import { DeleteUserDialog, DELETE_USER_COPY } from '@/features/admin/DeleteUserDialog';
import { MemberAccessDialog, MEMBER_ACCESS_COPY, type MemberAccessTarget } from '@/features/admin/MemberAccessDialog';
import { Avatar, Badge, Button, Select, Spinner } from '@/components/ui';
import { useOrg, useOrgMembers } from '@/lib/api/hooks';
import type { GlobalRole } from '@/lib/api/types';
import type { MemberDTO } from './types';
import styles from './OrgMembersPage.module.css';

const ROLE_LABEL: Record<GlobalRole, string> = {
  ADMIN: 'Administrador',
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
};

export function OrgMembersPage() {
  const { user: currentUser } = useAuth();
  const { data: org } = useOrg();
  const { data: members, isLoading, error } = useOrgMembers(org?.id);

  const [pendingDelete, setPendingDelete] = useState<MemberDTO | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [accessTarget, setAccessTarget] = useState<MemberAccessTarget | null>(null);
  const [deactivatedOverride, setDeactivatedOverride] = useState<Record<string, string | null>>({});
  const [accountFilter, setAccountFilter] = useState<'' | 'active' | 'deactivated'>('');

  if (!org) {
    return null;
  }

  const isDeactivated = (m: MemberDTO) =>
    Boolean(m.id in deactivatedOverride ? deactivatedOverride[m.id] : m.deactivatedAt);
  const visibleMembers = members?.filter(
    (m) => !deletedIds.includes(m.id)
      && (accountFilter === '' || (accountFilter === 'deactivated') === isDeactivated(m)),
  );

  const isSelf = (id: string) => currentUser?.userId === id;

  return (
    <div className={styles.page}>
      <Link to="/org" className={styles.backLink}>
        <ArrowLeft size={16} /> Volver a organización
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Miembros</h1>
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{MEMBER_ACCESS_COPY.hint}</p>
      <div style={{ maxWidth: 240, marginBottom: 12 }}>
        <Select
          label="Cuenta"
          value={accountFilter}
          onChange={(event) => setAccountFilter(event.target.value as '' | 'active' | 'deactivated')}
          options={[
            { value: '', label: 'Todas' },
            { value: 'active', label: 'Activas' },
            { value: 'deactivated', label: 'Desactivadas' },
          ]}
        />
      </div>

      {error && (
        <div className={styles.banner} role="alert">
          No se pudieron cargar los miembros.
        </div>
      )}

      {isLoading && (
        <div className={styles.loadingWrap}>
          <Spinner size="lg" label="Cargando miembros..." />
        </div>
      )}

      {!isLoading && !error && visibleMembers && visibleMembers.length === 0 && (
        <div className={styles.center}>
          Esta organización no tiene miembros.
        </div>
      )}

      {!isLoading && !error && visibleMembers && visibleMembers.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Nombre</th>
              <th className={`${styles.th} ${styles.emailHeader}`}>
                Correo electrónico
              </th>
              <th className={styles.th}>Rol</th>
              <th className={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleMembers.map((m: MemberDTO) => (
              <tr key={m.id} className={styles.tr}>
                <td className={`${styles.td} ${styles.nameCell}`}>
                  <div className={styles.memberName}>
                    <Avatar src={m.avatarUrl} size="sm" />
                    <span>{m.name}</span>
                  </div>
                </td>
                <td className={`${styles.td} ${styles.emailCell}`}>
                  {m.email}
                </td>
                <td className={styles.td}>
                  <span className={styles.roleBadge}>
                    {ROLE_LABEL[m.role]}
                  </span>
                  {isDeactivated(m) && <> <Badge variant="neutral">Desactivada</Badge></>}
                </td>
                <td className={styles.td}>
                  {isSelf(m.id) ? (
                    <span
                      style={{
                        color: 'var(--color-text-muted)',
                        fontSize: 13,
                      }}
                    >
                      —
                    </span>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {isDeactivated(m) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAccessTarget({ id: m.id, name: m.name, email: m.email, action: 'reactivate' })}
                        >
                          {MEMBER_ACCESS_COPY.reactivate}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAccessTarget({ id: m.id, name: m.name, email: m.email, action: 'deactivate' })}
                          aria-label={`${MEMBER_ACCESS_COPY.deactivate}: ${m.name}`}
                        >
                          Quitar
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setPendingDelete(m)}
                        aria-label={`${DELETE_USER_COPY.action} de ${m.name}`}
                      >
                        {DELETE_USER_COPY.action}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <MemberAccessDialog
        organizationId={org.id}
        target={accessTarget}
        onCancel={() => setAccessTarget(null)}
        onDone={(id, deactivatedAt) => {
          setDeactivatedOverride((prev) => ({ ...prev, [id]: deactivatedAt }));
          setAccessTarget(null);
        }}
      />

      <DeleteUserDialog
        target={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onDeleted={(id) => {
          setDeletedIds((prev) => [...prev, id]);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
