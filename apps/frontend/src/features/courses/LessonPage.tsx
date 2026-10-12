import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCourseDetail, useLessonById, useCompletedLessons, useCompleteLesson } from '@/lib/api';

export function LessonPage() {
  const { courseId, subjectId, lessonId } = useParams<{ courseId: string; subjectId: string; lessonId: string }>();
  const navigate = useNavigate();

  const { data: course } = useCourseDetail(subjectId);
  const { data: lesson, isLoading: lessonLoading, error: lessonErr } = useLessonById(lessonId);
  const { data: completedLessons } = useCompletedLessons(subjectId);
  const { completeLesson, isLoading: completing } = useCompleteLesson();

  const [isDone, setIsDone] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  useEffect(() => {
    if (completedLessons && lessonId) {
      setIsDone(completedLessons.includes(lessonId));
    }
  }, [completedLessons, lessonId]);

  const handleComplete = async () => {
    if (!lessonId) return;
    setCompleteError(null);
    try {
      await completeLesson(lessonId);
      setIsDone(true);
    } catch {
      setCompleteError('Error al marcar la lección como completada');
    }
  };

  if (lessonLoading) {
    return (
      <div style={{ padding: '40px', color: 'var(--color-text-secondary)' }}>
        Cargando lección...
      </div>
    );
  }

  if (lessonErr || !lesson) {
    return (
      <div style={{ padding: '40px', color: 'var(--color-text-secondary)' }}>
        Lección no encontrada
      </div>
    );
  }

  const pct = completedLessons && lessonId ? (isDone ? 100 : 0) : 0;

  return (
    <div style={{ padding: '26px 40px', maxWidth: 760 }}>
      <button
        onClick={() => navigate(`/courses/${courseId}/subjects/${subjectId}`)}
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
        ← {course?.title || 'Curso'}
      </button>

      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
        {lesson.title}
      </h1>
      {course && (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
          {course.title} · Progreso {pct}%
        </div>
      )}

      {lesson.videoUrl && (
        <div style={{ marginBottom: 22 }}>
          <video
            src={lesson.videoUrl}
            controls
            style={{
              width: '100%',
              maxHeight: 400,
              borderRadius: 14,
              background: '#1e293b',
            }}
          />
        </div>
      )}

      {lesson.contentMd && (
        <div style={{ fontSize: 15.5, lineHeight: 1.75, color: '#334155', marginBottom: 26 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {lesson.contentMd}
          </ReactMarkdown>
        </div>
      )}

      {lesson.attachments && lesson.attachments.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Adjuntos
          </div>
          {lesson.attachments.map((a) => (
            <div
              key={a.fileId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 10,
                marginBottom: 6,
                fontSize: 14,
                color: 'var(--color-text-secondary)',
              }}
            >
              <span>📎</span>
              <span>{a.file.originalName}</span>
              {a.file.contentType && (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  ({a.file.contentType})
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {isDone ? (
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Lección completada
        </div>
      ) : (
        <div>
          <button
            onClick={handleComplete}
            disabled={completing}
            style={{
              background: completing ? 'var(--color-accent-muted)' : 'var(--color-accent-primary)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14.5,
              padding: '12px 22px',
              borderRadius: 10,
              cursor: completing ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: completing ? 0.7 : 1,
            }}
          >
            {completing ? 'Completando...' : 'Marcar como completada'}
          </button>
          {completeError && (
            <div style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 8 }}>
              {completeError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
