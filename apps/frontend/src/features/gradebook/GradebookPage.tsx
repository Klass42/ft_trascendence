import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  subjectSelectorLabel,
  useMySubjects,
  useGradebook,
} from '@/lib/api';
import type { GradebookCellDTO, GradebookItemDTO, GradebookRowDTO } from '@/lib/api';
import { ATTEMPT_STATUS_BADGE } from '@/features/activities/helpers';
import { GradePanel, type GradeTarget } from './GradePanel';
import styles from './GradebookPage.module.css';

/**
 * Staff gradebook: students × activities, CSV export, grading modal on a
 * submitted cell. Tenant is derived server-side. On narrow screens each student
 * becomes a card listing their tasks.
 *
 * Deep link (notifications, dashboard): `?subjectId=…&activityId=…[&attemptId=…]`
 * selects the subject, highlights and scrolls to the activity and opens the
 * grading panel for the given attempt, or for the only pending one of the activity.
 */
export function GradebookPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramSubjectId = searchParams.get('subjectId');
  const focusActivityId = searchParams.get('activityId');
  const focusAttemptId = searchParams.get('attemptId');
  const { data: courses, isLoading: coursesLoading } = useMySubjects();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [target, setTarget] = useState<GradeTarget | null>(null);
  const [downloading, setDownloading] = useState(false);
  const handledLink = useRef<string | null>(null);

  useEffect(() => {
    if (!courses || courses.length === 0) return;
    if (paramSubjectId && courses.some((course) => course.id === paramSubjectId)) {
      setCourseId(paramSubjectId);
    } else if (!courseId) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId, paramSubjectId]);

  const {
    data: gradebook,
    isLoading,
    error,
    refetch,
  } = useGradebook(courseId);

  // The deep link only applies to the subject it names; a manual subject change drops it.
  const focusId =
    gradebook && gradebook.course.id === courseId && (!paramSubjectId || paramSubjectId === courseId)
      ? focusActivityId
      : null;

  useEffect(() => {
    if (!focusActivityId) handledLink.current = null;
  }, [focusActivityId]);

  // Open the grading panel once per deep link, as soon as its gradebook is loaded.
  useEffect(() => {
    if (!gradebook || !focusId) return;
    const key = `${gradebook.course.id}|${focusId}|${focusAttemptId ?? ''}`;
    if (handledLink.current === key) return;
    handledLink.current = key;
    const item = gradebook.items.find((i) => i.id === focusId);
    if (!item) return;
    if (focusAttemptId) {
      const row = gradebook.students.find((s) =>
        s.cells.some((c) => c.attemptId === focusAttemptId),
      );
      setTarget({
        attemptId: focusAttemptId,
        activityId: item.id,
        studentName: row?.user.name ?? '',
        title: item.title,
      });
      return;
    }
    const pending = gradebook.students.flatMap((row) =>
      row.cells
        .filter((c) => c.activityId === item.id && c.status === 'SUBMITTED' && c.attemptId)
        .map((c) => ({ attemptId: c.attemptId as string, studentName: row.user.name })),
    );
    if (pending.length === 1) {
      setTarget({
        attemptId: pending[0].attemptId,
        activityId: item.id,
        studentName: pending[0].studentName,
        title: item.title,
      });
    }
  }, [gradebook, focusId, focusAttemptId]);

  // Bring the highlighted activity into view (column on desktop, task row in a card on mobile).
  useEffect(() => {
    if (!gradebook || !focusId) return;
    const frame = window.requestAnimationFrame(() => {
      const visible = Array.from(
        document.querySelectorAll<HTMLElement>('[data-gradebook-focus="true"]'),
      ).find((el) => el.offsetParent !== null);
      visible?.scrollIntoView({ block: 'center', inline: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [gradebook, focusId]);

  function handleCourseChange(nextId: string) {
    setCourseId(nextId);
    if (searchParams.size > 0) setSearchParams({}, { replace: true });
  }

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
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Calificaciones</h1>

        <div className={styles.actions}>
          {courses && courses.length > 0 && (
            <Select
              className={styles.courseSelect}
              aria-label="Asignatura"
              value={courseId ?? ''}
              onChange={(e) => handleCourseChange(e.target.value)}
              options={courses.map((course) => ({ value: course.id, label: subjectSelectorLabel(course) }))}
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

      {coursesLoading && <Spinner size="md" label="Cargando asignaturas…" />}

      {!coursesLoading && (!courses || courses.length === 0) && (
        <EmptyState
          title="No hay asignaturas disponibles"
          description="Cuando impartas una asignatura, sus calificaciones aparecerán aquí."
        />
      )}

      {isLoading && <Spinner size="md" label="Cargando calificaciones…" />}

      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: 14 }}>
          No se pudieron cargar las calificaciones (¿eres profesor de esta asignatura?).
        </p>
      )}

      {gradebook && !isLoading && (
        <>
          {gradebook.items.length === 0 ? (
            <EmptyState
              title="Esta asignatura no tiene tareas todavía"
              description="Publica una tarea para ver columnas de notas."
            />
          ) : gradebook.students.length === 0 ? (
            <EmptyState
              title="No hay alumnos inscritos"
              description="Cuando se matriculen, verás una fila por alumno."
            />
          ) : (
            <>
              <div className={styles.desktopTable}>
                <Table
                  columns={[
                    {
                      key: 'student',
                      header: 'Alumno',
                      render: (row: GradebookRowDTO) => (
                        <div className={styles.studentCell}>
                          <div className={styles.studentName}>
                            {row.user.name}
                            {row.deactivated && <> <Badge variant="neutral">Cuenta desactivada</Badge></>}
                          </div>
                          <div className={styles.studentEmail}>{row.user.email}</div>
                        </div>
                      ),
                    },
                    ...gradebook.items.map((item) => {
                      const focused = item.id === focusId;
                      return {
                        key: item.id,
                        className: focused ? styles.focusColumn : undefined,
                        header: (
                          <div data-gradebook-focus={focused ? 'true' : undefined}>
                            <div>{item.title}</div>
                            <div className={styles.itemMeta}>
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
                              studentName={row.user.name}
                              onClick={() => openCell(cell, row.user.name, item)}
                            />
                          );
                        },
                      };
                    }),
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
              </div>

              <div className={styles.mobileCards}>
                {gradebook.students.map((row) => (
                  <article key={row.user.id} className={styles.studentCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardIdentity}>
                        <h2 className={styles.cardName}>
                          {row.user.name}
                          {row.deactivated && <> <Badge variant="neutral">Cuenta desactivada</Badge></>}
                        </h2>
                        <p className={styles.studentEmail}>{row.user.email}</p>
                      </div>
                      <div className={styles.cardFinal}>
                        <span>Nota final</span>
                        <strong>{formatFinalPercent(row.final)}</strong>
                      </div>
                    </div>
                    <ul className={styles.taskList}>
                      {gradebook.items.map((item) => {
                        const cell = row.cells.find((c) => c.activityId === item.id);
                        const focused = item.id === focusId;
                        return (
                          <li
                            key={item.id}
                            className={[styles.taskRow, focused ? styles.focusRow : '']
                              .filter(Boolean)
                              .join(' ')}
                            data-gradebook-focus={focused ? 'true' : undefined}
                          >
                            <div className={styles.taskInfo}>
                              <span className={styles.taskTitle}>{item.title}</span>
                              <span className={styles.itemMeta}>
                                / {item.maxScore}
                                {item.countsTowardFinal === false ? ' · práctica' : ''}
                              </span>
                            </div>
                            {cell ? (
                              <Cell
                                cell={cell}
                                item={item}
                                studentName={row.user.name}
                                onClick={() => openCell(cell, row.user.name, item)}
                              />
                            ) : (
                              '—'
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                ))}
              </div>
            </>
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
  studentName,
  onClick,
}: {
  cell: GradebookCellDTO;
  item: GradebookItemDTO;
  studentName: string;
  onClick: () => void;
}) {
  const gradable = !!cell.attemptId;
  const pending = cell.status === 'SUBMITTED';
  const badge = cell.status ? ATTEMPT_STATUS_BADGE[cell.status] : null;
  const label = pending ? 'Calificar entrega' : 'Revisar calificación';
  const hint =
    pending && cell.partialScore != null
      ? `${label} (parte automática: ${cell.partialScore}/${item.maxScore})`
      : label;
  return (
    <button
      type="button"
      className={styles.cellButton}
      onClick={gradable ? onClick : undefined}
      disabled={!gradable}
      title={gradable ? hint : 'Sin intento'}
      aria-label={gradable ? `${label}: ${studentName}, ${item.title}` : undefined}
    >
      {pending && badge ? (
        <Badge variant={badge.variant}>{badge.label}</Badge>
      ) : cell.score != null ? (
        <span className={styles.score}>{cell.score}</span>
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
