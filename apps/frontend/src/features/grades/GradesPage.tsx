import { useAuth } from '@/lib/api';
import { grades, users } from '@/lib/mock-data';

export function GradesPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const isTeacher = user?.role === 'TEACHER';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div style={{ padding: '30px 40px', maxWidth: 820 }}>
      {isStudent && (
        <>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
            Mis notas
          </h1>
          <div
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 13,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1fr .5fr',
                gap: 8,
                padding: '12px 18px',
                background: 'var(--color-bg-primary)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '.04em',
              }}
            >
              <span>Curso</span>
              <span>Evaluación</span>
              <span style={{ textAlign: 'right' }}>Nota</span>
            </div>
            {grades.map((g, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr .5fr',
                  gap: 8,
                  padding: '14px 18px',
                  borderTop: '1px solid var(--color-border-primary)',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>{g.course}</span>
                <span style={{ fontSize: 13.5, color: 'var(--color-text-secondary)' }}>
                  {g.item}
                </span>
                <span
                  style={{
                    textAlign: 'right',
                    fontSize: 16,
                    fontWeight: 800,
                    color: g.color,
                  }}
                >
                  {g.score}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {isTeacher && (
        <>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
            Analíticas del curso
          </h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
            {[
              { label: 'Nota media', value: '7,9' },
              { label: 'Tasa de entrega', value: '86%' },
              { label: 'Participación foro', value: '64%' },
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
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 14,
              padding: '20px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: 14,
              height: 180,
            }}
          >
            {[55, 72, 60, 88, 70].map((h, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: '100%',
                    height: `${h}%`,
                    background: i === 3 ? 'var(--color-accent-primary)' : 'var(--color-accent-muted)',
                    borderRadius: '6px 6px 0 0',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Sem {i + 1}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {isAdmin && (
        <>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
            Usuarios
          </h1>
          <div
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 13,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.8fr 1fr .7fr',
                gap: 8,
                padding: '12px 18px',
                background: 'var(--color-bg-primary)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '.04em',
              }}
            >
              <span>Nombre</span>
              <span>Rol</span>
              <span style={{ textAlign: 'right' }}>Alta</span>
            </div>
            {users.map((u, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.8fr 1fr .7fr',
                  gap: 8,
                  padding: '12px 18px',
                  borderTop: '1px solid var(--color-border-primary)',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: 'var(--color-accent-muted)',
                      color: 'var(--color-accent-hover)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {u.initials}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{u.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  {u.role}
                </span>
                <span style={{ textAlign: 'right', fontSize: 13, color: 'var(--color-text-muted)' }}>
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