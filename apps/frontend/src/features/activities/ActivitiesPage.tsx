import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  useToast,
} from '@/components/ui';
import {
  ApiError,
  apiClient,
  useAuth,
  useActivities,
  useMyGrades,
  useActivityMutations,
  useMySubjects,
  useSaveAsTemplate,
  useStaffAttempts,
  subjectSelectorLabel,
} from '@/lib/api';
import type { ActivityDTO } from '@/lib/api';
import { formatDate, windowState, WINDOW_BADGE } from '../assignments/helpers';
import {
  ATTEMPT_STATUS_BADGE,
  attemptsAllowedLabel,
  blocksLabel,
  isSubjective,
  plural,
  pointsLabel,
  STATUS_BADGE,
} from './helpers';
import { ActivityForm } from './ActivityForm';
import { ActivityPlayer } from './ActivityPlayer';
import { ActivityPreviewModal } from './ActivityPreviewModal';
import { QuestionList } from './QuestionList';
import { TaskLibrary } from './TaskLibrary';
import { GradePanel, type GradeTarget } from '../gradebook/GradePanel';
import styles from './ActivitiesPage.module.css';

const LAST_SUBJECT_KEY = 'activities:last-subject';

/** Mirrors the backend `TEMPLATE_TITLE_MAX` (SaveAsTemplateDto.title). */
const TEMPLATE_NAME_MAX = 200;

function readLastSubject(userId: string | undefined, availableIds: string[]): string | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(`${LAST_SUBJECT_KEY}:${userId}`);
    return saved && availableIds.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

function rememberSubject(userId: string | undefined, subjectId: string) {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${LAST_SUBJECT_KEY}:${userId}`, subjectId);
  } catch {
    // The remembered course is only a convenience; selection still works without storage.
  }
}

function useActivityCourseSelection(
  courses: Array<{ id: string }> | null,
  userId: string | undefined,
  linkedSubjectId: string | null,
  activityId: string | null,
) {
  const [courseId, setCourseId] = useState<string | null>(null);
  // The linked activity answered 404: it was deleted (or never existed).
  const [activityMissing, setActivityMissing] = useState(false);

  useEffect(() => {
    setActivityMissing(false);
    if (!courses?.length) return;
    let active = true;
    const availableIds = courses.map((course) => course.id);
    const linkedSubject = linkedSubjectId && availableIds.includes(linkedSubjectId)
      ? linkedSubjectId
      : null;
    const fallback = linkedSubject ?? readLastSubject(userId, availableIds) ?? availableIds[0];

    if (!activityId) {
      setCourseId(fallback);
      return () => { active = false; };
    }

    apiClient.get<ActivityDTO>(`/activities/${encodeURIComponent(activityId)}`)
      .then((activity) => {
        if (!active) return;
        setCourseId(availableIds.includes(activity.subjectId) ? activity.subjectId : fallback);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) setActivityMissing(true);
        setCourseId(fallback);
      });

    return () => { active = false; };
  }, [courses, userId, linkedSubjectId, activityId]);

  function selectCourse(subjectId: string) {
    setCourseId(subjectId);
    rememberSubject(userId, subjectId);
  }

  return { courseId, selectCourse, activityMissing };
}

/**
 * Unified Tareas workspace. Staff author, publish, and grade; students take
 * published tasks in the player. A course selector scopes the list. Tenant is
 * derived server-side from identity.
 */
export function ActivitiesPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const { data: courses, isLoading: coursesLoading } = useMySubjects();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryPreview, setLibraryPreview] = useState<{ activity: ActivityDTO; gradeUrl: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedSubjectId = searchParams.get('subjectId');
  const linkedActivityId = searchParams.get('activityId');
  const { courseId, selectCourse, activityMissing } = useActivityCourseSelection(
    courses,
    user?.userId,
    linkedSubjectId,
    isStaff ? linkedActivityId : null,
  );

  const {
    data: activities,
    isLoading: activitiesLoading,
    error: activitiesError,
    refetch,
  } = useActivities(courseId);

  useEffect(() => {
    if (!activities) return;
    if (activityMissing) {
      // Don't silently fall back to another task: the empty state explains it.
      setSelectedId(null);
      return;
    }
    const fromUrl = searchParams.get('activityId');
    if (fromUrl && activities.some((a) => a.id === fromUrl)) {
      setSelectedId(fromUrl);
    } else if (!selectedId && activities.length > 0) {
      setSelectedId(activities[0].id);
    } else if (activities.length === 0) {
      setSelectedId(null);
    }
  }, [activities, activityMissing, searchParams, selectedId]);

  const selected = useMemo<ActivityDTO | null>(
    () => activities?.find((a) => a.id === selectedId) ?? null,
    [activities, selectedId],
  );

  function selectActivity(id: string) {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.set('activityId', id);
    setSearchParams(next, { replace: true });
  }

  if (!isStaff) {
    return <StudentActivitiesPage />;
  }

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          Tareas
        </h1>
        {courses && courses.length > 0 && (
          <div className={styles.courseSelector}>
            <Select
              aria-label="Asignatura"
              value={courseId ?? ''}
              onChange={(e) => {
                selectCourse(e.target.value);
                setSelectedId(null);
                setCreating(false);
                const next = new URLSearchParams(searchParams);
                next.delete('activityId');
                next.delete('subjectId');
                setSearchParams(next, { replace: true });
              }}
              options={courses.map((course) => ({ value: course.id, label: subjectSelectorLabel(course) }))}
            />
          </div>
        )}
      </div>

      {coursesLoading && <Spinner size="md" label="Cargando cursos…" />}

      {!coursesLoading && (!courses || courses.length === 0) && (
        <EmptyState
          title="No hay cursos disponibles"
          description="Cuando impartas un curso, sus tareas aparecerán aquí."
        />
      )}

      {courseId && (
        <div className={styles.columns}>
          {/* List column */}
          <div className={styles.listColumn}>
            <div style={{ marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="primary" onClick={() => setCreating(true)}>
                + Nueva tarea
              </Button>
              <Button variant="outline" onClick={() => setLibraryOpen(true)}>
                Biblioteca
              </Button>
            </div>

            {activitiesLoading && <Spinner size="md" label="Cargando tareas…" />}

            {activitiesError && (
              <p style={{ color: 'var(--color-error)', fontSize: 14 }}>
                No se pudieron cargar las tareas (¿impartes este curso?).
              </p>
            )}

            {activities && activities.length === 0 && !activitiesLoading && (
              <EmptyState
                title="Sin tareas todavía"
                description="Crea la primera tarea con el botón de arriba o usa la biblioteca."
              />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activities?.map((a) => {
                const active = a.id === selectedId;
                const status = STATUS_BADGE[a.status];
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => selectActivity(a.id)}
                    style={{
                      textAlign: 'left',
                      background: active ? 'var(--color-accent-muted)' : 'var(--color-bg-secondary)',
                      border: `1px solid ${active ? 'var(--color-accent-primary)' : 'var(--color-border-primary)'}`,
                      borderRadius: 12,
                      padding: '14px 16px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: 14.5 }}>{a.title}</span>
                      <Badge variant={status.variant} dot>{status.label}</Badge>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 3 }}>
                      {blocksLabel(a.questions?.length ?? 0)} · {pointsLabel(a.maxScore)}
                      {a.countsTowardFinal === false ? ' · práctica' : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail column */}
          <div className={styles.detailColumn}>
            {activityMissing ? (
              <MissingActivity />
            ) : !selected ? (
              <p style={{ color: 'var(--color-text-muted)' }}>
                Selecciona una tarea para editarla.
              </p>
            ) : (
              <ActivityDetail
                key={selected.id}
                activity={selected}
                onChanged={refetch}
                onDeleted={() => {
                  setSelectedId(null);
                  refetch();
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Create modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva tarea" size="lg">
        <ActivityForm
          courseId={courseId ?? ''}
          inModal
          onSaved={(a) => {
            setCreating(false);
            refetch();
            selectActivity(a.id);
          }}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      {courseId && (
        <TaskLibrary
          courseId={courseId}
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          onPreview={(activity, gradeUrl) => {
            setLibraryOpen(false);
            setLibraryPreview({ activity, gradeUrl });
          }}
          onInstantiated={(a) => {
            setLibraryOpen(false);
            refetch();
            selectActivity(a.id);
          }}
        />
      )}
      <ActivityPreviewModal
        activity={libraryPreview?.activity ?? null}
        gradeUrl={libraryPreview?.gradeUrl ?? null}
        onClose={() => setLibraryPreview(null)}
      />
    </div>
  );
}

/** Learner workspace. The activity and attempt endpoints determine membership
 * and course role on the server; this UI never receives an answer key. */
function StudentActivitiesPage() {
  const { user } = useAuth();
  const { data: courses, isLoading: coursesLoading } = useMySubjects();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { courseId, selectCourse: selectCourseFromUser, activityMissing } = useActivityCourseSelection(
    courses,
    user?.userId,
    searchParams.get('subjectId'),
    searchParams.get('activityId'),
  );

  const { data: activities, isLoading, error, refetch } = useActivities(courseId);
  const { data: myGrades, refetch: refetchMyGrades } = useMyGrades(courseId);

  useEffect(() => {
    if (!activities) return;
    if (activityMissing) {
      setSelectedId(null);
      return;
    }
    const fromUrl = searchParams.get('activityId');
    if (fromUrl && activities.some((activity) => activity.id === fromUrl)) setSelectedId(fromUrl);
    else if (!selectedId && activities.length) setSelectedId(activities[0].id);
    else if (!activities.length) setSelectedId(null);
  }, [activities, activityMissing, searchParams, selectedId]);

  const selected = activities?.find((activity) => activity.id === selectedId) ?? null;
  function selectActivity(id: string) {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.set('activityId', id);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Tareas</h1>
        {courses?.length ? <div className={styles.courseSelector}><Select aria-label="Asignatura" value={courseId ?? ''} onChange={(event) => {
          selectCourseFromUser(event.target.value);
          setSelectedId(null);
          const next = new URLSearchParams(searchParams);
          next.delete('activityId');
          next.delete('subjectId');
          setSearchParams(next, { replace: true });
        }} options={courses.map((course) => ({ value: course.id, label: subjectSelectorLabel(course) }))} /></div> : null}
      </div>
      {coursesLoading && <Spinner size="md" label="Cargando cursos…" />}
      {!coursesLoading && !courses?.length && <EmptyState title="No tienes cursos disponibles" description="Cuando te matricules en un curso, sus tareas aparecerán aquí." />}
      {courseId && <div className={styles.columns}>
        <div className={styles.listColumn}>
          {isLoading && <Spinner size="md" label="Cargando tareas…" />}
          {error && <p style={{ color: 'var(--color-error)', fontSize: 14 }}>No se pudieron cargar las tareas de este curso.</p>}
          {activities?.length === 0 && !isLoading && <EmptyState title="Sin tareas todavía" description="Este curso aún no tiene tareas publicadas." />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activities?.map((activity) => {
              const active = activity.id === selectedId;
              // Once the learner has delivered, their own progress says more than "Abierta".
              const delivered = myGrades?.items.find((item) => item.activityId === activity.id)?.status;
              const badge = delivered === 'GRADED'
                ? { variant: 'success' as const, label: 'Corregida' }
                : delivered === 'SUBMITTED'
                  ? { variant: 'info' as const, label: 'Entregada' }
                  : WINDOW_BADGE[windowState(activity.openAt, activity.closeAt)];
              return <button key={activity.id} type="button" onClick={() => selectActivity(activity.id)} style={{ textAlign: 'left', background: active ? 'var(--color-accent-muted)' : 'var(--color-bg-secondary)', border: `1px solid ${active ? 'var(--color-accent-primary)' : 'var(--color-border-primary)'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 700, fontSize: 14.5 }}>{activity.title}</span><Badge variant={badge.variant}>{badge.label}</Badge></div>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 3 }}>{blocksLabel(activity.questions?.length ?? 0)} · {pointsLabel(activity.maxScore)}{activity.countsTowardFinal === false ? ' · práctica' : ''}</div>
              </button>;
            })}
          </div>
        </div>
        <div className={styles.detailColumn}>
          {activityMissing ? <MissingActivity /> : selected ? <ActivityPlayer key={selected.id} activityId={selected.id} onAttemptChanged={() => { refetch(); refetchMyGrades(); }} /> : <p style={{ color: 'var(--color-text-muted)' }}>Selecciona una tarea para ver sus detalles.</p>}
        </div>
      </div>}
    </div>
  );
}

/** Shown when a deep link points at a task that was deleted or never existed. */
function MissingActivity() {
  return (
    <EmptyState
      title="Esta tarea ya no existe"
      description="Puede que se haya eliminado o que ya no esté disponible para ti."
      action={<Link to="/activities" className={styles.backLink}>Volver a las tareas</Link>}
    />
  );
}

// ---------------------------------------------------------------------------

function ActivityDetail({
  activity,
  onChanged,
  onDeleted,
}: {
  activity: ActivityDTO;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const { updateActivity, deleteActivity, isLoading } = useActivityMutations();
  const { save: saveAsTemplate, isLoading: savingTemplate } = useSaveAsTemplate();
  const {
    attempts,
    isLoading: attemptsLoading,
    error: attemptsError,
    refetch: refetchAttempts,
  } = useStaffAttempts(activity.id);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [offerArchive, setOfferArchive] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [gradeTarget, setGradeTarget] = useState<GradeTarget | null>(null);

  const status = STATUS_BADGE[activity.status];
  const winState = windowState(activity.openAt, activity.closeAt);
  const winBadge = WINDOW_BADGE[winState];
  const published = activity.status === 'PUBLISHED';
  const canPublish = (activity.questions?.length ?? 0) > 0;
  const questions = activity.questions ?? [];
  const manualCount = questions.filter((question) => isSubjective(question.kind, question.content)).length;
  const autoCount = questions.length - manualCount;
  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);

  async function togglePublish() {
    try {
      if (!published && !canPublish) {
        toast({ variant: 'error', message: 'Añade al menos un bloque antes de publicar.' });
        return;
      }
      if (!published) {
        const zeroIndex = questions.findIndex((q) => q.points <= 0 && q.kind !== 'FILE_UPLOAD');
        if (totalPoints <= 0) {
          toast({ variant: 'error', message: 'La tarea suma 0 puntos: asigna puntos a sus preguntas antes de publicar.' });
          return;
        }
        if (zeroIndex !== -1) {
          toast({ variant: 'error', message: `La pregunta ${zeroIndex + 1} tiene 0 puntos: asigna al menos 1 punto antes de publicar.` });
          return;
        }
      }
      await updateActivity(activity.id, { status: published ? 'DRAFT' : 'PUBLISHED' });
      toast({ variant: 'success', message: published ? 'Tarea despublicada.' : 'Tarea publicada.' });
      onChanged();
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'No se pudo cambiar el estado.' });
    }
  }

  async function handleDelete() {
    try {
      await deleteActivity(activity.id);
      toast({ variant: 'success', message: 'Tarea eliminada.' });
      setConfirmDelete(false);
      onDeleted();
    } catch (err) {
      setConfirmDelete(false);
      // 409: the task already has attempts, so it can only be archived.
      if (err instanceof ApiError && err.status === 409 && activity.status !== 'ARCHIVED') {
        setOfferArchive(true);
        return;
      }
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'No se pudo eliminar.' });
    }
  }

  async function handleArchive() {
    try {
      await updateActivity(activity.id, { status: 'ARCHIVED' });
      toast({ variant: 'success', message: 'Tarea archivada.' });
      setOfferArchive(false);
      onChanged();
    } catch (err) {
      setOfferArchive(false);
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'No se pudo archivar la tarea.' });
    }
  }

  function openTemplateDialog() {
    setTemplateName(activity.title.slice(0, TEMPLATE_NAME_MAX));
    setTemplateError(null);
    setTemplateOpen(true);
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (savingTemplate) return;
    const name = templateName.trim();
    if (!name) {
      setTemplateError('El nombre de la plantilla es obligatorio.');
      return;
    }
    if (name.length > TEMPLATE_NAME_MAX) {
      setTemplateError(`El nombre no puede superar ${TEMPLATE_NAME_MAX} caracteres.`);
      return;
    }
    try {
      await saveAsTemplate(activity.id, { title: name });
      toast({ variant: 'success', message: 'Guardada como plantilla.' });
      setTemplateOpen(false);
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'No se pudo guardar la plantilla.');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{activity.title}</h2>
          <Badge variant={status.variant} dot>{status.label}</Badge>
          {published && <Badge variant={winBadge.variant}>{winBadge.label}</Badge>}
        </div>
        <div className={styles.detailActions}>
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            Vista previa
          </Button>
          <Button variant={published ? 'outline' : 'primary'} size="sm" onClick={togglePublish} disabled={isLoading}>
            {published ? 'Despublicar' : 'Publicar'}
          </Button>
          <Button variant="outline" size="sm" onClick={openTemplateDialog}>
            Guardar plantilla
          </Button>
          <Button variant="outline" size="sm" aria-label="Editar tarea" onClick={() => setEditing(true)}>Editar</Button>
          <Button variant="danger" size="sm" aria-label="Borrar tarea" onClick={() => setConfirmDelete(true)}>Borrar</Button>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '10px 0 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span>
          {activity.openAt ? `Abre ${formatDate(activity.openAt)} · ` : ''}
          {activity.dueAt ? `Entrega ${formatDate(activity.dueAt)}` : 'Sin fecha límite'}
          {activity.closeAt ? ` · Cierra ${formatDate(activity.closeAt)}` : ''}
        </span>
        <span>· {pointsLabel(activity.maxScore)}</span>
        <span>· {attemptsAllowedLabel(activity.attemptsAllowed)}</span>
        {activity.countsTowardFinal === false && (
          <Badge variant="neutral">Práctica</Badge>
        )}
      </div>

      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
        {plural(questions.length, 'pregunta', 'preguntas')} · {plural(totalPoints, 'punto total', 'puntos totales')} · {plural(autoCount, 'autocorregible', 'autocorregibles')} · {manualCount} de corrección manual
      </p>

      {activity.description && (
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', marginBottom: 18 }}>
          {activity.description}
        </p>
      )}

      <div style={{ borderTop: '1px solid var(--color-border-primary)', paddingTop: 18, marginTop: 6 }}>
        <QuestionList activity={activity} onChanged={onChanged} />
      </div>

      <StaffAttempts
        activity={activity}
        attempts={attempts}
        isLoading={attemptsLoading}
        error={attemptsError}
        onGrade={(target) => setGradeTarget(target)}
      />

      <ActivityPreviewModal
        activity={previewOpen ? activity : null}
        gradeUrl={`/activities/${encodeURIComponent(activity.id)}/preview/grade`}
        onClose={() => setPreviewOpen(false)}
      />

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar tarea" size="lg">
        <ActivityForm
          courseId={activity.subjectId}
          initial={activity}
          inModal
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Borrar tarea"
        message={`¿Seguro que quieres borrar «${activity.title}»? Esta acción no se puede deshacer.`}
        confirmLabel="Borrar"
        variant="danger"
        loading={isLoading}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={offerArchive}
        title="No se puede borrar"
        message={`«${activity.title}» ya tiene intentos de alumnos, así que no puede borrarse. Puedes archivarla: dejará de estar disponible, pero se conservarán las entregas y las notas.`}
        confirmLabel="Archivar"
        loading={isLoading}
        onConfirm={handleArchive}
        onCancel={() => setOfferArchive(false)}
      />

      <Modal
        open={templateOpen}
        onClose={() => !savingTemplate && setTemplateOpen(false)}
        title="Guardar como plantilla"
        size="sm"
      >
        <form onSubmit={handleSaveTemplate} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Nombre de la plantilla"
            value={templateName}
            maxLength={TEMPLATE_NAME_MAX}
            onChange={(e) => {
              setTemplateName(e.target.value);
              setTemplateError(null);
            }}
            error={templateError ?? undefined}
            required
            autoFocus
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button type="button" variant="ghost" onClick={() => setTemplateOpen(false)} disabled={savingTemplate}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={savingTemplate} disabled={savingTemplate}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>

      {gradeTarget && (
        <GradePanel
          target={gradeTarget}
          onClose={() => setGradeTarget(null)}
          onGraded={() => {
            setGradeTarget(null);
            refetchAttempts();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function StaffAttempts({
  activity,
  attempts,
  isLoading,
  error,
  onGrade,
}: {
  activity: ActivityDTO;
  attempts: ReturnType<typeof useStaffAttempts>['attempts'];
  isLoading: boolean;
  error: Error | null;
  onGrade: (target: GradeTarget) => void;
}) {
  const submitted = (attempts ?? []).filter((a) => a.status !== 'IN_PROGRESS');
  return (
    <div style={{ borderTop: '1px solid var(--color-border-primary)', paddingTop: 18, marginTop: 18 }}>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Entregas</h3>
      {isLoading && <Spinner size="sm" label="Cargando entregas…" />}
      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: 13 }}>
          No se pudieron cargar las entregas.
        </p>
      )}
      {!isLoading && !error && submitted.length === 0 && (
        <EmptyState
          title="Sin entregas todavía"
          description="Cuando los alumnos envíen, aparecerán aquí para calificar."
        />
      )}
      {submitted.map((attempt) => {
        const badge = ATTEMPT_STATUS_BADGE[attempt.status];
        return (
          <div
            key={attempt.id}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid var(--color-border-primary)',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {attempt.user?.name ?? attempt.userId}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Intento {attempt.attemptNo}
                {attempt.score != null ? ` · ${attempt.score}/${activity.maxScore}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge variant={badge.variant}>{badge.label}</Badge>
              {(attempt.status === 'SUBMITTED' || attempt.status === 'GRADED') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onGrade({
                      attemptId: attempt.id,
                      activityId: activity.id,
                      studentName: attempt.user?.name ?? attempt.userId,
                      title: activity.title,
                    })
                  }
                >
                  Calificar
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
