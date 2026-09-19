import { useEffect, useState } from 'react';
import { Badge, EmptyState, Select, Spinner } from '@/components/ui';
import { formatFinalPercent, useAuth, useCourses, useMyGrades } from '@/lib/api';
import type { MyGradeDTO } from '@/lib/api';
import { formatDate } from '@/features/assignments/helpers';
import { ATTEMPT_STATUS_BADGE } from '@/features/activities/helpers';
import { GradebookPage } from '@/features/gradebook';

/**
 * Grades route. Staff get the full gradebook; a student sees their own
 * published/archived tasks plus the course final.
 */
export function GradesPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  if (isStaff) {
    return <GradebookPage />;
  }
  return <StudentGrades />;
}

function StudentGrades() {
  const { data: courses, isLoading: coursesLoading } = useCourses();
  const [courseId, setCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId && courses && courses.length > 0) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId]);

  const { data, isLoading, error } = useMyGrades(courseId);
  const grades = data?.items ?? null;

  return (
    <div style={{ padding: '30px 40px', maxWidth: 820 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <h1
          style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            margin: 0,
          }}
        >
          Mis notas
        </h1>

        {courses && courses.length > 0 && (
          <div style={{ marginLeft: 'auto', minWidth: 220 }}>
            <Select
              aria-label="Curso"
              value={courseId ?? ''}
              onChange={(e) => setCourseId(e.target.value)}
              options={courses.map((c) => ({ value: c.id, label: c.title }))}
            />
          </div>
        )}
      </div>

      {coursesLoading && <Spinner size="md" label="Cargando cursos…" />}

      {!coursesLoading && (!courses || courses.length === 0) && (
        <EmptyState
          title="No estás inscrito en ningún curso"
          description="Cuando te matricules, verás aquí tus notas."
        />
      )}

      {isLoading && <Spinner size="md" label="Cargando notas…" />}

      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: 14 }}>
          No se pudieron cargar tus notas.
        </p>
      )}

      {grades && !isLoading && (
        <div
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 13,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.6fr .8fr .6fr',
              gap: 8,
              padding: '12px 18px',
              background: 'var(--color-bg-primary)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '.04em',
            }}
          >
            <span>Tarea</span>
            <span>Estado</span>
            <span style={{ textAlign: 'right' }}>Nota</span>
          </div>

          {grades.length === 0 && (
            <EmptyState
              title="Aún no hay notas"
              description="Este curso no tiene tareas publicadas."
            />
          )}

          {grades.map((g) => (
            <GradeRow key={g.activityId} grade={g} />
          ))}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderTop: '1px solid var(--color-border-primary)',
              fontWeight: 700,
            }}
          >
            <span>Nota final</span>
            <span>{formatFinalPercent(data?.final ?? null)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function GradeRow({ grade }: { grade: MyGradeDTO }) {
  const badge = grade.status ? ATTEMPT_STATUS_BADGE[grade.status] : null;
  const isGraded = grade.status === 'GRADED' && grade.score != null;

  return (
    <div
      style={{
        borderTop: '1px solid var(--color-border-primary)',
        padding: '14px 18px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr .8fr .6fr',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>
            {grade.title}{' '}
            {grade.countsTowardFinal === false && (
              <Badge variant="neutral">Práctica</Badge>
            )}
          </div>
          {grade.dueAt && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Vence {formatDate(grade.dueAt)}
            </div>
          )}
        </div>
        {badge ? (
          <Badge variant={badge.variant}>{badge.label}</Badge>
        ) : (
          <Badge variant="neutral">Sin entregar</Badge>
        )}
        <span
          style={{
            textAlign: 'right',
            fontSize: 16,
            fontWeight: 800,
            color: isGraded ? 'var(--color-success)' : 'var(--color-text-muted)',
          }}
        >
          {isGraded ? `${grade.score}/${grade.maxScore}` : '—'}
        </span>
      </div>

      {isGraded && grade.feedback && (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 13.5,
            lineHeight: 1.5,
            color: 'var(--color-text-secondary)',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 9,
            padding: '10px 12px',
            whiteSpace: 'pre-wrap',
          }}
        >
          <strong style={{ fontWeight: 700 }}>Feedback:</strong> {grade.feedback}
        </p>
      )}
    </div>
  );
}
