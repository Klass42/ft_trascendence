import type {
  ActivityStatus,
  QuestionKind,
} from '@/lib/api';

/** Human labels for each question kind (author + player UI). */
export const KIND_LABELS: Record<QuestionKind, string> = {
  MULTIPLE_CHOICE: 'Opción múltiple',
  TRUE_FALSE: 'Verdadero / Falso',
  FILL_BLANK: 'Rellenar huecos',
  MATCHING: 'Emparejar',
  ORDERING: 'Ordenar',
  SHORT_ANSWER: 'Respuesta corta',
};

/** The kinds offered in the authoring picker, in a sensible teaching order. */
export const KIND_ORDER: QuestionKind[] = [
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'FILL_BLANK',
  'SHORT_ANSWER',
  'MATCHING',
  'ORDERING',
];

/** Badge styling for an activity's publish status (design-system Badge). */
export const STATUS_BADGE: Record<
  ActivityStatus,
  { variant: 'success' | 'warning' | 'neutral'; label: string }
> = {
  DRAFT: { variant: 'warning', label: 'Borrador' },
  PUBLISHED: { variant: 'success', label: 'Publicada' },
  ARCHIVED: { variant: 'neutral', label: 'Archivada' },
};

/** Fresh, valid-by-construction default `content` for a newly-picked kind, so
 * the editor always starts from a coherent shape. */
export function emptyContent(kind: QuestionKind): Record<string, unknown> {
  switch (kind) {
    case 'MULTIPLE_CHOICE':
      return { options: ['', ''], correct: [] };
    case 'TRUE_FALSE':
      return { answer: true };
    case 'FILL_BLANK':
      return { blanks: [{ accepted: [''] }] };
    case 'MATCHING':
      return { left: [''], right: [''], pairs: [[0, 0]] };
    case 'ORDERING':
      return { items: ['', ''], correctOrder: [0, 1] };
    case 'SHORT_ANSWER':
      return { accepted: [] };
    default:
      return {};
  }
}

/** Split a comma/newline separated string into a trimmed, non-empty list. */
export function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
