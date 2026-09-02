import { useNavigate } from 'react-router-dom';
import { UserPlus, Pencil } from 'lucide-react';
import { useUsers } from '@/lib/api/hooks';
import { Button, Spinner } from '@/components/ui';
import type { GlobalRole } from '@/lib/api/types';
import type { UserDTO } from './types';
import styles from './AdminUsersPage.module.css';

const ROLE_LABEL: Record<GlobalRole, string> = {
  ADMIN: 'Admin',
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
};

export function AdminUsersPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useUsers();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Usuarios</h1>
        <Button
          variant="primary"
          leftIcon={<UserPlus size={18} />}
          onClick={() => navigate('/admin/users/invite')}
        >
          Invitar usuario
        </Button>
      </div>

      {error && (
        <div className={styles.banner} role="alert">
          No se pudieron cargar los usuarios.
        </div>
      )}

      {isLoading && (
        <div className={styles.loadingWrap}>
          <Spinner size="lg" label="Cargando usuarios..." />
        </div>
      )}

      {!isLoading && !error && data && data.length === 0 && (
        <div className={styles.center}>Aún no hay usuarios.</div>
      )}

      {!isLoading && !error && data && data.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Nombre</th>
              <th className={`${styles.th} ${styles.emailHeader}`}>Email</th>
              <th className={styles.th}>Rol</th>
              <th className={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map((u: UserDTO) => (
              <tr key={u.id} className={styles.tr}>
                <td className={`${styles.td} ${styles.nameCell}`}>{u.name}</td>
                <td className={`${styles.td} ${styles.emailCell}`}>{u.email}</td>
                <td className={styles.td}>
                  <span className={styles.roleBadge}>{ROLE_LABEL[u.role]}</span>
                </td>
                <td className={styles.td}>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Pencil size={14} />}
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                  >
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
