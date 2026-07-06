import { useParams, useNavigate } from 'react-router-dom';
import { getCourse } from '@/lib/mock-data';

export function LessonPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const course = getCourse(courseId || '');

  let lesson = null;
  if (course) {
    for (const sec of course.sections) {
      const found = sec.lessons.find((l) => l.id === lessonId);
      if (found) {
        lesson = found;
        break;
      }
    }
  }

  if (!course || !lesson) {
    return (
      <div style={{ padding: '40px', color: 'var(--color-text-secondary)' }}>
        Lección no encontrada
      </div>
    );
  }

  return (
    <div style={{ padding: '26px 40px', maxWidth: 760 }}>
      <button
        onClick={() => navigate(`/courses/${course.id}`)}
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-secondary)',
          color: 'var(--color-text-secondary)',
          fontSize: 12.5,
          fontWeight: 600,
          padding: '7px 13px',
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: 18,
        }}
      >
        ← {course.title}
      </button>

      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
        {lesson.title}
      </h1>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
        {lesson.min} min · {course.title}
      </div>

      <div
        style={{
          width: '100%',
          height: 190,
          borderRadius: 14,
          background: 'linear-gradient(120deg,#1e293b,#334155)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 22,
        }}
      >
        <svg width="52" height="52" viewBox="0 0 24 24" fill="#fff">
          <circle cx="12" cy="12" r="11" fill="rgba(255,255,255,.14)" />
          <path d="M10 8v8l6-4z" fill="#fff" />
        </svg>
      </div>

      <p style={{ fontSize: 15.5, lineHeight: 1.75, color: '#334155', margin: '0 0 14px' }}>
        El ritmo vertical es la repetición de un espaciado base que da coherencia a toda la interfaz. Definimos una unidad —normalmente 4 u 8 px— y construimos márgenes, paddings y alturas de línea como múltiplos de ella.
      </p>
      <p style={{ fontSize: 15.5, lineHeight: 1.75, color: '#334155', margin: '0 0 26px' }}>
        Cuando los elementos comparten esta cuadrícula invisible, el ojo percibe orden aunque no sepa por qué. Agrupa por proximidad, respeta la escala tipográfica y no rompas la unidad salvo con intención.
      </p>

      {lesson.done ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            background: 'var(--color-success-muted)',
            color: 'var(--color-success)',
            fontWeight: 700,
            fontSize: 14,
            padding: '11px 18px',
            borderRadius: 10,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
          Lección completada
        </div>
      ) : (
        <button
          style={{
            background: 'var(--color-accent-primary)',
            border: 'none',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14.5,
            padding: '12px 22px',
            borderRadius: 10,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Marcar como completada
        </button>
      )}
    </div>
  );
}