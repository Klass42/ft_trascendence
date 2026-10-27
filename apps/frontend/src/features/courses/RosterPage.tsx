import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Minus } from 'lucide-react';
import { Avatar, EmptyState, Spinner } from '@/components/ui';
import { useEnrollments, useLessonProgress, useSections, useUsersByIds } from '@/lib/api';
import styles from './RosterPage.module.css';

/**
 * Roster for subject staff: students of the parent cohort, with their overall
 * progress and, per student, which lessons they have completed.
 * Teachers cannot add members here.
 */
export function RosterPage({ courseId }: { courseId: string }) {
  const { data: enrollments, isLoading: enrollLoading, error: enrollError } = useEnrollments(courseId);
  const userIds = useMemo(() => (enrollments ?? []).map((enrollment) => enrollment.userId), [enrollments]);
  const { data: users, isLoading: usersLoading } = useUsersByIds(userIds);
  const { data: sections } = useSections(courseId);
  const { data: lessonProgress, isLoading: progressLoading, error: progressError } = useLessonProgress(courseId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!enrollments || !users) return [];
    const userMap = new Map(users.map((user) => [user.id, user]));
    return enrollments.map((enrollment) => {
      const user = userMap.get(enrollment.userId);
      return {
        id: enrollment.id,
        userId: enrollment.userId,
        name: user?.name ?? enrollment.userId,
        email: user?.email ?? '',
        avatarUrl: user?.avatarUrl ?? null,
        progress: enrollment.progress ?? 0,
      };
    });
  }, [enrollments, users]);

  const completedByUser = useMemo(
    () => new Map((lessonProgress ?? []).map((item) => [item.userId, new Set(item.completedLessonIds)])),
    [lessonProgress],
  );
  const lessonCount = useMemo(
    () => (sections ?? []).reduce((total, section) => total + (section.lessons?.length ?? 0), 0),
    [sections],
  );

  if (enrollLoading || usersLoading) return <Spinner label="Cargando alumnos" />;
  if (enrollError) return <EmptyState title="No se pudo cargar el listado" description={enrollError.message} />;
  if (rows.length === 0) return <EmptyState title="Sin alumnos" description="Nadie está matriculado en este curso." />;

  return (
    <div className={styles.roster}>
      {rows.map((row) => {
        const expanded = expandedId === row.id;
        const detailId = `roster-detail-${row.id}`;
        const completed = completedByUser.get(row.userId);
        return (
          <div key={row.id} className={styles.rosterItem}>
            <button
              type="button"
              className={styles.rosterRow}
              aria-expanded={expanded}
              aria-controls={detailId}
              onClick={() => setExpandedId(expanded ? null : row.id)}
            >
              {expanded
                ? <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
                : <ChevronRight size={16} aria-hidden="true" className={styles.chevron} />}
              <div className={styles.userCell}>
                <Avatar src={row.avatarUrl} size="sm" />
                <div className={styles.userDetails}>
                  <div className={styles.name}>{row.name}</div>
                  <div className={styles.email}>{row.email}</div>
                </div>
              </div>
              <div className={styles.progressValue}>
                {completed && lessonCount > 0 && (
                  <span className={styles.progressCount}>{completed.size}/{lessonCount} · </span>
                )}
                {row.progress}%
              </div>
            </button>

            {expanded && (
              <div id={detailId} className={styles.detail}>
                {progressLoading && <Spinner label="Cargando progreso" />}
                {!progressLoading && (progressError || !completed) && (
                  <p className={styles.detailNote}>No se pudo cargar el detalle del progreso.</p>
                )}
                {!progressLoading && completed && lessonCount === 0 && (
                  <p className={styles.detailNote}>Esta asignatura aún no tiene lecciones.</p>
                )}
                {!progressLoading && completed && lessonCount > 0 && (sections ?? []).map((section) => (
                  (section.lessons?.length ?? 0) > 0 && (
                    <section key={section.id} className={styles.detailSection}>
                      <h3 className={styles.detailHeading}>{section.title}</h3>
                      <ul className={styles.lessonList}>
                        {section.lessons?.map((lesson) => {
                          const done = completed.has(lesson.id);
                          return (
                            <li key={lesson.id} className={styles.lessonItem}>
                              <span className={done ? styles.mark : `${styles.mark} ${styles.markPending}`}>
                                {done
                                  ? <Check size={14} strokeWidth={3} aria-hidden="true" />
                                  : <Minus size={14} aria-hidden="true" />}
                              </span>
                              <span className={styles.lessonName}>{lesson.title}</span>
                              <span className={styles.srOnly}>{done ? '(completada)' : '(pendiente)'}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
