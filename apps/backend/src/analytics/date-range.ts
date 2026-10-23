export const MAX_ANALYTICS_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

/** Return a user-facing validation message for an optional ISO date range. */
export function analyticsDateRangeError(
  from?: string,
  to?: string,
): string | null {
  if (!from || !to) return null;

  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 'Las fechas del rango no son válidas.';
  }
  if (start > end) {
    return 'La fecha «Desde» debe ser anterior o igual a «Hasta».';
  }
  if (end - start > MAX_ANALYTICS_RANGE_DAYS * DAY_MS) {
    return `El rango de fechas no puede superar ${MAX_ANALYTICS_RANGE_DAYS} días.`;
  }
  return null;
}
