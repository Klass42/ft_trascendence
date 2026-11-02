import type { AnalyticsActivityType } from '@/lib/api';
import { formatDate } from '@/lib/format';

const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

/** Options of the activity-type filter ('' = every type). */
export const ACTIVITY_TYPE_OPTIONS: Array<{ value: '' | AnalyticsActivityType; label: string }> = [
  { value: '', label: 'Todos los tipos' },
  { value: 'QUIZ', label: 'Cuestionario' },
  { value: 'LISTENING', label: 'Comprensión auditiva' },
  { value: 'SPEAKING', label: 'Expresión oral' },
];

/** ISO `YYYY-MM-DD` for `n` days before today. */
export function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Same rules as the backend DTO (ordered, at most 366 days); null when valid or incomplete. */
export function validateRange(from: string, to: string): string | null {
  if (!from || !to) return null;
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 'Introduce un rango de fechas válido.';
  }
  if (start > end) return 'La fecha «Desde» debe ser anterior o igual a «Hasta».';
  if (end - start > MAX_RANGE_DAYS * DAY_MS) {
    return `El rango de fechas no puede superar ${MAX_RANGE_DAYS} días.`;
  }
  return null;
}

export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A `YYYY-MM-DD` day as "27 oct 2026" (noon avoids off-by-one in negative time zones). */
function formatDay(value: string): string {
  return formatDate(new Date(`${value}T12:00:00`));
}

/** Human description of the active range, e.g. "Del 1 oct 2026 al 30 oct 2026". */
export function describeRange(from: string, to: string): string {
  if (from && to) return `Del ${formatDay(from)} al ${formatDay(to)}`;
  if (from) return `Desde el ${formatDay(from)}`;
  if (to) return `Hasta el ${formatDay(to)}`;
  return 'Toda la asignatura';
}

export function activityTypeLabel(type: string): string {
  return ACTIVITY_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? 'Todos los tipos';
}
