import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ApiError,
  useCourseDetail,
  useSections,
  useProgress,
  useCompletedLessons,
  useIsAdmin,
  useIsTeacher,
  useUpdateCourse,
  useDeleteCourse,
} from '@/lib/api';
import {
  Button,
  EmptyState,
  Modal,
  FormField,
  useToast,
  ConfirmDialog,
  Tabs,
  type TabItem,
} from '@/components/ui';
import { ContentEditor } from './ContentEditor';
import { RosterPage } from './RosterPage';
import { CourseResourcesTab } from '@/features/resources';
import styles from './CourseDetailPage.module.css';

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

export function CourseDetailPage() {
  const { courseId, subjectId } = useParams<{ courseId: string; subjectId: string }>();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const isTeacher = useIsTeacher();
  const { toast } = useToast();
  const { update, isLoading: updating } = useUpdateCourse();
  const { remove, isLoading: deleting } = useDeleteCourse();

  const { data: fullCourse, isLoading: courseLoading, error: courseError, refetch: refetchCourse } = useCourseDetail(subjectId);
  const { data: sections, isLoading: sectionsLoading } = useSections(fullCourse ? subjectId : undefined);
  const { data: progress, isLoading: progressLoading } = useProgress(fullCourse && !isTeacher ? subjectId : undefined);
  const { data: completedLessons, isLoading: completedLoading } = useCompletedLessons(fullCourse && !isTeacher ? subjectId : undefined);

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  if (
    // Only the first load blanks the page; refetches after an edit keep it.
    (courseLoading && !fullCourse) ||
    (fullCourse && (sectionsLoading || progressLoading || completedLoading))
  ) {
    return (
      <div style={{ padding: '40px', color: 'var(--color-text-secondary)' }}>
        Cargando asignatura...
      </div>
    );
  }

  const course = fullCourse;

  if (!course) {
    // A deleted subject (e.g. opened from an old notification) is not an error.
    if (courseError instanceof ApiError && courseError.isNotFound) {
      return (
        <div style={{ padding: '40px' }}>
          <EmptyState
            title="Esta asignatura ya no existe"
            description="Es posible que se haya eliminado."
            action={<Button onClick={() => navigate(courseId ? `/courses/${courseId}` : '/courses')}>Volver a la cohorte</Button>}
          />
        </div>
      );
    }
    return (
      <div style={{ padding: '40px', color: 'var(--color-text-secondary)' }}>
        Asignatura no encontrada
      </div>
    );
  }

  const color = hashToColor(course.title);
  const pct = progress?.progress ?? 0;

  const openEdit = () => {
    if (!fullCourse) return;
    setEditTitle(fullCourse.title);
    setEditDescription(fullCourse.description ?? '');
    setEditCategory(fullCourse.category ?? '');
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editTitle.trim()) return;
    try {
      if (!fullCourse) return;
      await update(fullCourse.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        category: editCategory.trim() || undefined,
      });
      setEditOpen(false);
      toast({ message: 'Asignatura actualizada', variant: 'success' });
      refetchCourse();
    } catch {
      toast({ message: 'Error al actualizar la asignatura', variant: 'error' });
    }
  };

  const handleStatusChange = async (status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    try {
      if (!fullCourse) return;
      await update(fullCourse.id, { status });
      toast({ message: `Asignatura ${status === 'PUBLISHED' ? 'publicada' : status === 'ARCHIVED' ? 'archivada' : 'guardada como borrador'}`, variant: 'success' });
      refetchCourse();
    } catch {
      toast({ message: 'Error al cambiar el estado', variant: 'error' });
    }
  };

  const handleDelete = async () => {
    try {
      if (!fullCourse) return;
      await remove(fullCourse.id);
      toast({ message: 'Asignatura eliminada', variant: 'success' });
      navigate(courseId ? `/courses/${courseId}` : '/courses');
    } catch {
      toast({ message: 'Error al eliminar la asignatura', variant: 'error' });
    }
  };

  return (
    <div>
      {/* Background is the subject's generated colour; layout lives in the module. */}
      <div className={styles.hero} style={{ background: color }}>
        <div className={styles.heroTop}>
          <div className={styles.heroHeading}>
            <button
              onClick={() => navigate(courseId ? `/courses/${courseId}` : '/courses')}
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
              ← Volver a la cohorte
            </button>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              {course.title}
            </h1>
          </div>

          {fullCourse && (isAdmin || isTeacher) && (
            <div className={styles.heroActions}>
              {isAdmin && (
                <Button variant="secondary" size="sm" onClick={openEdit}>
                  Editar
                </Button>
              )}
              {isTeacher && (
                <Button
                  variant={editing ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? 'Ver como alumno' : 'Modo edición'}
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleStatusChange(course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')}
                >
                  {course.status === 'PUBLISHED' ? 'Guardar borrador' : 'Publicar'}
                </Button>
              )}
              {isAdmin && (
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                  Eliminar
                </Button>
              )}
            </div>
          )}
        </div>

        {course.status !== 'PUBLISHED' && isTeacher && fullCourse && (
          <div style={{ marginTop: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              background: 'rgba(255,255,255,.18)', padding: '3px 10px', borderRadius: 6,
            }}>
              {course.status === 'DRAFT' ? 'Borrador' : 'Archivada'}
            </span>
          </div>
        )}

        {course.course && (
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 6 }}>
            {course.course.name} · {course.course.academicYear}
          </div>
        )}
        {!isTeacher && (
          <>
            <div style={{ display: 'flex', gap: 16, fontSize: 14, opacity: 0.92, marginTop: 6 }}>
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
          </>
        )}
      </div>

      {(() => {
        const lessonListContent = !sections?.some((sec) => (sec.lessons?.length ?? 0) > 0) ? (
          <div className={styles.emptyContent}>
            <EmptyState
              title="Todavía no hay contenido"
              description={isTeacher
                ? 'Activa el modo edición para añadir secciones y lecciones.'
                : 'Tu profesor aún no ha publicado lecciones en esta asignatura.'}
              action={isTeacher && !editing
                ? <Button size="sm" onClick={() => setEditing(true)}>Modo edición</Button>
                : undefined}
            />
          </div>
        ) : (
          <div style={{ padding: '26px 40px', maxWidth: 820 }}>
            {sections?.map((sec) => (
              <div key={sec.id}>
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
                  {sec.lessons?.map((l) => {
                    const isDone = completedLessons?.includes(l.id);
                    return (
                      <Link
                        key={l.id}
                        to={`/courses/${courseId}/subjects/${subjectId}/lessons/${l.id}`}
                        className={styles.lessonRow}
                      >
                        <span className={isDone ? styles.lessonDone : styles.lessonTodo} aria-hidden="true">
                          {isDone ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                          )}
                        </span>
                        <span className={isDone ? styles.lessonTitleDone : styles.lessonTitle}>{l.title}</span>
                        {isDone && <span className={styles.srOnly}>(completada)</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );

        if (!courseId || !subjectId) {
          return lessonListContent;
        }

        if (isTeacher && fullCourse) {
          return (
            <Tabs
              tabs={[
                {
                  id: 'content',
                  label: 'Contenido',
                  content: editing
                    ? <ContentEditor courseId={subjectId ?? ''} />
                    : lessonListContent,
                },
                {
                  id: 'students',
                  label: 'Alumnos',
                  content: <RosterPage courseId={subjectId ?? ''} />,
                },
                {
                  id: 'resources',
                  label: 'Recursos',
                  content: <CourseResourcesTab courseId={subjectId ?? ''} showStaffStatus />,
                },
              ] satisfies TabItem[]}
            />
          );
        }

        return (
          <Tabs
            tabs={[
              { id: 'content', label: 'Contenido', content: lessonListContent },
              {
                id: 'resources',
                label: 'Recursos',
                content: <CourseResourcesTab courseId={subjectId ?? ''} />,
              },
            ] satisfies TabItem[]}
          />
        );
      })()}

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar asignatura"
        footer={<Button loading={updating} onClick={handleUpdate}>Guardar cambios</Button>}
      >
        <FormField label="Título" required>
          {(f) => <input {...f} value={editTitle} maxLength={200} onChange={(e) => setEditTitle(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit' }} />}
        </FormField>
        <div style={{ height: 12 }} />
        <FormField label="Descripción">
          {(f) => (
            <textarea
              {...f}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
            />
          )}
        </FormField>
        <div style={{ height: 12 }} />
        <FormField label="Categoría">
          {(f) => <input {...f} value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit' }} />}
        </FormField>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { handleDelete(); setConfirmDelete(false); }}
        title="Eliminar asignatura"
        message={`¿Estás seguro de eliminar "${course.title}"? Esta acción no se puede deshacer.`}
        confirmLabel={deleting ? 'Eliminando...' : 'Eliminar'}
        variant="danger"
      />
    </div>
  );
}
