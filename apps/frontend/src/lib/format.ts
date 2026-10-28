/**
 * Shared display formatting (Spanish copy). Screens must use these helpers
 * instead of calling `toLocaleDateString`/`Intl.DateTimeFormat` directly, so
 * every date looks the same: "27 oct 2026", "27 oct 2026, 23:03".
 * Time zone semantics are untouched (browser local time unless stated).
 */

const LOCALE = 'es-ES';

/** "1 intento" / "2 intentos": the count followed by the right noun form. */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Upper-cases only the first letter ("martes, 27 de octubre" -> "Martes, 27 de octubre"). */
export function capitalizeFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase(LOCALE) + text.slice(1);
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Short date: "27 oct 2026". A dash when empty or invalid. */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Short date with time: "27 oct 2026, 23:03". A dash when empty or invalid. */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString(LOCALE, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Day and month only: "1 sept". Pass `timeZone: 'UTC'` for date-only values. */
export function formatDayMonth(value: string | Date, timeZone?: string): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', timeZone });
}

/** Long date: "27 de octubre de 2026". */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Header date: "Martes, 27 de octubre" (only the first letter is capitalised). */
export function formatWeekdayDate(date: Date): string {
  return capitalizeFirst(
    date.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }),
  );
}

/**
 * Short, dependency-free relative time in Spanish ("hace 5 min", "ayer", …).
 * Falls back to a short date after a week.
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
  return formatDate(iso);
}
