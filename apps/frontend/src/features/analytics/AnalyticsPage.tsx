import { useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from '@/components/ui';
import {
  useMySubjects,
  useAnalyticsOverview,
  useSubmissionsOverTime,
  useGradeDistribution,
  downloadAnalyticsCsv,
} from '@/lib/api';
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
  const overTime = useSubmissionsOverTime(
    courseId,
    from || undefined,
    to || undefined,
  );
  const distribution = useGradeDistribution(courseId);

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

  const rangeInvalid = useMemo(
    () => Boolean(from && to && from > to),
    [from, to],
  );

  async function handleCsv() {
    if (!courseId) return;
    setDownloading(true);
    try {
      await downloadAnalyticsCsv(courseId);
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
              aria-label="Curso"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {`${c.title} · ${c.course.name} · ${c.course.academicYear}`}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="secondary"
            onClick={handleCsv}
            loading={downloading}
            disabled={!hasData}
          >
            Exportar CSV
          </Button>
          <Button variant="secondary" onClick={handlePdf} disabled={!hasData}>
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
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              </div>

              {rangeInvalid ? (
                <p className={styles.error}>
                  La fecha «Desde» no puede ser posterior a «Hasta».
                </p>
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
