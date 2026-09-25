import { useMemo } from 'react';
import { EmptyState, Spinner } from '@/components/ui';
import { useEnrollments, useUsersByIds } from '@/lib/api';

/** Read-only roster: students of the parent cohort. Teachers cannot add members. */
export function RosterPage({ courseId }: { courseId: string }) {
  const { data: enrollments, isLoading: enrollLoading, error: enrollError } = useEnrollments(courseId);
  const userIds = useMemo(() => (enrollments ?? []).map((enrollment) => enrollment.userId), [enrollments]);
  const { data: users, isLoading: usersLoading } = useUsersByIds(userIds);

  const rows = useMemo(() => {
    if (!enrollments || !users) return [];
    const userMap = new Map(users.map((user) => [user.id, user]));
    return enrollments.map((enrollment) => {
      const user = userMap.get(enrollment.userId);
      return {
        id: enrollment.id,
        name: user?.name ?? enrollment.userId,
        email: user?.email ?? '',
        progress: enrollment.progress ?? 0,
      };
    });
  }, [enrollments, users]);

  if (enrollLoading || usersLoading) return <Spinner label="Cargando alumnos" />;
  if (enrollError) return <EmptyState title="No se pudo cargar el listado" description={enrollError.message} />;
  if (rows.length === 0) return <EmptyState title="Sin alumnos" description="Nadie está matriculado en este curso." />;

  return (
    <div style={{ padding: '8px 0' }}>
      {rows.map((row) => (
        <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--color-border-primary)' }}>
          <div>
            <div style={{ fontWeight: 700 }}>{row.name}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{row.email}</div>
          </div>
          <div style={{ fontSize: 13 }}>{row.progress}%</div>
        </div>
      ))}
    </div>
  );
}
