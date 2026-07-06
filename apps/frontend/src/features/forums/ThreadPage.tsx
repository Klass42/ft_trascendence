import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { threads } from '@/lib/mock-data';

export function ThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const thread = threads.find((t) => t.id === threadId);
  const [draft, setDraft] = useState('');

  if (!thread) {
    return (
      <div style={{ padding: '40px', color: 'var(--color-text-secondary)' }}>
        Hilo no encontrado
      </div>
    );
  }

  return (
    <div style={{ padding: '26px 40px', maxWidth: 720 }}>
      <button
        onClick={() => navigate('/forums')}
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-secondary)',
          color: 'var(--color-text-secondary)',
          fontSize: 12.5,
          fontWeight: 600,
          padding: '7px 13px',
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: 18,
        }}
      >
        ← Foros
      </button>

      <h1 style={{ fontSize: 23, fontWeight: 800, margin: '0 0 18px', letterSpacing: '-0.01em' }}>
        {thread.title}
      </h1>

      {thread.replies.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--color-accent-muted)',
              color: 'var(--color-accent-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 12,
              flex: 'none',
            }}
          >
            {r.initials}
          </div>
          <div
            style={{
              flex: 1,
              background: r.me ? 'var(--color-accent-muted)' : 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 12,
              padding: '12px 15px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 13.5, color: r.teacher ? 'var(--color-accent-hover)' : 'var(--color-text-primary)' }}>
                {r.author}
              </span>
              {r.teacher && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--color-accent-hover)',
                    background: 'var(--color-accent-muted)',
                    padding: '1px 7px',
                    borderRadius: 20,
                  }}
                >
                  PROFESOR
                </span>
              )}
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                {r.when}
              </span>
            </div>
            <div style={{ fontSize: 14.5, lineHeight: 1.55, color: '#334155' }}>
              {r.body}
            </div>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10, marginTop: 22, alignItems: 'flex-end' }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribe una respuesta…"
          style={{
            flex: 1,
            minHeight: 44,
            height: 44,
            resize: 'none',
            border: '1px solid var(--color-border-secondary)',
            borderRadius: 11,
            padding: '12px 14px',
            fontSize: 14,
            fontFamily: 'inherit',
            color: 'var(--color-text-primary)',
            outline: 'none',
            background: 'var(--color-bg-secondary)',
          }}
        />
        <button
          style={{
            background: 'var(--color-accent-primary)',
            border: 'none',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            padding: '12px 20px',
            borderRadius: 11,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flex: 'none',
          }}
        >
          Publicar
        </button>
      </div>
    </div>
  );
}