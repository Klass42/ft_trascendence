import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner } from '@/components/ui';
import {
  useMySubjects,
  useAnalyticsOverview,
  useSubmissionsOverTime,
  useGradeDistribution,
  downloadAnalyticsCsv,
  subjectSelectorLabel,
} from '@/lib/api';
import { useNotifications } from '@/features/notifications';
import type { AnalyticsActivityType } from '@/lib/api';
import { KpiTiles } from './KpiTiles';
import { SubmissionsLineChart } from './charts/SubmissionsLineChart';
import { GradeDistributionChart } from './charts/GradeDistributionChart';
import { DeliveryStatusChart } from './charts/DeliveryStatusChart';
import {
  ACTIVITY_TYPE_OPTIONS,
  activityTypeLabel,
  describeRange,
  isoDaysAgo,
  shiftDate,
  validateRange,
} from './filters';
import styles from './analytics.module.css';

/**
 * Staff analytics dashboard for a course (Epic 6, a Data-and-Analytics major):
 * a KPI row and three interactive charts (submissions over time, grade
 * distribution, delivery status) under one shared filter bar (date range +
 * activity type), plus CSV and PDF export that honour the same filters. The
 * tenant is derived server-side from identity; non-staff get 403/404 and see
 * an error card.
 */
export function AnalyticsPage() {
  const { data: courses, isLoading: coursesLoading } = useMySubjects();
  const { analyticsUpdate } = useNotifications();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Filters shared by the KPIs, the three charts and both exports. The range
  // defaults to the last 30 days; clearing it shows the whole subject.
  const [from, setFrom] = useState(() => isoDaysAgo(30));
  const [to, setTo] = useState(() => isoDaysAgo(0));
  const [type, setType] = useState<'' | AnalyticsActivityType>('');

  useEffect(() => {
    if (!courseId && courses && courses.length > 0) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId]);

  const rangeError = useMemo(() => validateRange(from, to), [from, to]);
  const filters = useMemo(
    () => ({ from: from || undefined, to: to || undefined, type: type || undefined }),
    [from, to, type],
  );
  // An invalid range is never sent: nothing is requested until it is fixed.
  const activeCourseId = rangeError ? null : courseId;
  const overview = useAnalyticsOverview(activeCourseId, filters);
  const overTime = useSubmissionsOverTime(activeCourseId, filters);
  const distribution = useGradeDistribution(activeCourseId, filters);

  useEffect(() => {
    if (!courseId || analyticsUpdate?.courseId !== courseId) return;
    const timer = window.setTimeout(() => {
      overview.refetch();
      overTime.refetch();
      distribution.refetch();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [analyticsUpdate, courseId, overview.refetch, overTime.refetch, distribution.refetch]);

  async function handleCsv() {
    if (!courseId) return;
    setDownloading(true);
    try {
      await downloadAnalyticsCsv(courseId, filters);
    } catch {
      alert('No se pudo descargar el CSV.');
    } finally {
      setDownloading(false);
    }
  }

  async function handlePdf() {
    if (!reportRef.current || !overview.data) return;
    setExportingPdf(true);
    try {
      // Loaded on demand: jsPDF + svg2pdf stay out of the main bundle.
      const { downloadAnalyticsPdf } = await import('./exportPdf');
      await downloadAnalyticsPdf({
        container: reportRef.current,
        overview: overview.data,
        rangeLabel: describeRange(from, to),
        typeLabel: activityTypeLabel(type),
        rangeNote: RANGE_NOTE,
      });
    } catch {
      alert('No se pudo generar el PDF.');
    } finally {
      setExportingPdf(false);
    }
  }

  // Keep showing the previous figures while a new filter is loading (no flicker),
  // but never those of another subject.
  const data = overview.data?.course.id === courseId ? overview.data : null;
  const ready = Boolean(data && distribution.data && overTime.data) && !rangeError;
  const hasFilters = Boolean(from || to || type);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analíticas</h1>

        <div className={styles.actions}>
          {courses && courses.length > 0 && (
            <select
              className={styles.select}
              value={courseId ?? ''}
              onChange={(e) => setCourseId(e.target.value)}
              aria-label="Asignatura"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {subjectSelectorLabel(c)}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="secondary"
            onClick={handleCsv}
            loading={downloading}
            disabled={!data || Boolean(rangeError)}
          >
            Exportar CSV
          </Button>
          <Button
            variant="secondary"
            onClick={handlePdf}
            loading={exportingPdf}
            disabled={!ready}
          >
            Descargar PDF
          </Button>
        </div>
      </div>

      {coursesLoading && <Spinner size="md" label="Cargando asignaturas…" />}

      {!coursesLoading && (!courses || courses.length === 0) && (
        <p className={styles.muted}>No hay asignaturas disponibles.</p>
      )}

      {courseId && (
        <div className={styles.filters} role="group" aria-label="Filtros">
          <div className={styles.filterField}>
            <label className={styles.rangeLabel} htmlFor="from">
              Desde
            </label>
            <input
              id="from"
              type="date"
              className={styles.dateInput}
              value={from}
              max={to || undefined}
              min={to ? shiftDate(to, -366) : undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className={styles.filterField}>
            <label className={styles.rangeLabel} htmlFor="to">
              Hasta
            </label>
            <input
              id="to"
              type="date"
              className={styles.dateInput}
              value={to}
              min={from || undefined}
              max={from ? shiftDate(from, 366) : undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className={styles.filterField}>
            <label className={styles.rangeLabel} htmlFor="activity-type">
              Tipo de actividad
            </label>
            <select
              id="activity-type"
              className={styles.filterSelect}
              value={type}
              onChange={(e) => setType(e.target.value as '' | AnalyticsActivityType)}
            >
              {ACTIVITY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFrom('');
              setTo('');
              setType('');
            }}
            disabled={!hasFilters}
          >
            Quitar filtros
          </Button>
        </div>
      )}

      {rangeError && <p className={styles.error}>{rangeError}</p>}

      {courseId && !rangeError && overview.isLoading && !data && (
        <Spinner size="md" label="Cargando analíticas…" />
      )}

      {overview.error && !rangeError && (
        <p className={styles.error}>
          No se pudieron cargar las analíticas (¿eres profesor de esta asignatura?).
        </p>
      )}

      {data && !rangeError && (
        <div ref={reportRef}>
          <h2 className={`${styles.cardTitle} ${styles.reportTitle}`}>
            {data.course.title}
          </h2>
          <p className={styles.filterSummary}>
            {describeRange(from, to)} · {activityTypeLabel(type)}. {RANGE_NOTE}
          </p>

          <KpiTiles overview={data} />

          <div className={styles.charts}>
            <section className={styles.card} data-pdf-chart="submissions">
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>Entregas en el tiempo</h3>
              </div>

              {overTime.error ? (
                <p className={styles.error}>No se pudo cargar la serie.</p>
              ) : overTime.data ? (
                <SubmissionsLineChart series={overTime.data.series} />
              ) : (
                <Spinner size="sm" label="Cargando…" />
              )}
            </section>

            <section className={styles.card} data-pdf-chart="grades">
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>Distribución de notas</h3>
              </div>

              {distribution.error ? (
                <p className={styles.error}>No se pudo cargar la distribución.</p>
              ) : distribution.data ? (
                <GradeDistributionChart buckets={distribution.data.buckets} />
              ) : (
                <Spinner size="sm" label="Cargando…" />
              )}
            </section>

            <section className={styles.card} data-pdf-chart="status">
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>Estado de entregas</h3>
              </div>

              <DeliveryStatusChart
                graded={data.submissions.graded}
                pending={data.submissions.pending}
                undelivered={data.submissions.expected - data.submissions.total}
              />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

/** What the range means for the figures (also printed in the PDF). */
const RANGE_NOTE =
  'Con un rango, las entregas y notas cuentan los intentos enviados en esas fechas; ' +
  'las lecciones completadas y el foro, la actividad registrada en ellas.';

