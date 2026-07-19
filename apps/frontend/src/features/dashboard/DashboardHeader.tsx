/** Shared dashboard header (date + title + role badge). Stable/presentational. */
export function DashboardHeader({ title, roleLabel }: { title: string; roleLabel: string }) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 }}>
      <div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'capitalize' }}>
          {dateStr}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '3px 0 0', letterSpacing: '-0.02em' }}>{title}</h1>
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--color-accent-hover)',
          background: 'var(--color-accent-muted)',
          padding: '6px 13px',
          borderRadius: 20,
        }}
      >
        {roleLabel}
      </span>
    </div>
  );
}
