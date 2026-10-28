import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient, useUsers } from '@/lib/api';
import { Avatar, Spinner, EmptyState } from '@/components/ui';
import { formatDate, plural } from '@/lib/format';
import { DashboardHeader } from './DashboardHeader';
import styles from './AdminDashboard.module.css';

interface OrgStats {
  users: number;
  roles: { ADMIN: number; TEACHER: number; STUDENT: number };
  pendingInvitations: number;
  courses: number;
  activeCourses: number;
  subjects: number;
}

export function AdminDashboard() {
  const { data: users, isLoading: usersLoading } = useUsers();
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<OrgStats>('/organizations/me/stats')
      .then((value) => { if (!cancelled) setStats(value); })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setStatsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (usersLoading || statsLoading) {
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
  const recentUsers = [...(users ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return (
    <>
      <DashboardHeader title="Panel de administración" roleLabel="Administrador" />

      <div className={styles.kpis}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Usuarios</div>
          <div className={styles.kpiValue}>{stats?.users ?? userCount}</div>
          {stats && <div className={styles.kpiHint}>{plural(stats.roles.STUDENT, 'alumno', 'alumnos')} · {plural(stats.roles.TEACHER, 'profesor', 'profesores')} · {plural(stats.roles.ADMIN, 'administrador', 'administradores')}</div>}
        </div>
        {stats && (
          <>
            <Link to="/admin/users/invitations" className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Invitaciones pendientes</div>
              <div className={styles.kpiValue}>{stats.pendingInvitations}</div>
            </Link>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Cursos</div>
              <div className={styles.kpiValue}>{stats.courses}</div>
              <div className={styles.kpiHint}>{stats.activeCourses} en curso</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Asignaturas</div>
              <div className={styles.kpiValue}>{stats.subjects}</div>
            </div>
          </>
        )}
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
