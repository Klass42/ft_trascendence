import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Modal,
  Select,
  Spinner,
  useToast,
} from '@/components/ui';
import {
  apiClient,
  useAuth,
  useActivities,
  useActivityMutations,
  useMySubjects,
  useSaveAsTemplate,
  useStaffAttempts,
  subjectSelectorLabel,
} from '@/lib/api';
import type { ActivityDTO } from '@/lib/api';
import { formatDate, windowState, WINDOW_BADGE } from '../assignments/helpers';
import { ATTEMPT_STATUS_BADGE, STATUS_BADGE } from './helpers';
import { ActivityForm } from './ActivityForm';
import { ActivityPlayer } from './ActivityPlayer';
import { QuestionList } from './QuestionList';
import { TaskLibrary } from './TaskLibrary';
import { GradePanel, type GradeTarget } from '../gradebook/GradePanel';
import styles from './ActivitiesPage.module.css';

const LAST_SUBJECT_KEY = 'activities:last-subject';

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

  useEffect(() => {
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
      .catch(() => {
        if (active) setCourseId(fallback);
      });

    return () => { active = false; };
  }, [courses, userId, linkedSubjectId, activityId]);

  function selectCourse(subjectId: string) {
    setCourseId(subjectId);
    rememberSubject(userId, subjectId);
  }

  return { courseId, selectCourse };
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
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedSubjectId = searchParams.get('subjectId');
  const linkedActivityId = searchParams.get('activityId');
  const { courseId, selectCourse } = useActivityCourseSelection(
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
    const fromUrl = searchParams.get('activityId');
    if (fromUrl && activities.some((a) => a.id === fromUrl)) {
      setSelectedId(fromUrl);
    } else if (!selectedId && activities.length > 0) {
      setSelectedId(activities[0].id);
    } else if (activities.length === 0) {
      setSelectedId(null);
    }
  }, [activities, searchParams, selectedId]);

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
                      {a.questions?.length ?? 0} bloques · {a.maxScore} pts
                      {a.countsTowardFinal === false ? ' · práctica' : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail column */}
          <div className={styles.detailColumn}>
            {!selected ? (
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
          onInstantiated={(a) => {
            setLibraryOpen(false);
            refetch();
            selectActivity(a.id);
          }}
        />
      )}
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
  const { courseId, selectCourse: selectCourseFromUser } = useActivityCourseSelection(
    courses,
    user?.userId,
    searchParams.get('subjectId'),
    searchParams.get('activityId'),
  );

  const { data: activities, isLoading, error, refetch } = useActivities(courseId);

  useEffect(() => {
    if (!activities) return;
    const fromUrl = searchParams.get('activityId');
    if (fromUrl && activities.some((activity) => activity.id === fromUrl)) setSelectedId(fromUrl);
    else if (!selectedId && activities.length) setSelectedId(activities[0].id);
    else if (!activities.length) setSelectedId(null);
  }, [activities, searchParams, selectedId]);

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
              const badge = WINDOW_BADGE[windowState(activity.openAt, activity.closeAt)];
              return <button key={activity.id} type="button" onClick={() => selectActivity(activity.id)} style={{ textAlign: 'left', background: active ? 'var(--color-accent-muted)' : 'var(--color-bg-secondary)', border: `1px solid ${active ? 'var(--color-accent-primary)' : 'var(--color-border-primary)'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 700, fontSize: 14.5 }}>{activity.title}</span><Badge variant={badge.variant}>{badge.label}</Badge></div>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 3 }}>{activity.questions?.length ?? 0} bloques · {activity.maxScore} pts{activity.countsTowardFinal === false ? ' · práctica' : ''}</div>
              </button>;
            })}
          </div>
        </div>
        <div className={styles.detailColumn}>
          {selected ? <ActivityPlayer key={selected.id} activityId={selected.id} onAttemptChanged={refetch} /> : <p style={{ color: 'var(--color-text-muted)' }}>Selecciona una tarea para ver sus detalles.</p>}
        </div>
      </div>}
    </div>
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
  const [gradeTarget, setGradeTarget] = useState<GradeTarget | null>(null);

  const status = STATUS_BADGE[activity.status];
  const winState = windowState(activity.openAt, activity.closeAt);
  const winBadge = WINDOW_BADGE[winState];
  const published = activity.status === 'PUBLISHED';
  const canPublish = (activity.questions?.length ?? 0) > 0;

  async function togglePublish() {
    try {
      if (!published && !canPublish) {
        toast({ variant: 'error', message: 'Añade al menos un bloque antes de publicar.' });
        return;
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
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'No se pudo eliminar.' });
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{activity.title}</h2>
          <Badge variant={status.variant} dot>{status.label}</Badge>
          <Badge variant={winBadge.variant}>{winBadge.label}</Badge>
        </div>
        <div className={styles.detailActions}>
          <Button variant={published ? 'outline' : 'primary'} size="sm" onClick={togglePublish} disabled={isLoading}>
            {published ? 'Despublicar' : 'Publicar'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await saveAsTemplate(activity.id);
                toast({ variant: 'success', message: 'Guardada como plantilla.' });
              } catch (err) {
                toast({
                  variant: 'error',
                  message: err instanceof Error ? err.message : 'No se pudo guardar la plantilla.',
                });
              }
            }}
            loading={savingTemplate}
          >
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
        <span>· {activity.maxScore} pts</span>
        <span>· {activity.attemptsAllowed === 0 ? 'Intentos ilimitados' : `${activity.attemptsAllowed} intento(s)`}</span>
        {activity.countsTowardFinal === false && (
          <Badge variant="neutral">Práctica</Badge>
        )}
      </div>

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
        message={`¿Seguro que quieres borrar «${activity.title}»? Si hay intentos, el servidor pedirá archivarla.`}
        confirmLabel="Borrar"
        variant="danger"
        loading={isLoading}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

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
