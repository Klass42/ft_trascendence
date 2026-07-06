import { useAuth } from '@/lib/api';
import { assignments, submissions } from '@/lib/mock-data';

const chip: Record<string, { bg: string; fg: string; label: string }> = {
  pendiente: { bg: '#fff4e5', fg: '#b45309', label: 'Pendiente' },
  entregado: { bg: '#eff4ff', fg: '#1d4ed8', label: 'Entregado' },
  calificado: { bg: '#e7f6ef', fg: '#0f766e', label: 'Calificado' },
};

export function AssignmentsPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const isTeacher = user?.role === 'TEACHER';

  return (
    <div style={{ padding: '30px 40px', maxWidth: 820 }}>
      {isStudent && (
        <>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
            Mis tareas
          </h1>
          {assignments.map((a) => {
            const c = chip[a.status];
            return (
              <div
                key={a.id}
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 13,
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  marginBottom: 11,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{a.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {a.course} · vence {a.due}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: c.fg,
                    background: c.bg,
                    padding: '4px 11px',
                    borderRadius: 20,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.label}
                </span>
                {a.status === 'pendiente' && (
                  <button
                    style={{
                      background: 'var(--color-accent-primary)',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: 13.5,
                      padding: '9px 16px',
                      borderRadius: 9,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Entregar
                  </button>
                )}
                {a.status === 'calificado' && a.score && (
                  <span style={{ fontSize: 17, fontWeight: 800, color: '#0f766e' }}>
                    {a.score}
                  </span>
                )}
              </div>
            );
          })}
        </>
      )}

      {isTeacher && (
        <>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
            Por calificar
          </h1>
          {submissions.map((s) => (
            <div
              key={s.id}
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 13,
                padding: '15px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 11,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'var(--color-accent-muted)',
                  color: 'var(--color-accent-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 13,
                  flex: 'none',
                }}
              >
                {s.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {s.student} · {s.course} · {s.when}
                </div>
              </div>
              <button
                style={{
                  background: 'var(--color-accent-primary)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 13.5,
                  padding: '9px 16px',
                  borderRadius: 9,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Calificar
              </button>
            </div>
          ))}
        </>
      )}

      {!isStudent && !isTeacher && (
        <p style={{ color: 'var(--color-text-muted)' }}>No hay contenido disponible.</p>
      )}
    </div>
  );
}