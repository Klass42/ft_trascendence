/** Format an ISO date as a short, human-readable Spanish datetime. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Up-to-two-letter initials for an avatar bubble. */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

/** True for a course role that should show a staff badge. */
export function isStaffRole(role: string | null | undefined): boolean {
  return role === 'TEACHER' || role === 'ASSISTANT';
}

/** Length limits; keep equal to the backend DTOs (apps/backend/src/forums/dto). */
export const FORUM_TITLE_MAX = 200;
export const FORUM_BODY_MAX = 5000;

/** Spanish validation message for a thread title, or null when valid. */
export function titleError(value: string): string | null {
  const title = value.trim();
  if (!title) return 'El título no puede estar vacío.';
  if (title.length > FORUM_TITLE_MAX) {
    return `El título no puede superar los ${FORUM_TITLE_MAX} caracteres.`;
  }
  return null;
}

/** Spanish validation message for a message body, or null when valid. */
export function bodyError(value: string): string | null {
  const body = value.trim();
  if (!body) return 'El mensaje no puede estar vacío.';
  if (body.length > FORUM_BODY_MAX) {
    return `El mensaje no puede superar los ${FORUM_BODY_MAX} caracteres.`;
  }
  return null;
}
