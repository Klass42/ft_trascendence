import { useParams, useNavigate } from 'react-router-dom';
import { getCourse, getCourseProgress } from '@/lib/mock-data';

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const course = getCourse(courseId || '');

  if (!course) {
    return (
      <div style={{ padding: '40px', color: 'var(--color-text-secondary)' }}>
        Curso no encontrado
      </div>
    );
  }

  const pct = getCourseProgress(course);

  return (
    <div>
      <div style={{ padding: '26px 40px', background: course.color, color: '#fff' }}>
        <button
          onClick={() => navigate('/courses')}
          style={{
            background: 'rgba(255,255,255,.18)',
            border: 'none',
            color: '#fff',
            fontSize: 12.5,
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginBottom: 12,
          }}
        >
          ← Mis cursos
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
          {course.title}
        </h1>
        <div style={{ display: 'flex', gap: 16, fontSize: 14, opacity: 0.92, marginTop: 6 }}>
          <span>{course.teacher}</span>
          <span>·</span>
          <span>Progreso {pct}%</span>
        </div>
        <div
          style={{
            height: 7,
            borderRadius: 6,
            background: 'rgba(255,255,255,.28)',
            marginTop: 14,
            maxWidth: 340,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: '#fff',
            }}
          />
        </div>
      </div>

      <div style={{ padding: '26px 40px', maxWidth: 820 }}>
        {course.sections.map((sec) => (
          <div key={sec.title}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '.05em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                margin: '0 0 8px',
              }}
            >
              {sec.title}
            </div>
            <div
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 13,
                overflow: 'hidden',
                marginBottom: 18,
              }}
            >
              {sec.lessons.map((l) => {
                const isPlay = !l.done;
                return (
                  <div
                    key={l.id}
                    onClick={() => navigate(`/courses/${course.id}/lessons/${l.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 13,
                      padding: '13px 16px',
                      borderBottom: '1px solid var(--color-border-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {l.done ? (
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: '#0f766e',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: 'none',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
                      </span>
                    ) : isPlay ? (
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'var(--color-accent-primary)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: 'none',
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      </span>
                    ) : (
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          border: '2px solid var(--color-border-secondary)',
                          flex: 'none',
                        }}
                      />
                    )}
                    <span style={{ flex: 1, fontSize: 14.5, fontWeight: l.done ? 500 : 600, color: l.done ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
                      {l.title}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {l.min} min
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}