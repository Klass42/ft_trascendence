import { useEffect, useMemo, useState } from 'react';
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
import { KpiTiles } from './KpiTiles';
import { SubmissionsLineChart } from './charts/SubmissionsLineChart';
import { GradeDistributionChart } from './charts/GradeDistributionChart';
import styles from './analytics.module.css';

/**
 * Staff analytics dashboard for a course (Epic 6, a Data-and-Analytics major):
 * a KPI row, an interactive submissions-over-time line chart with a date-range
 * filter, and a grade-distribution histogram — plus CSV and print-to-PDF
 * export. The tenant is derived server-side from identity; non-staff get 403/404
 * and see an error card.
 */
export function AnalyticsPage() {
  const { data: courses, isLoading: coursesLoading } = useMySubjects();
  const { analyticsUpdate } = useNotifications();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Date range for the time-series (defaults to the last 30 days).
  const [from, setFrom] = useState(() => isoDaysAgo(30));
  const [to, setTo] = useState(() => isoDaysAgo(0));

  useEffect(() => {
    if (!courseId && courses && courses.length > 0) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId]);

  const overview = useAnalyticsOverview(courseId);
  const rangeError = useMemo(() => validateRange(from, to), [from, to]);
  const overTime = useSubmissionsOverTime(
    rangeError ? null : courseId,
    from || undefined,
    to || undefined,
  );
  const distribution = useGradeDistribution(courseId);

  useEffect(() => {
    if (!courseId || analyticsUpdate?.courseId !== courseId) return;
    const timer = window.setTimeout(() => {
      overview.refetch();
      overTime.refetch();
      distribution.refetch();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [analyticsUpdate, courseId, overview.refetch, overTime.refetch, distribution.refetch]);

  // Toggle a body class only while printing so a normal Ctrl+P elsewhere is
  // unaffected by the dashboard's print stylesheet.
  useEffect(() => {
    const clear = () => document.body.classList.remove('analytics-printing');
    window.addEventListener('afterprint', clear);
    return () => {
      window.removeEventListener('afterprint', clear);
      clear();
    };
  }, []);

  async function handleCsv() {
    if (!courseId) return;
    setDownloading(true);
    try {
      await downloadAnalyticsCsv(courseId, from, to);
    } catch {
      alert('No se pudo descargar el CSV.');
    } finally {
      setDownloading(false);
    }
  }

  function handlePdf() {
    document.body.classList.add('analytics-printing');
    window.print();
    // Fallback for browsers that fire print synchronously without `afterprint`.
    document.body.classList.remove('analytics-printing');
  }

  const hasData = overview.data && !overview.isLoading;
  const anyError = overview.error;

  return (
    <div className={styles.page}>
      <div className={`${styles.header} ${styles.noPrint}`}>
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
            disabled={!hasData || Boolean(rangeError)}
          >
            Exportar CSV
          </Button>
          <Button variant="secondary" onClick={handlePdf} disabled={!hasData || Boolean(rangeError)}>
            Exportar PDF
          </Button>
        </div>
      </div>

      {coursesLoading && <Spinner size="md" label="Cargando cursos…" />}

      {!coursesLoading && (!courses || courses.length === 0) && (
        <p className={styles.muted}>No hay cursos disponibles.</p>
      )}

      {courseId && overview.isLoading && (
        <Spinner size="md" label="Cargando analíticas…" />
      )}

      {anyError && (
        <p className={styles.error}>
          No se pudieron cargar las analíticas (¿eres profesor de este curso?).
        </p>
      )}

      {hasData && overview.data && (
        <div className={styles.printArea}>
          <h2 className={styles.cardTitle} style={{ marginBottom: 16 }}>
            {overview.data.course.title}
          </h2>

          <KpiTiles overview={overview.data} />

          <div className={styles.charts}>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>Entregas en el tiempo</h3>
                <div className={`${styles.rangeControls} ${styles.noPrint}`}>
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
              </div>

              {rangeError ? (
                <p className={styles.error}>{rangeError}</p>
              ) : overTime.isLoading ? (
                <Spinner size="sm" label="Cargando…" />
              ) : overTime.error ? (
                <p className={styles.error}>No se pudo cargar la serie.</p>
              ) : overTime.data ? (
                <SubmissionsLineChart series={overTime.data.series} />
              ) : null}
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>Distribución de notas</h3>
              </div>

              {distribution.isLoading ? (
                <Spinner size="sm" label="Cargando…" />
              ) : distribution.error ? (
                <p className={styles.error}>
                  No se pudo cargar la distribución.
                </p>
              ) : distribution.data ? (
                <GradeDistributionChart buckets={distribution.data.buckets} />
              ) : null}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

/** ISO `YYYY-MM-DD` for `n` days before today (local time). */
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function validateRange(from: string, to: string): string | null {
  if (!from || !to) return null;
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 'Introduce un rango de fechas válido.';
  }
  if (start > end) return 'La fecha «Desde» debe ser anterior o igual a «Hasta».';
  if (end - start > 366 * 86_400_000) {
    return 'El rango de fechas no puede superar 366 días.';
  }
  return null;
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
