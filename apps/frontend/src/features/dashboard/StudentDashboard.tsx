import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAuth,
  useCourses,
  useMyProgress,
  useUpcomingAssignments,
} from '@/lib/api';
import type { MyProgressItem, ActivityDTO } from '@/lib/api';
import { DashboardHeader } from './DashboardHeader';

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

function nextUpcoming(activities: ActivityDTO[]): ActivityDTO | null {
  const now = Date.now();
  const upcoming = activities
    .filter((a) => a.dueAt && new Date(a.dueAt).getTime() > now)
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());
  return upcoming[0] ?? null;
}

function formatDue(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const hours = Math.round(diffMs / 3600000);
  if (hours < 1) return 'menos de 1 h';
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'mañana' : `${days} días`;
}

export function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: courses } = useCourses('PUBLISHED');
  const { data: myProgress, isLoading: progressLoading } = useMyProgress();

  const courseIds = useMemo(() => courses?.map((c) => c.id) ?? [], [courses]);
  const { data: allAssignments, isLoading: assignmentsLoading } =
    useUpcomingAssignments(courseIds);

  const progressMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (myProgress) myProgress.forEach((p: MyProgressItem) => { map[p.courseId] = p.percentage; });
    return map;
  }, [myProgress]);

  const avgProgress = useMemo(() => {
    if (!myProgress || myProgress.length === 0) return 0;
    const sum = myProgress.reduce((acc: number, p: MyProgressItem) => acc + p.percentage, 0);
    return Math.round(sum / myProgress.length);
  }, [myProgress]);

  const next = useMemo(
    () => (allAssignments ? nextUpcoming(allAssignments) : null),
    [allAssignments],
  );

  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference * (1 - avgProgress / 100);
  const userName = user?.name?.split(' ')[0] || '';

  return (
    <>
      <DashboardHeader title={`Hola de nuevo, ${userName}`} roleLabel="Alumno" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          gridAutoRows: 134,
        }}
      >
        {/* Progress ring */}
        <div
          style={{
            gridColumn: '1/3',
            gridRow: '1/3',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 18,
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-text-secondary)',
            }}
          >
            Progreso del semestre
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: 128,
                height: 128,
                flex: 'none',
              }}
            >
              <svg width="128" height="128" viewBox="0 0 120 120">
                <circle
                  cx="60" cy="60" r="52"
                  fill="none"
                  stroke="var(--color-border-primary)"
                  strokeWidth="13"
                />
                <circle
                  cx="60" cy="60" r="52"
                  fill="none"
                  stroke="var(--color-accent-primary)"
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 31, fontWeight: 700 }}>
                  {progressLoading ? '–' : `${avgProgress}%`}
                </span>
              </div>
            </div>
            {!progressLoading && myProgress && myProgress.length > 0 && (
              <div>
                {myProgress.map((p: MyProgressItem) => {
                  const course = courses?.find((c) => c.id === p.courseId);
                  if (!course) return null;
                  const color = hashToColor(course.title);
                  return (
                    <div
                      key={p.courseId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: color,
                          flex: 'none',
                        }}
                      />
                      <span
                        style={{
                          fontSize: 12.5,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {course.title} · {p.percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Average progress */}
        <div
          style={{
            gridColumn: '3/4',
            gridRow: '1/2',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 18,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
            }}
          >
            PROGRESO PROMEDIO
          </span>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: 'var(--color-accent-primary)',
              lineHeight: 1,
            }}
          >
            {progressLoading ? '–' : `${avgProgress}%`}
          </div>
        </div>

        {/* Next assignment */}
        <div
          onClick={() => navigate('/activities')}
          style={{
            gridColumn: '3/4',
            gridRow: '2/3',
            background: assignmentsLoading
              ? 'var(--color-bg-secondary)'
              : next
                ? 'var(--color-accent-primary)'
                : 'var(--color-bg-secondary)',
            border: next
              ? 'none'
              : '1px solid var(--color-border-primary)',
            borderRadius: 18,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            color: next ? '#fff' : 'var(--color-text-primary)',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                opacity: next ? 0.82 : 0.6,
              }}
            >
              {next ? 'PRÓXIMA ENTREGA' : 'ENTREGAS'}
            </span>
            {next && next.dueAt && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  background: 'rgba(255,255,255,.18)',
                  padding: '3px 10px',
                  borderRadius: 20,
                }}
              >
                {formatDue(next.dueAt)}
              </span>
            )}
          </div>
          <div>
            {assignmentsLoading ? (
              <div style={{ fontSize: 13, opacity: 0.7 }}>Cargando…</div>
            ) : next ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  {next.title}
                </div>
                <div style={{ fontSize: 12.5, opacity: 0.85 }}>
                  {next.description}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.6 }}>
                No hay entregas pendientes
              </div>
            )}
          </div>
        </div>

        {/* Course cards */}
        {courses?.map((c) => {
          const pct = progressMap[c.id] ?? 0;
          const color = hashToColor(c.title);
          return (
            <div
              key={c.id}
              onClick={() => navigate(`/courses/${c.id}`)}
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 18,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  background: `${color}1a`,
                  color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                {c.title.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                  {c.title}
                </div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 5,
                    background: 'var(--color-border-primary)',
                    marginTop: 6,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: color,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
