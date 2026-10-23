import {
  Activity,
  Bell,
  BookOpen,
  Building2,
  CheckCircle,
  Clock,
  ClipboardList,
  FileText,
  GraduationCap,
  Inbox,
  Library,
  MessageCircle,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { NotificationType } from '@/lib/api';

const DOT_COLORS: Record<NotificationType, string> = {
  NEW_ASSIGNMENT: 'var(--color-warning)',
  ACTIVITY_PUBLISHED: 'var(--color-warning)',
  ACTIVITY_CHANGED: 'var(--color-info)',
  ACTIVITY_REMOVED: 'var(--color-text-muted)',
  SUBMISSION_RECEIVED: 'var(--color-accent-primary)',
  COURSE_CHANGED: 'var(--color-accent-primary)',
  COURSE_CONTENT_CHANGED: 'var(--color-info)',
  MEMBERSHIP_CHANGED: 'var(--color-accent-primary)',
  FORUM_THREAD: 'var(--color-info)',
  RESOURCE_CHANGED: 'var(--color-success)',
  USER_CHANGED: 'var(--color-accent-primary)',
  ORGANIZATION_CHANGED: 'var(--color-accent-primary)',
  GRADE_PUBLISHED: 'var(--color-success)',
  FORUM_REPLY: 'var(--color-info)',
  ENROLLMENT: 'var(--color-accent-primary)',
  DEADLINE_REMINDER: 'var(--color-error)',
  FRIEND_REQUEST: 'var(--color-accent-primary)',
  SYSTEM: 'var(--color-text-secondary)',
};

const TYPE_LABELS: Record<NotificationType, string> = {
  NEW_ASSIGNMENT: 'Entrega recibida',
  ACTIVITY_PUBLISHED: 'Tarea publicada',
  ACTIVITY_CHANGED: 'Tarea actualizada',
  ACTIVITY_REMOVED: 'Tarea eliminada',
  SUBMISSION_RECEIVED: 'Entrega recibida',
  COURSE_CHANGED: 'Curso o asignatura',
  COURSE_CONTENT_CHANGED: 'Contenido del curso',
  MEMBERSHIP_CHANGED: 'Matrícula o equipo',
  FORUM_THREAD: 'Hilo del foro',
  RESOURCE_CHANGED: 'Biblioteca de recursos',
  USER_CHANGED: 'Cuenta de usuario',
  ORGANIZATION_CHANGED: 'Organización',
  GRADE_PUBLISHED: 'Nota publicada',
  FORUM_REPLY: 'Respuesta en el foro',
  ENROLLMENT: 'Matrícula',
  DEADLINE_REMINDER: 'Fecha límite',
  FRIEND_REQUEST: 'Solicitud de amistad',
  SYSTEM: 'Aviso',
};

const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  NEW_ASSIGNMENT: ClipboardList,
  ACTIVITY_PUBLISHED: FileText,
  ACTIVITY_CHANGED: Activity,
  ACTIVITY_REMOVED: Trash2,
  SUBMISSION_RECEIVED: Inbox,
  COURSE_CHANGED: GraduationCap,
  COURSE_CONTENT_CHANGED: BookOpen,
  MEMBERSHIP_CHANGED: Users,
  FORUM_THREAD: MessageCircle,
  RESOURCE_CHANGED: Library,
  USER_CHANGED: UserCog,
  ORGANIZATION_CHANGED: Building2,
  GRADE_PUBLISHED: CheckCircle,
  FORUM_REPLY: MessageCircle,
  ENROLLMENT: Users,
  DEADLINE_REMINDER: Clock,
  FRIEND_REQUEST: UserPlus,
  SYSTEM: Bell,
};

export function dotColor(type: NotificationType): string {
  return DOT_COLORS[type] ?? 'var(--color-accent-primary)';
}

export function notificationTypeLabel(type: NotificationType): string {
  return TYPE_LABELS[type] ?? 'Aviso';
}

export function notificationIcon(type: NotificationType): LucideIcon {
  return TYPE_ICONS[type] ?? Bell;
}

export function notificationDateGroup(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Anteriores';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
  if (sameDay(date, today)) return 'Hoy';
  if (sameDay(date, yesterday)) return 'Ayer';
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
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
