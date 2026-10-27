import { useUsers, useMySubjects } from '@/lib/api';
import { Avatar, Spinner, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { DashboardHeader } from './DashboardHeader';
import styles from './AdminDashboard.module.css';

export function AdminDashboard() {
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: courses, isLoading: coursesLoading } = useMySubjects();

  if (usersLoading || coursesLoading) {
    return (
      <>
        <DashboardHeader title="Panel de administración" roleLabel="Administrador" />
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
      <DashboardHeader title="Panel de administración" roleLabel="Administrador" />

      <div className={styles.kpis}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Usuarios</div>
          <div className={styles.kpiValue}>{userCount}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Asignaturas</div>
          <div className={styles.kpiValue}>{courseCount}</div>
        </div>
      </div>

      <div className={styles.sectionTitle}>Usuarios recientes</div>

      {recentUsers.length === 0 ? (
        <EmptyState title="Sin usuarios" description="No hay usuarios registrados aún." />
      ) : (
        <div className={styles.table}>
          {recentUsers.map((u) => {
            const roleLabel = u.role === 'ADMIN' ? 'Administrador' : u.role === 'TEACHER' ? 'Profesor' : 'Alumno';
            const joined = formatDate(u.createdAt);

            return (
              <div key={u.id} className={styles.row}>
                <Avatar src={u.avatarUrl} size="sm" />
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
