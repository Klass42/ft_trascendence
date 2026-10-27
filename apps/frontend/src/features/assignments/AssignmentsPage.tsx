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
  useAuth,
  useMySubjects,
  useAssignments,
  useMySubmission,
  useDeleteAssignment,
} from '@/lib/api';
import type { AssignmentDTO } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  isOverdue,
  windowState,
  WINDOW_BADGE,
} from './helpers';
import { AssignmentForm } from './AssignmentForm';
import { AssignmentAttachments } from './AssignmentAttachments';
import { SubmissionForm } from './SubmissionForm';
import { SubmissionsList } from './SubmissionsList';

/**
 * Assignments workspace, connected to the real API.
 *
 * A course selector scopes the list; picking an assignment opens its detail.
 * Students see their submission + a submit form; staff (teacher/assistant) can
 * create/edit/delete assignments and review every submission. The tenant is
 * derived server-side from identity, so nothing here trusts a client org.
 */
export function AssignmentsPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const { data: courses, isLoading: coursesLoading } = useMySubjects();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Default the course selector to the first available course.
  useEffect(() => {
    if (!courseId && courses && courses.length > 0) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId]);

  const {
    data: assignments,
    isLoading: assignmentsLoading,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useAssignments(courseId);

  // Honor a ?assignmentId=… deep link (used by notification links), falling
  // back to the first assignment once the list loads.
  useEffect(() => {
    if (!assignments) return;
    const fromUrl = searchParams.get('assignmentId');
    if (fromUrl && assignments.some((a) => a.id === fromUrl)) {
      setSelectedId(fromUrl);
    } else if (!selectedId && assignments.length > 0) {
      setSelectedId(assignments[0].id);
    } else if (assignments.length === 0) {
      setSelectedId(null);
    }
  }, [assignments, searchParams, selectedId]);

  const selected = useMemo<AssignmentDTO | null>(
    () => assignments?.find((a) => a.id === selectedId) ?? null,
    [assignments, selectedId],
  );

  function selectAssignment(id: string) {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.set('assignmentId', id);
    setSearchParams(next, { replace: true });
  }

  return (
    <div style={{ padding: '30px 40px', maxWidth: 1100 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 22,
        }}
      >
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Tareas
        </h1>

        {/* Course selector */}
        {courses && courses.length > 0 && (
          <div style={{ marginLeft: 'auto', minWidth: 220 }}>
            <Select
              aria-label="Asignatura"
              value={courseId ?? ''}
              onChange={(e) => {
                setCourseId(e.target.value);
                setSelectedId(null);
                setCreating(false);
              }}
              options={courses.map((c) => ({ value: c.id, label: `${`${c.title} · ${c.course.name} · ${c.course.academicYear}`} · ${c.course.name} · ${c.course.academicYear}` }))}
            />
          </div>
        )}
      </div>

      {coursesLoading && <Spinner size="md" label="Cargando asignaturas…" />}

      {!coursesLoading && (!courses || courses.length === 0) && (
        <EmptyState
          title="No hay asignaturas disponibles"
          description="Cuando tengas asignaturas, sus tareas aparecerán aquí."
        />
      )}

      {courseId && (
        <div
          style={{
            display: 'flex',
            gap: 22,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          {/* ── List column ── */}
          <div style={{ flex: '1 1 320px', minWidth: 280 }}>
            {isStaff && (
              <div style={{ marginBottom: 14 }}>
                {creating ? (
                  <AssignmentForm
                    courseId={courseId}
                    onSaved={(a) => {
                      setCreating(false);
                      refetchAssignments();
                      selectAssignment(a.id);
                    }}
                    onCancel={() => setCreating(false)}
                  />
                ) : (
                  <Button variant="primary" onClick={() => setCreating(true)}>
                    + Nueva tarea
                  </Button>
                )}
              </div>
            )}

            {assignmentsLoading && <Spinner size="md" label="Cargando tareas…" />}

            {assignmentsError && (
              <p style={{ color: 'var(--color-error)', fontSize: 14 }}>
                No se pudieron cargar las tareas (¿estás inscrito en esta asignatura?).
              </p>
            )}

            {assignments && assignments.length === 0 && !assignmentsLoading && (
              <EmptyState
                title="Sin tareas todavía"
                description={
                  isStaff
                    ? 'Crea la primera tarea con el botón de arriba.'
                    : 'Esta asignatura aún no tiene tareas.'
                }
              />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {assignments?.map((a) => {
                const active = a.id === selectedId;
                const overdue = isOverdue(a.dueAt);
                const state = windowState(a.openAt, a.closeAt);
                const badge = WINDOW_BADGE[state];
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => selectAssignment(a.id)}
                    style={{
                      textAlign: 'left',
                      background: active
                        ? 'var(--color-accent-muted)'
                        : 'var(--color-bg-secondary)',
                      border: `1px solid ${
                        active
                          ? 'var(--color-accent-primary)'
                          : 'var(--color-border-primary)'
                      }`,
                      borderRadius: 12,
                      padding: '14px 16px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 14.5 }}>
                        {a.title}
                      </span>
                      <Badge variant={badge.variant} dot>
                        {badge.label}
                      </Badge>
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: overdue
                          ? 'var(--color-error)'
                          : 'var(--color-text-muted)',
                        marginTop: 3,
                      }}
                    >
                      {a.dueAt ? `Vence ${formatDateTime(a.dueAt)}` : 'Sin fecha límite'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Detail column ── */}
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
                Selecciona una tarea para ver el detalle.
              </p>
            ) : (
              <AssignmentDetail
                key={selected.id}
                assignment={selected}
                isStaff={isStaff}
                onChanged={refetchAssignments}
                onDeleted={() => {
                  setSelectedId(null);
                  refetchAssignments();
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AssignmentDetail({
  assignment,
  isStaff,
  onChanged,
  onDeleted,
}: {
  assignment: AssignmentDTO;
  isStaff: boolean;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const { remove, isLoading: deleting } = useDeleteAssignment();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Students-only: load the acting user's own submission for this assignment.
  const {
    data: mine,
    isLoading: mineLoading,
    refetch: refetchMine,
  } = useMySubmission(isStaff ? null : assignment.id);

  const state = windowState(assignment.openAt, assignment.closeAt);
  const badge = WINDOW_BADGE[state];

  async function handleDelete() {
    try {
      await remove(assignment.id);
      toast({ variant: 'success', message: 'Tarea eliminada.' });
      setConfirmDelete(false);
      onDeleted();
    } catch (err) {
      toast({
        variant: 'error',
        message:
          err instanceof Error ? err.message : 'No se pudo eliminar la tarea.',
      });
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
              {assignment.title}
            </h2>
            <Badge variant={badge.variant} dot>
              {badge.label}
            </Badge>
          </div>
        </div>
        {isStaff && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Borrar
            </Button>
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: 13,
          color: 'var(--color-text-muted)',
          marginBottom: 16,
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        <span>
          {assignment.openAt ? `Abre ${formatDateTime(assignment.openAt)} · ` : ''}
          {assignment.dueAt
            ? `Entrega ${formatDateTime(assignment.dueAt)}`
            : 'Sin fecha límite'}
          {assignment.closeAt ? ` · Cierra ${formatDateTime(assignment.closeAt)}` : ''}
        </span>
        <span>· {assignment.maxScore} pts</span>
      </div>

      {assignment.description && (
        <p
          style={{
            fontSize: 14.5,
            lineHeight: 1.55,
            color: 'var(--color-text-secondary)',
            whiteSpace: 'pre-wrap',
            marginBottom: 18,
          }}
        >
          {assignment.description}
        </p>
      )}

      <AssignmentAttachments files={assignment.files ?? []} />

      <div
        style={{
          borderTop: '1px solid var(--color-border-primary)',
          paddingTop: 18,
          marginTop: 18,
        }}
      >
        {isStaff ? (
          <>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>
              Entregas
            </h3>
            <SubmissionsList assignment={assignment} />
          </>
        ) : mineLoading ? (
          <Spinner size="md" label="Cargando tu entrega…" />
        ) : (
          <SubmissionForm
            assignment={assignment}
            submission={mine}
            onSubmitted={refetchMine}
          />
        )}
      </div>

      {/* Edit modal (staff) */}
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Editar tarea"
        size="lg"
      >
        <AssignmentForm
          courseId={assignment.subjectId}
          initial={assignment}
          inModal
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      </Modal>

      {/* Delete confirmation (staff) */}
      <ConfirmDialog
        open={confirmDelete}
        title="Borrar tarea"
        message={`¿Seguro que quieres borrar «${assignment.title}»? Se eliminarán también sus entregas. Esta acción no se puede deshacer.`}
        confirmLabel="Borrar"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
