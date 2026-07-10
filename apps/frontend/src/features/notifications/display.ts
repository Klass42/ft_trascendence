import type { NotificationType } from '@/lib/api';

/** Accent dot per notification type (matches the app's palette). */
const DOT_COLORS: Record<NotificationType, string> = {
  GRADE_PUBLISHED: '#0f766e',
  FORUM_REPLY: '#2563eb',
  NEW_ASSIGNMENT: '#d97706',
  DEADLINE_REMINDER: '#dc2626',
  ENROLLMENT: '#7c3aed',
  FRIEND_REQUEST: '#db2777',
  SYSTEM: '#64748b',
};

export function dotColor(type: NotificationType): string {
  return DOT_COLORS[type] ?? 'var(--color-accent-primary)';
}

/**
 * Short, dependency-free relative time in Spanish ("hace 5 min", "ayer", …).
 * Good enough for the notification center; not a full i18n formatter.
 */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 45) return 'ahora';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `hace ${diffHour} h`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay === 1) return 'ayer';
  if (diffDay < 7) return `hace ${diffDay} días`;
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}
