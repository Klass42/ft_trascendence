import { useState } from 'react';
import { notifications as initialNotifs } from '@/lib/mock-data';

const dotColors: Record<string, string> = {
  grade: '#0f766e',
  forum: '#2563eb',
  assignment: '#d97706',
  reminder: '#dc2626',
};

export function NotificationsPage() {
  const [notifs, setNotifs] = useState(initialNotifs);

  const markAllRead = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div style={{ padding: '30px 40px', maxWidth: 720 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          Notificaciones
        </h1>
        <button
          onClick={markAllRead}
          style={{
            background: 'transparent',
            border: '1px solid var(--color-border-secondary)',
            color: 'var(--color-text-secondary)',
            fontWeight: 600,
            fontSize: 13,
            padding: '8px 14px',
            borderRadius: 9,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Marcar todo como leído
        </button>
      </div>

      {notifs.map((n) => (
        <div
          key={n.id}
          onClick={() => markRead(n.id)}
          style={{
            background: n.read ? 'var(--color-bg-secondary)' : 'var(--color-accent-muted)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 12,
            padding: '14px 16px',
            display: 'flex',
            gap: 13,
            alignItems: 'flex-start',
            marginBottom: 10,
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: dotColors[n.type] || 'var(--color-accent-primary)',
              flex: 'none',
              marginTop: 5,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, color: 'var(--color-text-primary)', lineHeight: 1.45 }}>
              {n.text}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
              {n.time}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}