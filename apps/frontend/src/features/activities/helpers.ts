import type {
  ActivityStatus,
  AttemptStatus,
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
  ESSAY: 'Desarrollar',
  FILE_UPLOAD: 'Fichero',
};

/** The kinds offered in the authoring picker, in a sensible teaching order. */
export const KIND_ORDER: QuestionKind[] = [
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'FILL_BLANK',
  'SHORT_ANSWER',
  'MATCHING',
  'ORDERING',
  'ESSAY',
  'FILE_UPLOAD',
];

/** Kinds without an auto-grader (or SHORT_ANSWER with empty accepted). */
export function isSubjective(
  kind: QuestionKind,
  content?: Record<string, unknown>,
): boolean {
  if (kind === 'ESSAY' || kind === 'FILE_UPLOAD') return true;
  if (kind === 'SHORT_ANSWER') {
    const accepted = content?.accepted;
    return !Array.isArray(accepted) || accepted.length === 0;
  }
  return false;
}

/** Badge styling for an attempt's status (design-system Badge). */
export const ATTEMPT_STATUS_BADGE: Record<
  AttemptStatus,
  { variant: 'success' | 'warning' | 'info' | 'neutral'; label: string }
> = {
  IN_PROGRESS: { variant: 'warning', label: 'Borrador' },
  SUBMITTED: { variant: 'info', label: 'Por calificar' },
  GRADED: { variant: 'success', label: 'Calificado' },
};

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
    case 'ESSAY':
      return {};
    case 'FILE_UPLOAD':
      return { maxFiles: 1 };
    default:
      return {};
  }
}
