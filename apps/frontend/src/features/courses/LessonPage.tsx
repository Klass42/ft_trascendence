import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Paperclip, ExternalLink } from 'lucide-react';
import {
  apiClient,
  useCourseDetail,
  useLessonById,
  useCompletedLessons,
  useCompleteLesson,
  useProgress,
} from '@/lib/api';
import { useToast } from '@/components/ui';
import styles from './LessonPage.module.css';

export function LessonPage() {
  const { courseId, subjectId, lessonId } = useParams<{ courseId: string; subjectId: string; lessonId: string }>();
  const navigate = useNavigate();

  const { data: course } = useCourseDetail(subjectId);
  const { data: lesson, isLoading: lessonLoading, error: lessonErr } = useLessonById(lessonId);
  const { data: completedLessons } = useCompletedLessons(subjectId);
  const { data: progress } = useProgress(subjectId);
  const { completeLesson, isLoading: completing } = useCompleteLesson();
  const { toast } = useToast();

  const [isDone, setIsDone] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  // Subject progress after completing here (the API returns the new value).
  const [pctOverride, setPctOverride] = useState<number | null>(null);

  useEffect(() => {
    if (completedLessons && lessonId) {
      setIsDone(completedLessons.includes(lessonId));
    }
  }, [completedLessons, lessonId]);

  const handleComplete = async () => {
    if (!lessonId) return;
    setCompleteError(null);
    try {
      const result = await completeLesson(lessonId);
      setIsDone(true);
      setPctOverride(result.progress);
    } catch {
      setCompleteError('Error al marcar la lección como completada');
    }
  };

  if (lessonLoading) {
    return (
      <div className={styles.page} style={{ color: 'var(--color-text-secondary)' }}>
        Cargando lección...
      </div>
    );
  }

  if (lessonErr || !lesson) {
    return (
      <div className={styles.page} style={{ color: 'var(--color-text-secondary)' }}>
        Lección no encontrada
      </div>
    );
  }

  const pct = pctOverride ?? progress?.progress ?? 0;

  const openAttachment = async (fileId: string) => {
    try {
      const { url } = await apiClient.get<{ url: string }>(`/files/${fileId}/url`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast({ message: 'No se pudo abrir el adjunto', variant: 'error' });
    }
  };

  return (
    <div className={styles.page}>
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
        <section className={styles.attachments} aria-labelledby="lesson-attachments">
          <h2 id="lesson-attachments" className={styles.attachmentsTitle}>
            Adjuntos
          </h2>
          <ul className={styles.attachmentList}>
            {lesson.attachments.map((a) => (
              <li key={a.fileId}>
                <button
                  type="button"
                  className={styles.attachment}
                  onClick={() => { void openAttachment(a.fileId); }}
                  aria-label={`Abrir adjunto ${a.file.originalName}`}
                >
                  <Paperclip size={16} aria-hidden="true" />
                  <span className={styles.attachmentName}>{a.file.originalName}</span>
                  <ExternalLink size={14} aria-hidden="true" className={styles.attachmentIcon} />
                </button>
              </li>
            ))}
          </ul>
        </section>
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
