import { apiClient } from '@/lib/api';
import type { SubmissionStatus } from '@/lib/api';

/** Human-readable status chip styling, keyed by the backend SubmissionStatus. */
export const STATUS_CHIP: Record<
  SubmissionStatus | 'NONE',
  { bg: string; fg: string; label: string }
> = {
  NONE: { bg: '#f1f5f9', fg: '#475569', label: 'Sin entregar' },
  DRAFT: { bg: '#fff4e5', fg: '#b45309', label: 'Borrador' },
  SUBMITTED: { bg: '#eff4ff', fg: '#1d4ed8', label: 'Entregado' },
  LATE: { bg: '#fef2f2', fg: '#b91c1c', label: 'Entregado tarde' },
  GRADED: { bg: '#e7f6ef', fg: '#0f766e', label: 'Calificado' },
};

/** Format an ISO date for display, or a dash when null. */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** True when the assignment's due date is in the past. */
export function isOverdue(dueAt: string | null): boolean {
  return !!dueAt && new Date(dueAt).getTime() < Date.now();
}

/** Where "now" sits relative to the submission window. */
export type WindowState = 'not-open' | 'open' | 'closed';

/** Resolve the submission-window state from openAt/closeAt (null = unbounded). */
export function windowState(
  openAt: string | null,
  closeAt: string | null,
  now: number = Date.now(),
): WindowState {
  if (openAt && now < new Date(openAt).getTime()) return 'not-open';
  if (closeAt && now > new Date(closeAt).getTime()) return 'closed';
  return 'open';
}

/** Badge variant + label for a window state (uses the design-system Badge). */
export const WINDOW_BADGE: Record<
  WindowState,
  { variant: 'success' | 'warning' | 'neutral'; label: string }
> = {
  'not-open': { variant: 'warning', label: 'No abierta' },
  open: { variant: 'success', label: 'Abierta' },
  closed: { variant: 'neutral', label: 'Cerrada' },
};

/**
 * Convert an ISO string to the value a <DatePicker mode="datetime"> expects
 * ("YYYY-MM-DDTHH:mm", local time), or '' when null. Inverse of `toIso`.
 */
export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  // Shift by the timezone offset so the native control shows local wall-clock.
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** Turn a datetime-local value into a full ISO string, or null when empty. */
export function toIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

/**
 * Resolve a stored file's signed URL and open it in a new tab. Uses the shared
 * GET /files/:id/url endpoint.
 */
export async function openFile(fileId: string): Promise<void> {
  try {
    const { url } = await apiClient.get<{ url: string; originalName: string }>(
      `/files/${fileId}/url`,
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    // Best-effort: a broken link shouldn't crash the page.
    alert('No se pudo abrir el archivo.');
  }
}
