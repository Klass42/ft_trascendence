import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from './NotificationsProvider';
import { dotColor, formatRelativeTime } from './display';
import styles from './NotificationBell.module.css';

/**
 * Navbar notification center: bell button with an unread badge and a dropdown
 * listing recent notifications. Reads live state from NotificationsProvider, so
 * the badge and list update the instant a `notification:new` arrives — no reload.
 */
export function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const recent = items.slice(0, 8);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        className={styles.bellBtn}
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificaciones"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown} role="menu">
          <div className={styles.header}>
            <span className={styles.title}>Notificaciones</span>
            {unread > 0 && (
              <button className={styles.markAll} onClick={markAllRead}>
                Marcar todo como leído
              </button>
            )}
          </div>

          <div className={styles.list}>
            {recent.length === 0 ? (
              <div className={styles.empty}>No tienes notificaciones</div>
            ) : (
              recent.map((n) => (
                <button
                  key={n.id}
                  className={`${styles.item} ${n.read ? '' : styles.unreadItem}`}
                  onClick={() => {
                    if (!n.read) markRead(n.id);
                    if (n.link) navigate(n.link);
                    setOpen(false);
                  }}
                >
                  <span
                    className={styles.dot}
                    style={{ background: dotColor(n.type) }}
                  />
                  <span className={styles.itemBody}>
                    <span className={styles.itemTitle}>{n.title}</span>
                    {n.body && <span className={styles.itemText}>{n.body}</span>}
                    <span className={styles.itemTime}>
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            className={styles.footer}
            onClick={() => {
              navigate('/notifications');
              setOpen(false);
            }}
          >
            Ver todas
          </button>
        </div>
      )}
    </div>
  );
}
