import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/api';
import { courses, submissions, users, getCourseProgress } from '@/lib/mock-data';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStudent = user?.role === 'STUDENT';
  const isTeacher = user?.role === 'TEACHER';
  const isAdmin = user?.role === 'ADMIN';

  const roleLabel = isStudent ? 'Alumno' : isTeacher ? 'Profesor' : 'Admin';
  const greeting = isStudent ? 'Hola de nuevo' : isTeacher ? 'Hola,' : 'Panel de administración';
  const userName = user?.name?.split(' ')[0] || '';

  const today = new Date();
  const dateStr = today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ padding: '30px 40px', maxWidth: 1120 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'capitalize' }}>
            {dateStr}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '3px 0 0', letterSpacing: '-0.02em' }}>
            {greeting}{isStudent ? `, ${userName}` : ''}
          </h1>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-accent-hover)',
            background: 'var(--color-accent-muted)',
            padding: '6px 13px',
            borderRadius: 20,
          }}
        >
          {roleLabel}
        </span>
      </div>

      {/* ============ STUDENT ============ */}
      {isStudent && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, gridAutoRows: 134 }}>
            {/* Progress ring */}
            <div
              style={{
                gridColumn: '1/3',
                gridRow: '1/3',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 18,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Progreso del semestre
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ position: 'relative', width: 128, height: 128, flex: 'none' }}>
                  <svg width="128" height="128" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-border-primary)" strokeWidth="13" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-accent-primary)" strokeWidth="13" strokeLinecap="round" strokeDasharray="326.7" strokeDashoffset="104.5" transform="rotate(-90 60 60)" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 31, fontWeight: 700 }}>68%</span>
                  </div>
                </div>
                <div>
                  {courses.map((c) => {
                    const pct = getCourseProgress(c);
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flex: 'none' }} />
                        <span style={{ fontSize: 12.5, color: 'var(--color-text-primary)' }}>
                          {c.title} · {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Streak */}
            <div
              style={{
                gridColumn: '3/4',
                gridRow: '1/2',
                background: '#fef3e2',
                border: '1px solid #f7e3c6',
                borderRadius: 18,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#ea8f2b">
                <path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .3-2 .8-2.8C8 9 7 10.5 7 12.5a5 5 0 0 0 10 0c0-4.5-5-10.5-5-10.5z" />
              </svg>
              <div>
                <div style={{ fontSize: 30, fontWeight: 700, color: '#b45309', lineHeight: 1 }}>
                  12
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#a06a1e' }}>
                  días de racha
                </div>
              </div>
            </div>

            {/* Average */}
            <div
              style={{
                gridColumn: '4/5',
                gridRow: '1/2',
                background: '#e0f2ec',
                border: '1px solid #c4e6da',
                borderRadius: 18,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f766e' }}>PROMEDIO</span>
              <div style={{ fontSize: 30, fontWeight: 700, color: '#0f766e', lineHeight: 1 }}>
                8,7
              </div>
            </div>

            {/* Next assignment */}
            <div
              onClick={() => navigate('/assignments')}
              style={{
                gridColumn: '3/5',
                gridRow: '2/3',
                background: 'var(--color-accent-primary)',
                borderRadius: 18,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.82 }}>PRÓXIMA ENTREGA</span>
                <span style={{ fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.18)', padding: '3px 10px', borderRadius: 20 }}>
                  hoy 23:59
                </span>
              </div>
              <div>
                <div style={{ fontSize: 19, fontWeight: 700 }}>Wireframes app móvil</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>Diseño de Interfaces</div>
              </div>
            </div>

            {/* Course cards */}
            {courses.map((c) => {
              const pct = getCourseProgress(c);
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/courses/${c.id}`)}
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-primary)',
                    borderRadius: 18,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      background: c.tint,
                      color: c.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                    }}
                  >
                    {c.code}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.title}</div>
                    <div
                      style={{
                        height: 5,
                        borderRadius: 5,
                        background: 'var(--color-border-primary)',
                        marginTop: 6,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: c.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ============ TEACHER ============ */}
      {isTeacher && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 26 }}>
            <div
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Cursos activos
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{courses.length}</div>
            </div>
            <div
              style={{
                background: '#fef5f5',
                border: '1px solid #fde3e3',
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 13, color: '#c94747', fontWeight: 600 }}>
                Por calificar
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4, color: '#ef4444' }}>
                {submissions.length}
              </div>
            </div>
            <div
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Alumnos totales
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>142</div>
            </div>
          </div>

          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>
            Entregas por calificar
          </div>
          <div
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 13,
              overflow: 'hidden',
              maxWidth: 720,
            }}
          >
            {submissions.map((s) => (
              <div
                key={s.id}
                onClick={() => navigate('/assignments')}
                style={{
                  display: 'flex',
                  gap: 13,
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--color-border-primary)',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: 'var(--color-accent-muted)',
                    color: 'var(--color-accent-hover)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                    flex: 'none',
                  }}
                >
                  {s.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {s.student} · {s.course}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.when}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ============ ADMIN ============ */}
      {isAdmin && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 26 }}>
            {[
              { label: 'Usuarios', value: '1.284' },
              { label: 'Cursos', value: '96' },
              { label: 'Activos ahora', value: '417' },
              { label: 'Uptime', value: '99,9%', color: '#0f766e' },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 14,
                  padding: 18,
                }}
              >
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    marginTop: 4,
                    color: s.color || 'var(--color-text-primary)',
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>
            Usuarios recientes
          </div>
          <div
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 13,
              overflow: 'hidden',
              maxWidth: 720,
            }}
          >
            {users.map((u, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--color-border-primary)',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--color-accent-muted)',
                    color: 'var(--color-accent-hover)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                    flex: 'none',
                  }}
                >
                  {u.initials}
                </div>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{u.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  {u.role}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 56, textAlign: 'right' }}>
                  {u.joined}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}