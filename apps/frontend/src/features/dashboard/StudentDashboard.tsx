import { useMemo, type CSSProperties, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAuth,
  useMySubjects,
  useMyProgress,
  useMyPendingActivities,
} from '@/lib/api';
import type { MyProgressItem } from '@/lib/api';
import { DashboardHeader } from './DashboardHeader';
import styles from './StudentDashboard.module.css';

const COURSE_COLORS = [
  '#2563eb', '#0f766e', '#d97706', '#7c3aed',
  '#dc2626', '#0891b2', '#4f46e5', '#db2777',
];

function hashToColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length];
}

function formatDue(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs < 0) return 'vencida';
  const hours = Math.round(diffMs / 3600000);
  if (hours < 1) return 'menos de 1 h';
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'mañana' : `${days} días`;
}

export function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: allCourses, isLoading: coursesLoading } = useMySubjects();
  const { data: myProgress, isLoading: myProgressLoading } = useMyProgress();
  const progressLoading = myProgressLoading || coursesLoading;
  const { data: pending, isLoading: assignmentsLoading } = useMyPendingActivities();

  // Archived cohorts are history: they stay out of the cards and the average.
  const courses = useMemo(
    () => allCourses?.filter((c) => c.course.status !== 'ARCHIVED') ?? null,
    [allCourses],
  );

  const activeProgress = useMemo(() => {
    if (!myProgress || !courses) return [];
    const activeIds = new Set(courses.map((c) => c.id));
    return myProgress.filter((p: MyProgressItem) => activeIds.has(p.subjectId));
  }, [myProgress, courses]);

  const progressMap = useMemo(() => {
    const map: Record<string, number> = {};
    activeProgress.forEach((p: MyProgressItem) => { map[p.subjectId] = p.percentage; });
    return map;
  }, [activeProgress]);

  const avgProgress = useMemo(() => {
    if (activeProgress.length === 0) return 0;
    const sum = activeProgress.reduce((acc: number, p: MyProgressItem) => acc + p.percentage, 0);
    return Math.round(sum / activeProgress.length);
  }, [activeProgress]);

  // The backend already drops finished/closed work and sorts by deadline.
  const next = pending?.[0] ?? null;

  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference * (1 - avgProgress / 100);
  const userName = user?.name?.split(' ')[0] || '';

  const openNext = () => navigate('/activities');
  const onKeyActivate = (open: () => void) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };

  return (
    <>
      <DashboardHeader title={`Hola de nuevo, ${userName}`} roleLabel="Alumno" />

      <div className={styles.grid}>
        {/* Progress ring */}
        <div className={`${styles.card} ${styles.ringCard}`}>
          <div className={styles.ringTitle}>Progreso de lecciones</div>
          <div className={styles.muted}>Lecciones completadas en tus asignaturas activas</div>
          <div className={styles.ringBody}>
            <div className={styles.ring}>
              <svg width="128" height="128" viewBox="0 0 120 120" aria-hidden="true">
                <circle className={styles.ringTrack} cx="60" cy="60" r="52" fill="none" strokeWidth="13" />
                <circle
                  className={styles.ringFill}
                  cx="60" cy="60" r="52"
                  fill="none"
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <span className={styles.ringValue} data-testid="progress-ring-value">
                {progressLoading ? '–' : `${avgProgress}%`}
              </span>
            </div>
            {!progressLoading && activeProgress.length > 0 && (
              <div className={styles.legend}>
                {activeProgress.map((p: MyProgressItem) => {
                  const course = courses?.find((c) => c.id === p.subjectId);
                  if (!course) return null;
                  return (
                    <div
                      key={p.subjectId}
                      className={styles.legendRow}
                      style={{ '--course-color': hashToColor(course.title) } as CSSProperties}
                    >
                      <span className={styles.dot} aria-hidden="true" />
                      <span data-testid="progress-row">
                        {`${course.title} · ${course.course.name} · ${course.course.academicYear}`} · {p.percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Average progress */}
        <div className={`${styles.card} ${styles.statCard}`}>
          <span className={styles.label}>PROMEDIO DE LECCIONES</span>
          <div className={styles.avgValue} data-testid="avg-progress">
            {progressLoading ? '–' : `${avgProgress}%`}
          </div>
        </div>

        {/* Next assignment */}
        <div
          role="link"
          tabIndex={0}
          aria-label={next ? `Próxima entrega: ${next.title}` : 'Ver entregas'}
          onClick={openNext}
          onKeyDown={onKeyActivate(openNext)}
          className={[
            styles.card,
            styles.statCard,
            styles.clickable,
            !assignmentsLoading && next ? styles.nextActive : '',
          ].filter(Boolean).join(' ')}
        >
          <div className={styles.nextHeader}>
            <span className={styles.label}>{next ? 'PRÓXIMA ENTREGA' : 'ENTREGAS'}</span>
            {next && next.dueAt && (
              <span className={styles.duePill}>{formatDue(next.dueAt)}</span>
            )}
          </div>
          <div>
            {assignmentsLoading ? (
              <div className={styles.muted}>Cargando…</div>
            ) : next ? (
              <>
                <div className={styles.nextTitle}>{next.title}</div>
                {next.description && <div className={styles.nextDescription}>{next.description}</div>}
              </>
            ) : (
              <div className={styles.muted}>No hay entregas pendientes</div>
            )}
          </div>
        </div>

        {/* Course cards */}
        {courses?.map((c) => {
          const pct = progressMap[c.id] ?? 0;
          const open = () => navigate(`/courses/${c.course.id}/subjects/${c.id}`);
          return (
            <div
              key={c.id}
              role="link"
              tabIndex={0}
              data-testid="course-card"
              aria-label={`${c.title} · ${c.course.name} · ${c.course.academicYear} · ${pct}%`}
              onClick={open}
              onKeyDown={onKeyActivate(open)}
              className={`${styles.card} ${styles.courseCard} ${styles.clickable}`}
              style={{ '--course-color': hashToColor(c.title) } as CSSProperties}
            >
              <div className={styles.courseInitial} aria-hidden="true">
                {c.title.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className={styles.courseTitle}>
                  {`${c.title} · ${c.course.name} · ${c.course.academicYear}`}
                </div>
                <div className={styles.bar}>
                  <div className={styles.barFill} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
