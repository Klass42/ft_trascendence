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
