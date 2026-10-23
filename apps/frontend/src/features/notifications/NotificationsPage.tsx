import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui';
import { useNotifications } from './NotificationsProvider';
import { dotColor, formatRelativeTime } from './display';
import styles from './NotificationsPage.module.css';

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
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          Notificaciones
        </h1>
        <button
          type="button"
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
        <EmptyState title="No tienes notificaciones" description="Cuando haya novedades de tus cursos, aparecerán aquí." />
      )}

      {items.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => {
            if (!n.read) markRead(n.id);
            if (n.link) navigate(n.link);
          }}
          className={styles.item}
          style={{
            background: n.read ? 'var(--color-bg-secondary)' : 'var(--color-accent-muted)',
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
          <span className={styles.itemBody}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.4, overflowWrap: 'anywhere' }}>
              {n.title}
            </span>
            {n.body && (
              <span style={{ display: 'block', fontSize: 13.5, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                {n.body}
              </span>
            )}
            <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
              {formatRelativeTime(n.createdAt)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
