import { useUsers, useMySubjects } from '@/lib/api';
import { Spinner, EmptyState } from '@/components/ui';
import { ProtectedAvatar } from '@/components/ui/ProtectedAvatar';
import { DashboardHeader } from './DashboardHeader';
import styles from './AdminDashboard.module.css';

export function AdminDashboard() {
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: courses, isLoading: coursesLoading } = useMySubjects();

  if (usersLoading || coursesLoading) {
    return (
      <>
        <DashboardHeader title="Panel de administración" roleLabel="Admin" />
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
          <Spinner />
        </div>
      </>
    );
  }

  const userCount = users?.length ?? 0;
  const courseCount = courses?.length ?? 0;
  const recentUsers = [...(users ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return (
    <>
      <DashboardHeader title="Panel de administración" roleLabel="Admin" />

      <div className={styles.kpis}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Usuarios</div>
          <div className={styles.kpiValue}>{userCount}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Cursos</div>
          <div className={styles.kpiValue}>{courseCount}</div>
        </div>
      </div>

      <div className={styles.sectionTitle}>Usuarios recientes</div>

      {recentUsers.length === 0 ? (
        <EmptyState title="Sin usuarios" description="No hay usuarios registrados aún." />
      ) : (
        <div className={styles.table}>
          {recentUsers.map((u) => {
            const initials = u.name
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);
            const roleLabel = u.role === 'ADMIN' ? 'Admin' : u.role === 'TEACHER' ? 'Profesor' : 'Alumno';
            const joined = new Date(u.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

            return (
              <div key={u.id} className={styles.row}>
                <div className={styles.avatar}>
                  <ProtectedAvatar url={u.avatarUrl} fallback={initials} />
                </div>
                <span className={styles.name}>{u.name}</span>
                <span className={styles.role}>{roleLabel}</span>
                <span className={styles.date}>{joined}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
