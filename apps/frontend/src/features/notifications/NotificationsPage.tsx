import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui';
import { useNotifications } from './NotificationsProvider';
import {
  dotColor,
  formatRelativeTime,
  notificationDateGroup,
  notificationIcon,
  notificationTypeLabel,
} from './display';

/** Full notification center, sharing live state with the navbar bell. */
export function NotificationsPage() {
  const { items, unread, isLoading, error, markRead, markAllRead } =
    useNotifications();
  const navigate = useNavigate();
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const label = notificationDateGroup(item.createdAt);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }

  return (
    <main style={{ padding: 'clamp(16px, 4vw, 40px)', maxWidth: 760 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          marginBottom: 20,
          flexWrap: 'wrap',
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
          Marcar todas como leídas
        </button>
      </div>

      {isLoading && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Cargando…</div>
      )}
      {error && !isLoading && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 14 }}>
          No se pudieron cargar las notificaciones.
        </p>
      )}
      {!isLoading && !error && items.length === 0 && (
        <EmptyState
          title="No tienes notificaciones"
          description="Cuando haya novedades de tus cursos o de tu cuenta, aparecerán aquí."
        />
      )}

      {!isLoading && !error && [...groups.entries()].map(([label, notifications]) => (
        <section key={label} aria-label={label} style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
            {label}
          </h2>
          <div style={{ borderTop: '1px solid var(--color-border-primary)' }}>
            {notifications.map((notification) => {
              const Icon = notificationIcon(notification.type);
              return (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => {
                    if (!notification.read) markRead(notification.id);
                    if (notification.link) navigate(notification.link);
                  }}
                  aria-label={`${notificationTypeLabel(notification.type)}: ${notification.title}`}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    background: notification.read ? 'transparent' : 'var(--color-accent-muted)',
                    border: 0,
                    borderBottom: '1px solid var(--color-border-primary)',
                    padding: '14px 10px',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                  }}
                >
                  <Icon
                    size={17}
                    aria-hidden="true"
                    style={{ color: dotColor(notification.type), flex: 'none', marginTop: 2 }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                        {notification.title}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {notificationTypeLabel(notification.type)}
                      </span>
                    </span>
                    {notification.body && (
                      <span style={{ display: 'block', fontSize: 13.5, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.45 }}>
                        {notification.body}
                      </span>
                    )}
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                  </span>
                  {!notification.read && (
                    <span aria-label="Sin leer" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-accent-primary)', flex: 'none', marginTop: 6 }} />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
