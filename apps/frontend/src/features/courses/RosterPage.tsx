import { useState, useMemo, useEffect } from 'react';
import {
  Button,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  useToast,
} from '@/components/ui';
import { useAuth, useEnrollments, useUsersByIds, apiClient } from '@/lib/api';
import type { RosterRow, RosterUserDTO } from './types';
import styles from './RosterPage.module.css';

// ─── Main Component ────────────────────────────────────────────────────────

export function RosterPage({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: enrollments, isLoading: enrollLoading, error: enrollError, refetch } = useEnrollments(courseId);

  // Extract userIds from enrollments → batch fetch user display data
  const userIds = useMemo(
    () => (enrollments ?? []).map((e) => e.userId),
    [enrollments],
  );
  const { data: users, isLoading: usersLoading } = useUsersByIds(userIds);

  // Merge enrollments + users into RosterRow[]
  const rows: RosterRow[] = useMemo(() => {
    if (!enrollments || !users) return [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return enrollments
      .filter((e) => e.role !== 'TEACHER') // Don't show the teacher in their own roster
      .map((e) => {
        const u = userMap.get(e.userId);
        return {
          enrollmentId: e.id,
          userId: e.userId,
          name: u?.name ?? e.userId,
          email: u?.email ?? '',
          avatarUrl: u?.avatarUrl ?? null,
          role: e.role,
          progress: e.progress ?? 0,
        };
      });
  }, [enrollments, users]);

  // ── Role change ──
  const [changingRole, setChangingRole] = useState<string | null>(null);

  const handleRoleChange = async (enrollmentId: string, newRole: string) => {
    if (!user) return;
    setChangingRole(enrollmentId);
    try {
      await apiClient.patch(`/enrollments/${enrollmentId}/role?organizationId=${user.organizationId}`, { role: newRole });
      toast({ variant: 'success', message: 'Rol actualizado' });
      refetch();
    } catch {
      toast({ variant: 'error', message: 'No se pudo cambiar el rol' });
    } finally {
      setChangingRole(null);
    }
  };

  // ── Expel (double-press 5s) ──
  const [confirmingExpel, setConfirmingExpel] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmingExpel) return;
    const timer = setTimeout(() => setConfirmingExpel(null), 5000);
    return () => clearTimeout(timer);
  }, [confirmingExpel]);

  const handleExpel = async (row: RosterRow) => {
    if (confirmingExpel !== row.userId) {
      setConfirmingExpel(row.userId);
      return;
    }
    // Second press — actually expel
    if (!user) return;
    try {
      await apiClient.delete(
        `/courses/${courseId}/enroll?organizationId=${user.organizationId}&userId=${row.userId}`,
      );
      toast({ variant: 'success', message: `${row.name} expulsado del curso` });
      setConfirmingExpel(null);
      refetch();
    } catch {
      toast({ variant: 'error', message: 'No se pudo expulsar al alumno' });
    }
  };

  // ── Add student modal ──
  const [addOpen, setAddOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<RosterUserDTO | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string>();
  const [enrolling, setEnrolling] = useState(false);

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setLookupLoading(true);
    setLookupError(undefined);
    setLookupResult(null);
    try {
      const result = await apiClient.get<{ userId: string; name: string; email: string; avatarUrl: string | null }>(
        `/users/lookup?email=${encodeURIComponent(searchEmail.trim())}`,
      );
      setLookupResult({ id: result.userId, name: result.name, email: result.email, avatarUrl: result.avatarUrl });
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e.status === 404) {
        setLookupError('No se encontró un usuario con ese email');
      } else if (e.status === 403) {
        setLookupError('No tienes permisos para añadir a este usuario');
      } else {
        setLookupError('Error al buscar');
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const handleEnrollUser = async () => {
    if (!lookupResult || !user) return;
    setEnrolling(true);
    try {
      await apiClient.post(
        `/courses/${courseId}/enroll?organizationId=${user.organizationId}&userId=${lookupResult.id}`,
        {},
      );
      toast({ variant: 'success', message: `${lookupResult.name} añadido al curso` });
      setAddOpen(false);
      setSearchEmail('');
      setLookupResult(null);
      refetch();
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e.status === 409) {
        toast({ variant: 'warning', message: 'Ya está inscrito en el curso' });
      } else {
        toast({ variant: 'error', message: 'No se pudo inscribir al alumno' });
      }
    } finally {
      setEnrolling(false);
    }
  };

  const closeModal = () => {
    setAddOpen(false);
    setSearchEmail('');
    setLookupResult(null);
    setLookupError(undefined);
  };

  // ── Render ──

  if (enrollLoading || usersLoading) {
    return <div className={styles.loading}><Spinner /></div>;
  }

  if (enrollError) {
    return (
      <div className={styles.container}>
        <EmptyState
          title="Error al cargar el roster"
          description="No se pudieron cargar las inscripciones."
          action={<Button onClick={refetch}>Reintentar</Button>}
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Alumnos inscritos ({rows.length})</span>
        <Button onClick={() => setAddOpen(true)}>Añadir alumno</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No hay alumnos inscritos"
          description="Añade alumnos por email para empezar."
          action={<Button onClick={() => setAddOpen(true)}>Añadir alumno</Button>}
        />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Progreso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const initials = row.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <tr key={row.enrollmentId}>
                  <td>
                    <div className={styles.userCell}>
                      <div className={styles.avatar}>
                        {row.avatarUrl ? <img src={row.avatarUrl} alt="" /> : initials}
                      </div>
                      <span>{row.name}</span>
                    </div>
                  </td>
                  <td>{row.email}</td>
                  <td>
                    <Select
                      value={row.role}
                      onChange={(e) => handleRoleChange(row.enrollmentId, e.target.value)}
                      disabled={changingRole === row.enrollmentId}
                      options={[
                        { value: 'STUDENT', label: 'Alumno' },
                        { value: 'ASSISTANT', label: 'Asistente' },
                      ]}
                      fullWidth={false}
                      className={styles.roleSelect}
                    />
                  </td>
                  <td>
                    <span className={styles.progress}>{row.progress} %</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`${styles.expelBtn} ${confirmingExpel === row.userId ? styles.confirming : ''}`}
                      onClick={() => handleExpel(row)}
                    >
                      {confirmingExpel === row.userId ? 'Confirmar expulsión' : 'Expulsar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ── Add student Modal ── */}
      <Modal open={addOpen} onClose={closeModal} title="Añadir alumno al curso">
        <div>
          <Input
            label="Email del alumno"
            type="email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            error={lookupError}
            hint="Escribe el email del alumno que quieres añadir"
          />
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button
              onClick={handleSearch}
              loading={lookupLoading}
              disabled={!searchEmail.trim()}
              variant="secondary"
            >
              Buscar
            </Button>
          </div>
        </div>

        {lookupResult && (
          <div className={styles.searchResult}>
            <div className={styles.avatar}>
              {lookupResult.avatarUrl
                ? <img src={lookupResult.avatarUrl} alt="" />
                : lookupResult.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              }
            </div>
            <div>
              <div className={styles.searchName}>{lookupResult.name}</div>
              <div className={styles.searchEmail}>{lookupResult.email}</div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <Button onClick={handleEnrollUser} loading={enrolling}>
                Añadir al curso
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
