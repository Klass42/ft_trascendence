import { useNavigate } from 'react-router-dom';
import { useCourses } from '@/lib/api/hooks';

const COURSE_COLORS = [
  '#2563eb', '#0f766e', '#d97706', '#7c3aed',
  '#dc2626', '#0891b2', '#4f46e5', '#db2777',
];

function hashToColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length];
}

export function CoursesPage() {
  const navigate = useNavigate();
  const { data: courses, isLoading, error } = useCourses('PUBLISHED');

  if (isLoading) {
    return (
      <div style={{ padding: '30px 40px', color: 'var(--color-text-secondary)' }}>
        Cargando cursos...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '30px 40px', color: 'var(--color-text-secondary)' }}>
        Error al cargar cursos: {error.message}
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div style={{ padding: '30px 40px', color: 'var(--color-text-secondary)' }}>
        No hay cursos disponibles
      </div>
    );
  }

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
          const color = hashToColor(c.title);
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
                  background: color,
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: '12px 16px',
                }}
              />
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{c.title}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
