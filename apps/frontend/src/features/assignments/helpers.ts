import { apiClient } from '@/lib/api';
import type { SubmissionStatus } from '@/lib/api';

/** Human-readable status chip styling, keyed by the backend SubmissionStatus. */
export const STATUS_CHIP: Record<
  SubmissionStatus | 'NONE',
  { bg: string; fg: string; label: string }
> = {
  NONE: { bg: 'var(--color-neutral-muted)', fg: 'var(--color-neutral)', label: 'Sin entregar' },
  DRAFT: { bg: 'var(--color-warning-muted)', fg: 'var(--color-warning)', label: 'Borrador' },
  SUBMITTED: { bg: 'var(--color-accent-muted)', fg: 'var(--color-accent-hover)', label: 'Entregado' },
  LATE: { bg: 'var(--color-error-muted)', fg: 'var(--color-error)', label: 'Entregado tarde' },
  GRADED: { bg: 'var(--color-success-muted)', fg: 'var(--color-success)', label: 'Calificado' },
};

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
