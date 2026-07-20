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
import { useAuth, useActivities, useActivityMutations, useCourses } from '@/lib/api';
import type { ActivityDTO } from '@/lib/api';
import { formatDate, windowState, WINDOW_BADGE } from '../assignments/helpers';
import { STATUS_BADGE } from './helpers';
import { ActivityForm } from './ActivityForm';
import { QuestionList } from './QuestionList';

/**
 * Activity authoring workspace (staff). A course selector scopes the list;
 * picking an activity opens its detail with the question editor. Mirrors the
 * AssignmentsPage layout so the two feel like one product. The tenant is derived
 * server-side; students don't reach this page (nav is staff-only until B2b adds
 * the player).
 */
export function ActivitiesPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const { data: courses, isLoading: coursesLoading } = useCourses();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!courseId && courses && courses.length > 0) setCourseId(courses[0].id);
  }, [courses, courseId]);

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
    return (
      <div style={{ padding: '30px 40px', maxWidth: 700 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Actividades</h1>
        <EmptyState
          title="Aún no disponible"
          description="Pronto podrás realizar actividades desde aquí."
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '30px 40px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          Actividades
        </h1>
        {courses && courses.length > 0 && (
          <div style={{ marginLeft: 'auto', minWidth: 220 }}>
            <Select
              aria-label="Curso"
              value={courseId ?? ''}
              onChange={(e) => {
                setCourseId(e.target.value);
                setSelectedId(null);
                setCreating(false);
              }}
              options={courses.map((c) => ({ value: c.id, label: c.title }))}
            />
          </div>
        )}
      </div>

      {coursesLoading && <Spinner size="md" label="Cargando cursos…" />}

      {!coursesLoading && (!courses || courses.length === 0) && (
        <EmptyState
          title="No hay cursos disponibles"
          description="Cuando impartas un curso, sus actividades aparecerán aquí."
        />
      )}

      {courseId && (
        <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* List column */}
          <div style={{ flex: '1 1 300px', minWidth: 260 }}>
            <div style={{ marginBottom: 14 }}>
              <Button variant="primary" onClick={() => setCreating(true)}>
                + Nueva actividad
              </Button>
            </div>

            {activitiesLoading && <Spinner size="md" label="Cargando actividades…" />}

            {activitiesError && (
              <p style={{ color: 'var(--color-error)', fontSize: 14 }}>
                No se pudieron cargar las actividades (¿impartes este curso?).
              </p>
            )}

            {activities && activities.length === 0 && !activitiesLoading && (
              <EmptyState
                title="Sin actividades todavía"
                description="Crea la primera actividad con el botón de arriba."
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
                      {a.questions?.length ?? 0} preguntas · {a.maxScore} pts
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail column */}
          <div
            style={{
              flex: '2 1 420px',
              minWidth: 300,
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 14,
              padding: 22,
            }}
          >
            {!selected ? (
              <p style={{ color: 'var(--color-text-muted)' }}>
                Selecciona una actividad para editarla.
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
      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva actividad" size="lg">
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
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const status = STATUS_BADGE[activity.status];
  const winState = windowState(activity.openAt, activity.closeAt);
  const winBadge = WINDOW_BADGE[winState];
  const published = activity.status === 'PUBLISHED';
  const canPublish = (activity.questions?.length ?? 0) > 0;

  async function togglePublish() {
    try {
      if (!published && !canPublish) {
        toast({ variant: 'error', message: 'Añade al menos una pregunta antes de publicar.' });
        return;
      }
      await updateActivity(activity.id, { status: published ? 'DRAFT' : 'PUBLISHED' });
      toast({ variant: 'success', message: published ? 'Actividad despublicada.' : 'Actividad publicada.' });
      onChanged();
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'No se pudo cambiar el estado.' });
    }
  }

  async function handleDelete() {
    try {
      await deleteActivity(activity.id);
      toast({ variant: 'success', message: 'Actividad eliminada.' });
      setConfirmDelete(false);
      onDeleted();
    } catch (err) {
      toast({ variant: 'error', message: err instanceof Error ? err.message : 'No se pudo eliminar.' });
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{activity.title}</h2>
          <Badge variant={status.variant} dot>{status.label}</Badge>
          <Badge variant={winBadge.variant}>{winBadge.label}</Badge>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant={published ? 'outline' : 'primary'} size="sm" onClick={togglePublish} disabled={isLoading}>
            {published ? 'Despublicar' : 'Publicar'}
          </Button>
          <Button variant="outline" size="sm" aria-label="Editar actividad" onClick={() => setEditing(true)}>Editar</Button>
          <Button variant="danger" size="sm" aria-label="Borrar actividad" onClick={() => setConfirmDelete(true)}>Borrar</Button>
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
      </div>

      {activity.description && (
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', marginBottom: 18 }}>
          {activity.description}
        </p>
      )}

      <div style={{ borderTop: '1px solid var(--color-border-primary)', paddingTop: 18, marginTop: 6 }}>
        <QuestionList activity={activity} onChanged={onChanged} />
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar actividad" size="lg">
        <ActivityForm
          courseId={activity.courseId}
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
        title="Borrar actividad"
        message={`¿Seguro que quieres borrar «${activity.title}»? Se eliminarán también sus preguntas e intentos. Esta acción no se puede deshacer.`}
        confirmLabel="Borrar"
        variant="danger"
        loading={isLoading}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
