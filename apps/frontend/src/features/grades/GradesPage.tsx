import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui';
import { useAuth, useCourses, useMyGrades } from '@/lib/api';
import type { MyGradeDTO } from '@/lib/api';
import { STATUS_CHIP, formatDate } from '@/features/assignments/helpers';
import { GradebookPage } from '@/features/gradebook';

/**
 * Grades route. Staff (teacher/admin) get the full gradebook; a student sees
 * their own grades per course, backed by the real API (Epic C).
 */
export function GradesPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  if (isStaff) {
    return <GradebookPage />;
  }
  return <StudentGrades />;
}

// ---------------------------------------------------------------------------

function StudentGrades() {
  const { data: courses, isLoading: coursesLoading } = useCourses();
  const [courseId, setCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId && courses && courses.length > 0) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId]);

  const { data: grades, isLoading, error } = useMyGrades(courseId);

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
            fontSize: 26,
            fontWeight: 800,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Mis notas
        </h1>

        {courses && courses.length > 0 && (
          <select
            value={courseId ?? ''}
            onChange={(e) => setCourseId(e.target.value)}
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
          No estás inscrito en ningún curso.
        </p>
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
            <span>Evaluación</span>
            <span>Estado</span>
            <span style={{ textAlign: 'right' }}>Nota</span>
          </div>

          {grades.length === 0 && (
            <div
              style={{
                padding: '16px 18px',
                fontSize: 14,
                color: 'var(--color-text-muted)',
              }}
            >
              Este curso no tiene tareas todavía.
            </div>
          )}

          {grades.map((g) => (
            <GradeRow key={g.assignmentId} grade={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function GradeRow({ grade }: { grade: MyGradeDTO }) {
  const chip = grade.status ? STATUS_CHIP[grade.status] : STATUS_CHIP.NONE;
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
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>{grade.title}</div>
          {grade.dueAt && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Vence {formatDate(grade.dueAt)}
            </div>
          )}
        </div>
        <span
          style={{
            justifySelf: 'start',
            fontSize: 11.5,
            fontWeight: 700,
            color: chip.fg,
            background: chip.bg,
            padding: '4px 10px',
            borderRadius: 20,
            whiteSpace: 'nowrap',
          }}
        >
          {chip.label}
        </span>
        <span
          style={{
            textAlign: 'right',
            fontSize: 16,
            fontWeight: 800,
            color: isGraded ? '#0f766e' : 'var(--color-text-muted)',
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
