import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useCourseDetail,
  useSections,
  useProgress,
  useCompletedLessons,
  useEnroll,
  useIsTeacher,
  useUpdateCourse,
  useDeleteCourse,
  ApiError,
} from '@/lib/api';
import {
  Button,
  Modal,
  FormField,
  useToast,
  ConfirmDialog,
} from '@/components/ui';
import { ContentEditor } from './ContentEditor';

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
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const isTeacher = useIsTeacher();
  const { toast } = useToast();
  const { update, isLoading: updating } = useUpdateCourse();
  const { remove, isLoading: deleting } = useDeleteCourse();

  const { data: course, isLoading: courseLoading, error: courseErr } = useCourseDetail(courseId);
  const { data: sections, isLoading: sectionsLoading } = useSections(courseId);
  const { data: progress, isLoading: progressLoading, error: progressError } = useProgress(courseId);
  const { data: completedLessons, isLoading: completedLoading } = useCompletedLessons(courseId);
  const { enroll, isLoading: enrolling } = useEnroll();

  const [accessCode, setAccessCode] = useState('');
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [justEnrolled, setJustEnrolled] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAccessCode, setEditAccessCode] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  if (courseLoading || sectionsLoading || progressLoading || completedLoading) {
    return (
      <div style={{ padding: '40px', color: 'var(--color-text-secondary)' }}>
        Cargando curso...
      </div>
    );
  }

  if (courseErr || !course) {
    return (
      <div style={{ padding: '40px', color: 'var(--color-text-secondary)' }}>
        Curso no encontrado
      </div>
    );
  }

  const color = hashToColor(course.title);
  const isNotEnrolled = progressError instanceof ApiError && progressError.isNotFound;
  const pct = progress?.progress ?? 0;

  const handleEnroll = async () => {
    setEnrollError(null);
    try {
      await enroll(course.id, course.accessCode ? accessCode : undefined);
      setJustEnrolled(true);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      const msg = err instanceof ApiError && err.isNotFound
        ? 'Código de acceso incorrecto'
        : err instanceof Error ? err.message : 'Error al inscribirse';
      setEnrollError(msg);
    }
  };

  const openEdit = () => {
    setEditTitle(course.title);
    setEditDescription(course.description ?? '');
    setEditCategory(course.category ?? '');
    setEditAccessCode(course.accessCode ?? '');
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editTitle.trim()) return;
    try {
      await update(course.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        category: editCategory.trim() || undefined,
        accessCode: editAccessCode.trim() || undefined,
      });
      setEditOpen(false);
      toast({ message: 'Curso actualizado', variant: 'success' });
    } catch {
      toast({ message: 'Error al actualizar el curso', variant: 'error' });
    }
  };

  const handleStatusChange = async (status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    try {
      await update(course.id, { status });
      toast({ message: `Curso ${status === 'PUBLISHED' ? 'publicado' : status === 'ARCHIVED' ? 'archivado' : 'guardado como borrador'}`, variant: 'success' });
    } catch {
      toast({ message: 'Error al cambiar el estado', variant: 'error' });
    }
  };

  const handleDelete = async () => {
    try {
      await remove(course.id);
      toast({ message: 'Curso eliminado', variant: 'success' });
      navigate('/courses');
    } catch {
      toast({ message: 'Error al eliminar el curso', variant: 'error' });
    }
  };

  return (
    <div>
      <div style={{ padding: '26px 40px', background: color, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
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
          </div>

          {isTeacher && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" size="sm" onClick={openEdit}>
                Editar
              </Button>
              <Button
                variant={editing ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setEditing(!editing)}
              >
                {editing ? 'Ver como alumno' : 'Modo edición'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleStatusChange(course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')}
              >
                {course.status === 'PUBLISHED' ? 'Guardar borrador' : 'Publicar'}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                Eliminar
              </Button>
            </div>
          )}
        </div>

        {course.status !== 'PUBLISHED' && isTeacher && (
          <div style={{ marginTop: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              background: 'rgba(255,255,255,.18)', padding: '3px 10px', borderRadius: 6,
            }}>
              {course.status === 'DRAFT' ? 'Borrador' : 'Archivado'}
            </span>
          </div>
        )}

        {isNotEnrolled ? (
          <div style={{ marginTop: 14 }}>
            {course.description && (
              <p style={{ fontSize: 14, opacity: 0.88, margin: '0 0 14px', lineHeight: 1.5 }}>
                {course.description}
              </p>
            )}
            {justEnrolled ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                ¡Inscrito! Cargando...
              </div>
            ) : (
              <div>
                {course.accessCode && (
                  <input
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Código de acceso"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 9,
                      border: 'none',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      width: 200,
                      marginRight: 10,
                      marginBottom: 8,
                    }}
                  />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={handleEnroll}
                    disabled={enrolling}
                    style={{
                      background: enrolling ? 'rgba(255,255,255,.4)' : '#fff',
                      border: 'none',
                      color: color,
                      fontWeight: 700,
                      fontSize: 14.5,
                      padding: '10px 22px',
                      borderRadius: 9,
                      cursor: enrolling ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {enrolling ? 'Inscribiendo...' : 'Inscribirse'}
                  </button>
                  {enrollError && (
                    <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.95 }}>
                      {enrollError}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
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

      {editing && isTeacher && courseId ? (
        <ContentEditor courseId={courseId} />
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
                    <div
                      key={l.id}
                      onClick={() => !isNotEnrolled && navigate(`/courses/${courseId}/lessons/${l.id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 13,
                        padding: '13px 16px',
                        borderBottom: '1px solid var(--color-border-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      {isDone ? (
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
                      ) : (
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
                      )}
                      <span style={{ flex: 1, fontSize: 14.5, fontWeight: isDone ? 500 : 600, color: isDone ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
                        {l.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar curso"
        footer={<Button loading={updating} onClick={handleUpdate}>Guardar cambios</Button>}
      >
        <FormField label="Título" required>
          {(f) => <input {...f} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit' }} />}
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
        <div style={{ height: 12 }} />
        <FormField label="Código de acceso">
          {(f) => <input {...f} value={editAccessCode} onChange={(e) => setEditAccessCode(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-primary)', fontSize: 14, fontFamily: 'inherit' }} />}
        </FormField>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { handleDelete(); setConfirmDelete(false); }}
        title="Eliminar curso"
        message={`¿Estás seguro de eliminar "${course.title}"? Esta acción no se puede deshacer.`}
        confirmLabel={deleting ? 'Eliminando...' : 'Eliminar'}
        variant="danger"
      />
    </div>
  );
}
