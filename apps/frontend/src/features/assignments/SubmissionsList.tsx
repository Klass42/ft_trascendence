import { Spinner } from '@/components/ui';
import { useAssignmentSubmissions } from '@/lib/api';
import type { AssignmentDTO } from '@/lib/api';
import { STATUS_CHIP, openFile } from './helpers';
import { formatDateTime } from '@/lib/format';

interface SubmissionsListProps {
  assignment: AssignmentDTO;
}

/** Teacher/assistant view: every student submission for the assignment. */
export function SubmissionsList({ assignment }: SubmissionsListProps) {
  const { data, isLoading, error } = useAssignmentSubmissions(assignment.id);

  if (isLoading) {
    return <Spinner size="md" label="Cargando entregas…" />;
  }
  if (error) {
    return (
      <p style={{ color: 'var(--color-error)', fontSize: 14 }}>
        No se pudieron cargar las entregas.
      </p>
    );
  }
  if (!data || data.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
        Aún no hay entregas.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((s) => {
        const chip = STATUS_CHIP[s.status];
        return (
          <div
            key={s.id}
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 11,
              padding: '13px 15px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                  {s.user?.name ?? s.userId}
                </div>
                <div
                  style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}
                >
                  {formatDateTime(s.updatedAt)}
                </div>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: chip.fg,
                  background: chip.bg,
                  padding: '4px 11px',
                  borderRadius: 20,
                  whiteSpace: 'nowrap',
                }}
              >
                {chip.label}
              </span>
              {s.status === 'GRADED' && s.score != null && (
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-success)' }}>
                  {s.score} / {assignment.maxScore}
                </span>
              )}
            </div>

            {s.text && (
              <p
                style={{
                  fontSize: 13.5,
                  margin: '10px 0 0',
                  color: 'var(--color-text-secondary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {s.text}
              </p>
            )}

            {s.files.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 10,
                }}
              >
                {s.files.map((f) => (
                  <button
                    key={f.fileId}
                    type="button"
                    onClick={() => openFile(f.fileId)}
                    style={{
                      background: 'var(--color-bg-primary)',
                      border: '1px solid var(--color-border-primary)',
                      borderRadius: 8,
                      padding: '5px 10px',
                      fontSize: 12.5,
                      color: 'var(--color-accent-primary)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {f.file.originalName}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
