import { useMemo } from 'react';
import { Avatar, EmptyState, Spinner } from '@/components/ui';
import { useEnrollments, useUsersByIds } from '@/lib/api';
import styles from './RosterPage.module.css';

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
        avatarUrl: user?.avatarUrl ?? null,
        progress: enrollment.progress ?? 0,
      };
    });
  }, [enrollments, users]);

  if (enrollLoading || usersLoading) return <Spinner label="Cargando alumnos" />;
  if (enrollError) return <EmptyState title="No se pudo cargar el listado" description={enrollError.message} />;
  if (rows.length === 0) return <EmptyState title="Sin alumnos" description="Nadie está matriculado en este curso." />;

  return (
    <div className={styles.roster}>
      {rows.map((row) => (
        <div key={row.id} className={styles.rosterRow}>
          <div className={styles.userCell}>
            <Avatar src={row.avatarUrl} size="sm" />
            <div className={styles.userDetails}>
              <div className={styles.name}>{row.name}</div>
              <div className={styles.email}>{row.email}</div>
            </div>
          </div>
          <div className={styles.progressValue}>{row.progress}%</div>
        </div>
      ))}
    </div>
  );
}
