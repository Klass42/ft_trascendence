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
