/**
 * DashboardPage — role dispatcher.
 * Each role's dashboard is a self-contained component owned by a different dev
 * (see D0 split): Student → Aloiki, Teacher → David, Admin → Jorge. Keep this
 * file a thin switch so nobody edits someone else's dashboard.
 */
import { useAuth } from '@/lib/api';
import { StudentDashboard } from './StudentDashboard';
import { TeacherDashboard } from './TeacherDashboard';
import { AdminDashboard } from './AdminDashboard';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div style={{ padding: '30px 40px', maxWidth: 1120 }}>
      {user?.role === 'ADMIN' ? (
        <AdminDashboard />
      ) : user?.role === 'TEACHER' ? (
        <TeacherDashboard />
      ) : (
        <StudentDashboard />
      )}
    </div>
  );
}
