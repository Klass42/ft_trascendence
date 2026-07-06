import { useNavigate } from 'react-router-dom';
import { courses, getCourseProgress } from '@/lib/mock-data';

export function CoursesPage() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '30px 40px', maxWidth: 1000 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
        Mis cursos
      </h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
        }}
      >
        {courses.map((c) => {
          const pct = getCourseProgress(c);
          return (
            <div
              key={c.id}
              onClick={() => navigate(`/courses/${c.id}`)}
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 15,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  height: 70,
                  background: c.color,
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: '12px 16px',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,.9)', fontWeight: 800, fontSize: 13, letterSpacing: '.05em' }}>
                  {c.code}
                </span>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{c.title}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {c.teacher}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 6,
                      background: 'var(--color-border-primary)',
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
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    {pct}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}