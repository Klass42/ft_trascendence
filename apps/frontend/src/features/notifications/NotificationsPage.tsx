import { useNavigate } from 'react-router-dom';
import { useNotifications } from './NotificationsProvider';
import { dotColor, formatRelativeTime } from './display';

/**
 * Full notification center. Reads live state from NotificationsProvider (the
 * same source the navbar bell uses), so notifications pushed over the socket
 * appear here without a reload. Clicking one marks it read and follows its
 * deep-link (?assignmentId= / /forums/:id).
 */
export function NotificationsPage() {
  const { items, unread, isLoading, error, markRead, markAllRead } =
    useNotifications();
  const navigate = useNavigate();

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
          disabled={unread === 0}
          style={{
            background: 'transparent',
            border: '1px solid var(--color-border-secondary)',
            color: 'var(--color-text-secondary)',
            fontWeight: 600,
            fontSize: 13,
            padding: '8px 14px',
            borderRadius: 9,
            cursor: unread === 0 ? 'default' : 'pointer',
            opacity: unread === 0 ? 0.5 : 1,
            fontFamily: 'inherit',
          }}
        >
          Marcar todo como leído
        </button>
      </div>

      {isLoading && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Cargando…</div>
      )}

      {error && !isLoading && (
        <div style={{ color: 'var(--color-error)', fontSize: 14 }}>
          No se pudieron cargar las notificaciones.
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          No tienes notificaciones.
        </div>
      )}

      {items.map((n) => (
        <div
          key={n.id}
          onClick={() => {
            if (!n.read) markRead(n.id);
            if (n.link) navigate(n.link);
          }}
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
              background: dotColor(n.type),
              flex: 'none',
              marginTop: 5,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
              {n.title}
            </div>
            {n.body && (
              <div style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.45 }}>
                {n.body}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
              {formatRelativeTime(n.createdAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
