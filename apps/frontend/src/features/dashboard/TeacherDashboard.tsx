/**
 * TeacherDashboard — OWNER: David (Plan 2, A4-teacher).
 * TODO(David): de-mock — "Por calificar" y "Alumnos totales" (142) y la lista de
 * entregas vienen de mock-data. Sustituir por entregas SUBMITTED/LATE sin nota de
 * los cursos del profesor + cifras reales de enrollments.
 */
import { useNavigate } from 'react-router-dom';
import { useAuth, useCourses } from '@/lib/api';
import { submissions } from '@/lib/mock-data';
import { DashboardHeader } from './DashboardHeader';

export function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: courses } = useCourses('PUBLISHED');
  const userName = user?.name?.split(' ')[0] || '';

  return (
    <>
      <DashboardHeader title={`Hola, ${userName}`} roleLabel="Profesor" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 26 }}>
        <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>Cursos activos</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{courses?.length ?? 0}</div>
        </div>
        <div style={{ background: '#fef5f5', border: '1px solid #fde3e3', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 13, color: '#c94747', fontWeight: 600 }}>Por calificar</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4, color: '#ef4444' }}>{submissions.length}</div>
        </div>
        <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>Alumnos totales</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>142</div>
        </div>
      </div>

      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Entregas por calificar</div>
      <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)', borderRadius: 13, overflow: 'hidden', maxWidth: 720 }}>
        {submissions.map((s) => (
          <div key={s.id} onClick={() => navigate('/assignments')} style={{ display: 'flex', gap: 13, alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--color-border-primary)', cursor: 'pointer' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flex: 'none' }}>
              {s.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.student} · {s.course}</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.when}</span>
          </div>
        ))}
      </div>
    </>
  );
}
