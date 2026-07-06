import { useNavigate } from 'react-router-dom';
import { threads } from '@/lib/mock-data';

export function ForumsPage() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '30px 40px', maxWidth: 820 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          Foros
        </h1>
        <button
          style={{
            background: 'var(--color-accent-primary)',
            border: 'none',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13.5,
            padding: '9px 16px',
            borderRadius: 9,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + Nuevo hilo
        </button>
      </div>

      {threads.map((t) => (
        <div
          key={t.id}
          onClick={() => navigate(`/forums/${t.id}`)}
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 13,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 11,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: 'var(--color-accent-muted)',
              color: 'var(--color-accent-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{t.title}</span>
              {t.pinned && (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#d97706',
                    background: '#fdf0dc',
                    padding: '2px 8px',
                    borderRadius: 20,
                  }}
                >
                  FIJADO
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {t.author} · {t.replies.length} respuestas
            </div>
          </div>
          <span style={{ color: 'var(--color-text-muted)' }}>→</span>
        </div>
      ))}
    </div>
  );
}