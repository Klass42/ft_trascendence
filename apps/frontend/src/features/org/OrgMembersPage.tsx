import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiClient, useAuth } from '@/lib/api';
import { ApiError } from '@/lib/api/types';
import { Button, Spinner } from '@/components/ui';
import { useOrg, useOrgMembers } from '@/lib/api/hooks';
import type { GlobalRole } from '@/lib/api/types';
import type { MemberDTO } from './types';
import styles from './OrgMembersPage.module.css';

const ROLE_LABEL: Record<GlobalRole, string> = {
  ADMIN: 'Admin',
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
};

export function OrgMembersPage() {
  const { user: currentUser } = useAuth();
  const { data: org } = useOrg();
  const { data: members, isLoading, error } = useOrgMembers(org?.id);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const startDelete = useCallback((memberId: string) => {
    setDeletingId(memberId);
    setBannerError(null);
    timerRef.current = setTimeout(() => {
      setDeletingId(null);
      timerRef.current = null;
    }, 5000);
  }, []);

  const confirmDelete = useCallback(
    async (memberId: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setDeletingId(null);
      try {
        await apiClient.delete(
          `/organizations/${org!.id}/members/${memberId}`,
        );
        setDeletedIds((prev) => [...prev, memberId]);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : 'No se pudo conectar con el servidor.';
        setBannerError(msg);
      }
    },
    [org],
  );

  const cancelDelete = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setDeletingId(null);
  }, []);

  if (!org) {
    return null;
  }

  const visibleMembers = members?.filter(
    (m) => !deletedIds.includes(m.id),
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

      {bannerError && (
        <div className={styles.banner} role="alert">
          {bannerError}
        </div>
      )}

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
                Email
              </th>
              <th className={styles.th}>Rol</th>
              <th className={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleMembers.map((m: MemberDTO) => (
              <tr key={m.id} className={styles.tr}>
                <td className={`${styles.td} ${styles.nameCell}`}>
                  {m.name}
                </td>
                <td className={`${styles.td} ${styles.emailCell}`}>
                  {m.email}
                </td>
                <td className={styles.td}>
                  <span className={styles.roleBadge}>
                    {ROLE_LABEL[m.role]}
                  </span>
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
                  ) : deletingId === m.id ? (
                    <div className={styles.dangerActions}>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => confirmDelete(m.id)}
                      >
                        Confirmar eliminación
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelDelete}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startDelete(m.id)}
                    >
                      Eliminar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
