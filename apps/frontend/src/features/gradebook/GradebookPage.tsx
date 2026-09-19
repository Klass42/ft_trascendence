import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  Select,
  Spinner,
  Table,
  useToast,
} from '@/components/ui';
import {
  downloadGradebookCsv,
  formatFinalPercent,
  useCourses,
  useGradebook,
} from '@/lib/api';
import type { GradebookCellDTO, GradebookItemDTO, GradebookRowDTO } from '@/lib/api';
import { ATTEMPT_STATUS_BADGE } from '@/features/activities/helpers';
import { GradePanel, type GradeTarget } from './GradePanel';

/**
 * Staff gradebook: students × activities, CSV export, grading modal on a
 * submitted cell. Tenant is derived server-side.
 */
export function GradebookPage() {
  const { toast } = useToast();
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
      toast({ variant: 'error', message: 'No se pudo descargar el CSV.' });
    } finally {
      setDownloading(false);
    }
  }

  function openCell(cell: GradebookCellDTO, studentName: string, item: GradebookItemDTO) {
    if (!cell.attemptId) return;
    setTarget({
      attemptId: cell.attemptId,
      activityId: item.id,
      studentName,
      title: item.title,
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
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            margin: 0,
          }}
        >
          Calificaciones
        </h1>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {courses && courses.length > 0 && (
            <Select
              aria-label="Curso"
              value={courseId ?? ''}
              onChange={(e) => setCourseId(e.target.value)}
              options={courses.map((c) => ({ value: c.id, label: c.title }))}
            />
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
        <EmptyState
          title="No hay cursos disponibles"
          description="Cuando impartas un curso, su libro de notas aparecerá aquí."
        />
      )}

      {isLoading && <Spinner size="md" label="Cargando calificaciones…" />}

      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: 14 }}>
          No se pudo cargar el gradebook (¿eres profesor de este curso?).
        </p>
      )}

      {gradebook && !isLoading && (
        <>
          {gradebook.items.length === 0 ? (
            <EmptyState
              title="Este curso no tiene tareas todavía"
              description="Publica una tarea para ver columnas de notas."
            />
          ) : gradebook.students.length === 0 ? (
            <EmptyState
              title="No hay alumnos inscritos"
              description="Cuando se matriculen, verás una fila por alumno."
            />
          ) : (
            <Table
              columns={[
                {
                  key: 'student',
                  header: 'Alumno',
                  render: (row: GradebookRowDTO) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{row.user.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                        {row.user.email}
                      </div>
                    </div>
                  ),
                },
                ...gradebook.items.map((item) => ({
                  key: item.id,
                  header: (
                    <div>
                      <div>{item.title}</div>
                      <div style={{ fontWeight: 500, fontSize: 11, color: 'var(--color-text-muted)' }}>
                        / {item.maxScore}
                        {item.countsTowardFinal === false ? ' · práctica' : ''}
                      </div>
                    </div>
                  ),
                  align: 'center' as const,
                  render: (row: GradebookRowDTO) => {
                    const cell = row.cells.find((c) => c.activityId === item.id);
                    if (!cell) return '—';
                    return (
                      <Cell
                        cell={cell}
                        item={item}
                        onClick={() => openCell(cell, row.user.name, item)}
                      />
                    );
                  },
                })),
                {
                  key: 'final',
                  header: 'Nota final',
                  align: 'center' as const,
                  render: (row: GradebookRowDTO) => (
                    <strong>{formatFinalPercent(row.final)}</strong>
                  ),
                },
              ]}
              data={gradebook.students}
              rowKey={(row) => row.user.id}
            />
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

function Cell({
  cell,
  item,
  onClick,
}: {
  cell: GradebookCellDTO;
  item: GradebookItemDTO;
  onClick: () => void;
}) {
  const gradable = !!cell.attemptId;
  const badge = cell.status ? ATTEMPT_STATUS_BADGE[cell.status] : null;
  return (
    <button
      type="button"
      onClick={gradable ? onClick : undefined}
      disabled={!gradable}
      title={gradable ? 'Clic para calificar' : 'Sin intento'}
      style={{
        background: 'none',
        border: 0,
        cursor: gradable ? 'pointer' : 'default',
        fontFamily: 'inherit',
        padding: 0,
      }}
    >
      {cell.score != null ? (
        <span style={{ fontWeight: 800, fontSize: 15 }}>{cell.score}</span>
      ) : badge ? (
        <Badge variant={badge.variant}>{badge.label}</Badge>
      ) : (
        <Badge variant="neutral">Sin entregar</Badge>
      )}
      {item.countsTowardFinal === false && cell.score != null && (
        <div>
          <Badge variant="neutral">Práctica</Badge>
        </div>
      )}
    </button>
  );
}
