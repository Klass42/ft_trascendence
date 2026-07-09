import { useEffect, useState } from 'react';
import { Button, Spinner } from '@/components/ui';
import {
  useCourses,
  useGradebook,
  downloadGradebookCsv,
} from '@/lib/api';
import type { GradebookCellDTO } from '@/lib/api';
import { STATUS_CHIP } from '@/features/assignments/helpers';
import { GradePanel, type GradeTarget } from './GradePanel';

/**
 * Staff gradebook: a students × assignments matrix of scores for a course, a
 * CSV export, and a grading modal opened by clicking a submitted cell. The
 * tenant is derived server-side from identity, so nothing here trusts a
 * client-supplied org.
 */
export function GradebookPage() {
  const { data: courses, isLoading: coursesLoading } = useCourses();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [target, setTarget] = useState<GradeTarget | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!courseId && courses && courses.length > 0) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId]);

  const {
    data: gradebook,
    isLoading,
    error,
    refetch,
  } = useGradebook(courseId);

  async function handleDownload() {
    if (!courseId) return;
    setDownloading(true);
    try {
      await downloadGradebookCsv(courseId);
    } catch {
      alert('No se pudo descargar el CSV.');
    } finally {
      setDownloading(false);
    }
  }

  function openCell(
    cell: GradebookCellDTO,
    studentName: string,
    assignmentTitle: string,
    maxScore: number,
  ) {
    if (!cell.submissionId) return; // nothing to grade yet
    setTarget({
      submissionId: cell.submissionId,
      studentName,
      assignmentTitle,
      maxScore,
      initialScore: cell.score,
    });
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
          Calificaciones
        </h1>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {courses && courses.length > 0 && (
            <select
              value={courseId ?? ''}
              onChange={(e) => setCourseId(e.target.value)}
              style={{
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
          <Button
            variant="secondary"
            onClick={handleDownload}
            loading={downloading}
            disabled={!gradebook || gradebook.students.length === 0}
          >
            Descargar CSV
          </Button>
        </div>
      </div>

      {coursesLoading && <Spinner size="md" label="Cargando cursos…" />}

      {!coursesLoading && (!courses || courses.length === 0) && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          No hay cursos disponibles.
        </p>
      )}

      {isLoading && <Spinner size="md" label="Cargando gradebook…" />}

      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: 14 }}>
          No se pudo cargar el gradebook (¿eres profesor de este curso?).
        </p>
      )}

      {gradebook && !isLoading && (
        <>
          {gradebook.assignments.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
              Este curso no tiene tareas todavía.
            </p>
          ) : gradebook.students.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
              No hay alumnos inscritos en este curso.
            </p>
          ) : (
            <div
              style={{
                overflowX: 'auto',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 13,
                background: 'var(--color-bg-secondary)',
              }}
            >
              <table
                style={{
                  borderCollapse: 'collapse',
                  width: '100%',
                  fontSize: 13.5,
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle('left')}>Alumno</th>
                    {gradebook.assignments.map((a) => (
                      <th key={a.id} style={thStyle('center')} title={a.title}>
                        <div style={{ fontWeight: 700 }}>{a.title}</div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--color-text-muted)',
                            fontWeight: 500,
                          }}
                        >
                          / {a.maxScore}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gradebook.students.map((row) => (
                    <tr key={row.user.id}>
                      <td style={tdStyle('left')}>
                        <div style={{ fontWeight: 600 }}>{row.user.name}</div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          {row.user.email}
                        </div>
                      </td>
                      {row.cells.map((cell) => {
                        const assignment = gradebook.assignments.find(
                          (a) => a.id === cell.assignmentId,
                        )!;
                        const gradable = !!cell.submissionId;
                        const chip = cell.status
                          ? STATUS_CHIP[cell.status]
                          : STATUS_CHIP.NONE;
                        return (
                          <td
                            key={cell.assignmentId}
                            style={{
                              ...tdStyle('center'),
                              cursor: gradable ? 'pointer' : 'default',
                            }}
                            onClick={() =>
                              openCell(
                                cell,
                                row.user.name,
                                assignment.title,
                                assignment.maxScore,
                              )
                            }
                            title={
                              gradable
                                ? 'Clic para calificar'
                                : 'Sin entrega'
                            }
                          >
                            {cell.score != null ? (
                              <span style={{ fontWeight: 800, fontSize: 15 }}>
                                {cell.score}
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: chip.fg,
                                  background: chip.bg,
                                  padding: '3px 8px',
                                  borderRadius: 20,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {chip.label}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {target && (
        <GradePanel
          target={target}
          onClose={() => setTarget(null)}
          onGraded={() => {
            setTarget(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function thStyle(align: 'left' | 'center'): React.CSSProperties {
  return {
    textAlign: align,
    padding: '12px 14px',
    background: 'var(--color-bg-primary)',
    borderBottom: '1px solid var(--color-border-primary)',
    fontSize: 12.5,
    fontWeight: 700,
    color: 'var(--color-text-secondary)',
    position: 'sticky',
    top: 0,
    whiteSpace: 'nowrap',
  };
}

function tdStyle(align: 'left' | 'center'): React.CSSProperties {
  return {
    textAlign: align,
    padding: '12px 14px',
    borderBottom: '1px solid var(--color-border-primary)',
    verticalAlign: 'middle',
  };
}
