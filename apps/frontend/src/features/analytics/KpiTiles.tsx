import type { AnalyticsOverviewDTO } from '@/lib/api';
import styles from './analytics.module.css';

interface Props {
  overview: AnalyticsOverviewDTO;
}

/** The row of headline KPI tiles derived from the overview response. */
export function KpiTiles({ overview }: Props) {
  const tiles: Array<{ label: string; value: string; hint?: string }> = [
    {
      label: 'Alumnos',
      value: String(overview.students),
    },
    {
      label: 'Tareas',
      value: String(overview.assignments),
      hint: `${overview.lessons} lecciones`,
    },
    {
      label: 'Tasa de entrega',
      value: pct(overview.submissions.rate),
      hint: `${overview.submissions.total} de ${overview.submissions.expected} entregas`,
    },
    {
      label: 'Nota media',
      value: overview.averageGrade != null ? `${overview.averageGrade}%` : '—',
      hint:
        overview.submissions.graded > 0
          ? `${overview.submissions.graded} ${overview.submissions.graded === 1 ? 'calificada' : 'calificadas'}`
          : 'sin calificar',
    },
    {
      label: 'Lecciones completadas',
      value: pct(overview.lessonsCompletion.rate),
      hint: `${overview.lessonsCompletion.completed}/${overview.lessonsCompletion.expected}`,
    },
    {
      label: 'Actividad de foro',
      value: String(overview.forum.posts),
      hint: `${overview.forum.threads} ${overview.forum.threads === 1 ? 'hilo' : 'hilos'}`,
    },
  ];

  return (
    <div className={styles.kpiRow}>
      {tiles.map((t) => (
        <div key={t.label} className={styles.kpi}>
          <p className={styles.kpiLabel}>{t.label}</p>
          <div className={styles.kpiValue}>{t.value}</div>
          {t.hint && <div className={styles.kpiHint}>{t.hint}</div>}
        </div>
      ))}
    </div>
  );
}

/** A [0,1] rate as a whole-ish percentage string. */
function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
