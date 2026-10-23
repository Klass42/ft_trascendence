import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import type { NotificationDTO } from '@/lib/api';
import { dotColor } from './display';

interface NotificationToastsProps {
  toasts: NotificationDTO[];
  onDismiss: (id: string) => void;
}

/**
 * Fixed stack of transient toasts shown when `notification:new` arrives live.
 * Clicking one follows its deep-link (?assignmentId= / /forums/:id). Rendered
 * once by NotificationsProvider so it floats above every page.
 */
export function NotificationToasts({ toasts, onDismiss }: NotificationToastsProps) {
  const navigate = useNavigate();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 74,
        right: 20,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 'min(360px, calc(100vw - 40px))',
      }}
    >
      {toasts.map((n) => (
        <div
          key={n.id}
          role="alert"
          style={{
            background: 'var(--color-bg-elevated, var(--color-bg-secondary))',
            border: '1px solid var(--color-border-primary)',
            borderLeft: `3px solid ${dotColor(n.type)}`,
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex',
            gap: 11,
            alignItems: 'flex-start',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            animation: 'notif-toast-in 160ms ease-out',
          }}
        >
          <button
            type="button"
            aria-label={n.link ? `Abrir notificación: ${n.title}` : `Descartar notificación: ${n.title}`}
            onClick={() => {
              if (n.link) navigate(n.link);
              onDismiss(n.id);
            }}
            style={{
              display: 'flex',
              flex: 1,
              minWidth: 0,
              gap: 11,
              alignItems: 'flex-start',
              padding: 0,
              color: 'inherit',
              textAlign: 'left',
              background: 'transparent',
              fontFamily: 'inherit',
            }}
          >
            <span
              style={{
                color: dotColor(n.type),
                display: 'flex',
                flex: 'none',
                marginTop: 1,
              }}
            >
              <Bell size={17} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  lineHeight: 1.35,
                  overflowWrap: 'anywhere',
                }}
              >
                {n.title}
              </span>
              {n.body && (
              <span
                style={{
                  display: 'block',
                  fontSize: 12.5,
                  color: 'var(--color-text-secondary)',
                  marginTop: 2,
                  lineHeight: 1.4,
                }}
              >
                {n.body}
              </span>
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(n.id);
            }}
            aria-label="Descartar"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>
      ))}
      <style>{`@keyframes notif-toast-in {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }`}</style>
    </div>
  );
}
