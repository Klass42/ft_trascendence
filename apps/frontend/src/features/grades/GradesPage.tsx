import { useEffect, useState } from 'react';
import { Badge, EmptyState, Select, Spinner } from '@/components/ui';
import { formatFinalPercent, subjectSelectorLabel, useAuth, useMySubjects, useMyGrades } from '@/lib/api';
import type { MyGradeDTO } from '@/lib/api';
import { formatDate } from '@/features/assignments/helpers';
import { ATTEMPT_STATUS_BADGE } from '@/features/activities/helpers';
import { GradebookPage } from '@/features/gradebook';
import styles from './GradesPage.module.css';

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
  const { data: courses, isLoading: coursesLoading } = useMySubjects();
  const [courseId, setCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId && courses && courses.length > 0) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId]);

  const { data, isLoading, error } = useMyGrades(courseId);
  const grades = data?.items ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Mis notas</h1>

        {courses && courses.length > 0 && (
          <div className={styles.courseSelector}>
            <Select
              aria-label="Asignatura"
              value={courseId ?? ''}
              onChange={(e) => setCourseId(e.target.value)}
              options={courses.map((course) => ({ value: course.id, label: subjectSelectorLabel(course) }))}
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
          className={styles.gradeList}
        >
          <div className={styles.gradeHeader}>
            <span>Tarea</span>
            <span>Estado</span>
            <span>Nota</span>
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
              className={styles.finalGrade}
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
      className={styles.gradeRow}
    >
      <div className={styles.gradeCells}>
        <div className={styles.gradeTitle}>
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
        <span className={`${styles.gradeScore} ${isGraded ? styles.graded : ''}`}>
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
