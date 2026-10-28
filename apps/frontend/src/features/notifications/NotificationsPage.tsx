import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, Spinner } from '@/components/ui';
import type { NotificationDTO } from '@/lib/api';
import { useNotifications } from './NotificationsProvider';
import { useNotificationsFeed, type NotificationFilter } from './useNotificationsFeed';
import {
  dotColor,
  formatRelativeTime,
  notificationDateGroup,
  notificationIcon,
  notificationTypeLabel,
} from './display';
import styles from './NotificationsPage.module.css';

const FILTERS: Array<{ id: NotificationFilter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'No leídas' },
];

/**
 * Full notification center. The list is paged and filtered by the server
 * (see useNotificationsFeed); read state and live arrivals are shared with the
 * navbar bell through NotificationsProvider.
 */
export function NotificationsPage() {
  const { items: live, unread, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const feed = useNotificationsFeed(filter);
  const navigate = useNavigate();

  // Fetched rows + notifications that arrived live after the first fetch, with
  // the read state changed from the bell applied on top.
  const items = useMemo<NotificationDTO[]>(() => {
    const fetchedIds = new Set(feed.items.map((n) => n.id));
    const newest = feed.items[0]?.createdAt;
    const arrivals = feed.isLoading
      ? []
      : live.filter((n) => !fetchedIds.has(n.id) && (!newest || n.createdAt > newest));
    const readIds = new Set(live.filter((n) => n.read).map((n) => n.id));
    return [...arrivals, ...feed.items]
      .map((n) => (readIds.has(n.id) && !n.read ? { ...n, read: true } : n))
      .filter((n) => filter === 'all' || !n.read);
  }, [feed.items, feed.isLoading, live, filter]);

  const groups = new Map<string, NotificationDTO[]>();
  for (const item of items) {
    const label = notificationDateGroup(item.createdAt);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }

  function open(notification: NotificationDTO) {
    if (!notification.read) {
      markRead(notification.id);
      feed.markReadLocal(notification.id);
    }
    if (notification.link) navigate(notification.link);
  }

  function readAll() {
    markAllRead();
    feed.markAllReadLocal();
  }

  const showList = !feed.isLoading && !feed.error;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Notificaciones</h1>
        <Button variant="outline" size="sm" onClick={readAll} disabled={unread === 0}>
          Marcar todas como leídas
        </Button>
      </div>

      <div className={styles.filters} role="group" aria-label="Filtrar notificaciones">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`${styles.filter} ${filter === id ? styles.filterActive : ''}`}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
            {id === 'unread' && unread > 0 && <span className={styles.filterCount}>{unread > 99 ? '99+' : unread}</span>}
          </button>
        ))}
      </div>

      {feed.isLoading && (
        <div className={styles.status}>
          <Spinner size="md" label="Cargando notificaciones…" />
        </div>
      )}
      {feed.error && !feed.isLoading && (
        <div className={styles.status}>
          <p role="alert" className={styles.error}>
            No se pudieron cargar las notificaciones.
          </p>
          <Button variant="outline" size="sm" onClick={feed.retry}>
            Reintentar
          </Button>
        </div>
      )}
      {showList && items.length === 0 && (
        <EmptyState
          title={filter === 'unread' ? 'No tienes notificaciones sin leer' : 'No tienes notificaciones'}
          description={
            filter === 'unread'
              ? 'Estás al día.'
              : 'Cuando haya novedades de tus asignaturas o de tu cuenta, aparecerán aquí.'
          }
        />
      )}

      {showList && [...groups.entries()].map(([label, notifications]) => (
        <section key={label} aria-label={label} className={styles.group}>
          <h2 className={styles.groupTitle}>{label}</h2>
          <div className={styles.list}>
            {notifications.map((notification) => {
              const Icon = notificationIcon(notification.type);
              return (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => open(notification)}
                  aria-label={`${notificationTypeLabel(notification.type)}: ${notification.title}`}
                  className={`${styles.item} ${notification.read ? '' : styles.unreadItem}`}
                >
                  <Icon
                    size={17}
                    aria-hidden="true"
                    className={styles.icon}
                    style={{ color: dotColor(notification.type) }}
                  />
                  <span className={styles.itemBody}>
                    <span className={styles.itemHead}>
                      <span className={styles.itemTitle}>{notification.title}</span>
                      <span className={styles.itemType}>{notificationTypeLabel(notification.type)}</span>
                    </span>
                    {notification.body && <span className={styles.itemText}>{notification.body}</span>}
                    <span className={styles.itemTime}>{formatRelativeTime(notification.createdAt)}</span>
                  </span>
                  {!notification.read && <span aria-label="Sin leer" className={styles.unreadDot} />}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {showList && feed.hasMore && (
        <div className={styles.more}>
          {feed.loadMoreFailed && (
            <p role="alert" className={styles.error}>
              No se pudieron cargar más notificaciones.
            </p>
          )}
          <Button variant="outline" onClick={() => void feed.loadMore()} loading={feed.isLoadingMore}>
            Cargar más
          </Button>
        </div>
      )}
    </div>
  );
}
