import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Paperclip, ExternalLink, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  apiClient,
  useCourseDetail,
  useSections,
  useLessonById,
  useCompletedLessons,
  useCompleteLesson,
  useIsTeacher,
  useProgress,
} from '@/lib/api';
import { Button, useToast } from '@/components/ui';
import { VideoPlayer } from './VideoPlayer';
import styles from './LessonPage.module.css';

export function LessonPage() {
  const { courseId, subjectId, lessonId } = useParams<{ courseId: string; subjectId: string; lessonId: string }>();
  const navigate = useNavigate();
  // Global teachers and admins reach this page as staff; progress is a student concept.
  const isStaff = useIsTeacher();

  const { data: course } = useCourseDetail(subjectId);
  const { data: sections } = useSections(subjectId);
  const { data: lesson, isLoading: lessonLoading, error: lessonErr } = useLessonById(lessonId);
  const { data: completedLessons } = useCompletedLessons(isStaff ? undefined : subjectId);
  const { data: progress } = useProgress(isStaff ? undefined : subjectId);
  const { completeLesson, uncompleteLesson, isLoading: saving } = useCompleteLesson();
  const { toast } = useToast();
  const pageRef = useRef<HTMLDivElement>(null);

  // Changes made on this page win over the list fetched when the subject opened.
  const [doneOverrides, setDoneOverrides] = useState<Record<string, boolean>>({});
  const [completeError, setCompleteError] = useState<string | null>(null);
  // Subject progress after completing here (the API returns the new value).
  const [pctOverride, setPctOverride] = useState<number | null>(null);

  useEffect(() => {
    setCompleteError(null);
    // The app scrolls inside <main>, not the window.
    pageRef.current?.scrollIntoView({ block: 'start' });
  }, [lessonId]);

  const orderedLessons = useMemo(
    () => (sections ?? []).flatMap((section) => section.lessons ?? []),
    [sections],
  );
  const lessonIndex = orderedLessons.findIndex((item) => item.id === lessonId);
  const previousLesson = lessonIndex > 0 ? orderedLessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex >= 0 ? orderedLessons[lessonIndex + 1] ?? null : null;

  const isDone = lessonId
    ? doneOverrides[lessonId] ?? completedLessons?.includes(lessonId) ?? false
    : false;

  const toggleComplete = async () => {
    if (!lessonId) return;
    setCompleteError(null);
    try {
      const result = isDone ? await uncompleteLesson(lessonId) : await completeLesson(lessonId);
      setDoneOverrides((current) => ({ ...current, [lessonId]: !isDone }));
      setPctOverride(result.progress);
    } catch {
      setCompleteError(
        isDone ? 'Error al desmarcar la lección' : 'Error al marcar la lección como completada',
      );
    }
  };

  if (lessonLoading) {
    return <div className={`${styles.page} ${styles.status}`}>Cargando lección...</div>;
  }

  if (lessonErr || !lesson) {
    return <div className={`${styles.page} ${styles.status}`}>Lección no encontrada</div>;
  }

  const pct = pctOverride ?? progress?.progress ?? 0;
  const lessonPath = (id: string) => `/courses/${courseId}/subjects/${subjectId}/lessons/${id}`;

  const openAttachment = async (fileId: string) => {
    try {
      const { url } = await apiClient.get<{ url: string }>(`/files/${fileId}/url`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast({ message: 'No se pudo abrir el adjunto', variant: 'error' });
    }
  };

  return (
    <div className={styles.page} ref={pageRef}>
      <button
        type="button"
        className={styles.back}
        onClick={() => navigate(`/courses/${courseId}/subjects/${subjectId}`)}
      >
        ← {course?.title || 'Curso'}
      </button>

      <h1 className={styles.title}>{lesson.title}</h1>
      {course && (
        <div className={styles.meta}>
          {course.title}{!isStaff && <> · Progreso {pct}%</>}
        </div>
      )}

      {lesson.videoUrl && (
        <div className={styles.video}>
          <VideoPlayer url={lesson.videoUrl} title={lesson.title} />
        </div>
      )}

      {lesson.contentMd && (
        <div className={styles.markdown}>
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

      {!isStaff && (
        <div className={styles.completion}>
          {isDone ? (
            <>
              <div className={styles.done}>
                <Check size={16} strokeWidth={3} aria-hidden="true" />
                Lección completada
              </div>
              <Button variant="ghost" size="sm" onClick={() => { void toggleComplete(); }} loading={saving}>
                Desmarcar como completada
              </Button>
            </>
          ) : (
            <Button onClick={() => { void toggleComplete(); }} loading={saving}>
              {saving ? 'Completando...' : 'Marcar como completada'}
            </Button>
          )}
          {completeError && (
            <div className={styles.error} role="alert">{completeError}</div>
          )}
        </div>
      )}

      {(previousLesson || nextLesson) && (
        <nav className={styles.lessonNav} aria-label="Navegación entre lecciones">
          {previousLesson ? (
            <Link to={lessonPath(previousLesson.id)} className={styles.navLink} rel="prev">
              <ChevronLeft size={18} aria-hidden="true" />
              <span className={styles.navText}>
                <span className={styles.navLabel}>Anterior</span>
                <span className={styles.navTitle}>{previousLesson.title}</span>
              </span>
            </Link>
          ) : <span />}
          {nextLesson ? (
            <Link to={lessonPath(nextLesson.id)} className={`${styles.navLink} ${styles.navNext}`} rel="next">
              <span className={styles.navText}>
                <span className={styles.navLabel}>Siguiente</span>
                <span className={styles.navTitle}>{nextLesson.title}</span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
