import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Spinner } from '@/components/ui';
import {
  useAuth,
  useCourses,
  useAssignments,
  useMySubmission,
} from '@/lib/api';
import type { AssignmentDTO } from '@/lib/api';
import { formatDate, isOverdue } from './helpers';
import { SubmissionForm } from './SubmissionForm';
import { SubmissionsList } from './SubmissionsList';
import { CreateAssignmentForm } from './CreateAssignmentForm';

/**
 * Assignments workspace, connected to the real API.
 *
 * A course selector scopes the list; picking an assignment opens its detail.
 * Students see their submission + a submit form; staff (teacher/assistant) can
 * create assignments and review every submission. The tenant is derived
 * server-side from identity, so nothing here trusts a client-supplied org.
 */
export function AssignmentsPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const { data: courses, isLoading: coursesLoading } = useCourses();
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
          <select
            value={courseId ?? ''}
            onChange={(e) => {
              setCourseId(e.target.value);
              setSelectedId(null);
              setCreating(false);
            }}
            style={{
              marginLeft: 'auto',
              padding: '8px 12px',
              borderRadius: 9,
              border: '1px solid var(--color-border-primary)',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {coursesLoading && <Spinner size="md" label="Cargando cursos…" />}

      {!coursesLoading && (!courses || courses.length === 0) && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          No hay cursos disponibles.
        </p>
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
                  <CreateAssignmentForm
                    courseId={courseId}
                    onCreated={() => {
                      setCreating(false);
                      refetchAssignments();
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
                No se pudieron cargar las tareas (¿estás inscrito en este curso?).
              </p>
            )}

            {assignments && assignments.length === 0 && !assignmentsLoading && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                Este curso no tiene tareas todavía.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {assignments?.map((a) => {
                const active = a.id === selectedId;
                const overdue = isOverdue(a.dueAt);
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
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                      {a.title}
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
                      {a.dueAt ? `Vence ${formatDate(a.dueAt)}` : 'Sin fecha límite'}
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
}: {
  assignment: AssignmentDTO;
  isStaff: boolean;
}) {
  // Students-only: load the acting user's own submission for this assignment.
  const {
    data: mine,
    isLoading: mineLoading,
    refetch: refetchMine,
  } = useMySubmission(isStaff ? null : assignment.id);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>
        {assignment.title}
      </h2>
      <div
        style={{
          fontSize: 13,
          color: 'var(--color-text-muted)',
          marginBottom: 16,
        }}
      >
        {assignment.dueAt
          ? `Fecha límite: ${formatDate(assignment.dueAt)}`
          : 'Sin fecha límite'}{' '}
        · {assignment.maxScore} pts
      </div>

      {assignment.description && (
        <p
          style={{
            fontSize: 14.5,
            lineHeight: 1.55,
            color: 'var(--color-text-secondary)',
            whiteSpace: 'pre-wrap',
            marginBottom: 22,
          }}
        >
          {assignment.description}
        </p>
      )}

      <div
        style={{
          borderTop: '1px solid var(--color-border-primary)',
          paddingTop: 18,
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
    </div>
  );
}
