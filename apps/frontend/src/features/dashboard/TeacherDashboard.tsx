/**
 * TeacherDashboard — OWNER: David (Plan 2, A4-teacher).
 * Real data via GET /me/teaching/summary: courses taught, distinct students and
 * ungraded attempts. Clicking "Por calificar" (card) opens the
 * gradebook; a row opens the grading panel of that submission. Refreshes live on
 * the analytics socket event. No mock data.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, Spinner } from '@/components/ui';
import { useAuth, useTeachingSummary } from '@/lib/api';
import type { PendingAttemptDTO } from '@/lib/api';
import { useNotifications } from '@/features/notifications';
import { formatRelativeTime } from '@/lib/format';
import { DashboardHeader } from './DashboardHeader';

function initials(name: string): string {
  return (
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  );
}

function StatCard({
  label,
  value,
  accent = false,
  onClick,
}: {
  label: string;
  value: number;
  accent?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        background: accent
          ? 'var(--color-error-muted)'
          : 'var(--color-bg-secondary)',
        border: `1px solid ${
          accent ? 'var(--color-error-muted)' : 'var(--color-border-primary)'
        }`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: accent ? 'var(--color-error)' : 'var(--color-text-muted)',
          fontWeight: 'var(--font-semibold)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 'var(--text-3xl)',
          fontWeight: 'var(--font-extrabold)',
          marginTop: 4,
          color: accent ? 'var(--color-error)' : 'var(--color-text-primary)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useTeachingSummary();
  const { analyticsUpdate } = useNotifications();
  const userName = user?.name?.split(' ')[0] || '';

  // A submission or a grade changed somewhere in the teacher's subjects: refresh
  // the count and the list (same socket event the analytics page listens to).
  useEffect(() => {
    if (!analyticsUpdate) return;
    const timer = window.setTimeout(refetch, 500);
    return () => window.clearTimeout(timer);
  }, [analyticsUpdate, refetch]);

  const goToGradebook = () => navigate('/grades');
  const goToSubmission = (s: PendingAttemptDTO) =>
    navigate(
      `/grades?${new URLSearchParams({
        subjectId: s.subjectId,
        activityId: s.activityId,
        attemptId: s.attemptId,
      })}`,
    );

  return (
    <>
      <DashboardHeader title={`Hola, ${userName}`} roleLabel="Profesor" />

      {isLoading && <Spinner size="lg" label="Cargando tu panel…" />}

      {error && !isLoading && (
        <div
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-error)' }}>
            No se pudo cargar el panel.
          </p>
          <button
            type="button"
            onClick={refetch}
            style={{
              background: 'var(--color-accent-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '8px 14px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 'var(--font-semibold)',
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {data && !isLoading && !error && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-5)',
            }}
          >
            <StatCard label="Asignaturas activas" value={data.activeCourses} />
            <StatCard
              label="Por calificar"
              value={data.pendingCount}
              accent
              onClick={goToGradebook}
            />
            <StatCard label="Alumnos totales" value={data.totalStudents} />
          </div>

          <div
            style={{
              fontSize: 'var(--text-md)',
              fontWeight: 'var(--font-extrabold)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Entregas por calificar
          </div>

          {data.pending.length === 0 ? (
            <EmptyState
              title="Todo al día"
              description="No tienes entregas pendientes de calificar."
            />
          ) : (
            <div
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                maxWidth: 720,
              }}
            >
              {data.pending.map((s: PendingAttemptDTO) => (
                <div
                  key={s.attemptId}
                  role="button"
                  tabIndex={0}
                  onClick={() => goToSubmission(s)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      goToSubmission(s);
                    }
                  }}
                  style={{
                    display: 'flex',
                    gap: 'var(--space-3)',
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--color-border-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: 'var(--color-accent-muted)',
                      color: 'var(--color-accent-hover)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'var(--font-bold)',
                      fontSize: 'var(--text-xs)',
                      flex: 'none',
                    }}
                  >
                    {initials(s.student.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 'var(--font-semibold)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.activityTitle}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {s.student.name} · {s.courseTitle}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
                      flex: 'none',
                    }}
                  >
                    {s.submittedAt ? formatRelativeTime(s.submittedAt) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
