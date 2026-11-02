import type { AnalyticsOverviewDTO } from '@/lib/api';
import { plural } from '@/lib/format';
import styles from './analytics.module.css';

interface Props {
  overview: AnalyticsOverviewDTO;
}

export interface KpiTile {
  label: string;
  value: string;
  hint?: string;
}

/** The headline KPI tiles derived from the overview response (also used by the PDF). */
export function buildKpiTiles(overview: AnalyticsOverviewDTO): KpiTile[] {
  return [
    {
      label: 'Alumnos',
      value: String(overview.students),
    },
    {
      label: 'Tareas',
      value: String(overview.assignments),
      hint: plural(overview.lessons, 'lección', 'lecciones'),
    },
    {
      label: 'Tasa de entrega',
      value: pct(overview.submissions.rate),
      hint: `${overview.submissions.total} de ${plural(overview.submissions.expected, 'entrega', 'entregas')}`,
    },
    {
      label: 'Nota media',
      value: overview.averageGrade != null ? `${overview.averageGrade}%` : '—',
      hint:
        overview.submissions.graded > 0
          ? plural(overview.submissions.graded, 'calificada', 'calificadas')
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
      hint: plural(overview.forum.threads, 'hilo', 'hilos'),
    },
  ];
}

/** The row of headline KPI tiles. */
export function KpiTiles({ overview }: Props) {
  return (
    <div className={styles.kpiRow}>
      {buildKpiTiles(overview).map((t) => (
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
