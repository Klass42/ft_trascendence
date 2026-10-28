import { plural } from '@/lib/format';
import type {
  ActivityStatus,
  AttemptStatus,
  QuestionDTO,
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
  FILE_UPLOAD: 'Archivo',
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

// `plural` lives in lib/format; re-exported so existing imports keep working.
export { plural };

export const questionsLabel = (count: number) => plural(count, 'pregunta', 'preguntas');
export const pointsLabel = (count: number) => plural(count, 'pt', 'pts');
export const longPointsLabel = (count: number) => plural(count, 'punto', 'puntos');
export const attemptsLabel = (count: number) => plural(count, 'intento', 'intentos');

/** "1 intento" / "2 intentos"; 0 means the author set no cap. */
export function attemptsAllowedLabel(allowed: number): string {
  if (allowed === 0) return 'Intentos ilimitados';
  return attemptsLabel(allowed);
}

/** What is left for the learner, e.g. "Te quedan 2 intentos". */
export function attemptsRemainingLabel(remaining: number): string {
  if (remaining <= 0) return 'No te quedan intentos';
  return remaining === 1 ? 'Te queda 1 intento' : `Te quedan ${attemptsLabel(remaining)}`;
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'text' in value && typeof value.text === 'string') {
    return value.text;
  }
  return String(value ?? '');
}

/** Whether a learner's response carries any answer for the question. */
export function isAnswered(kind: QuestionKind, response: Record<string, unknown> | undefined): boolean {
  if (!response) return false;
  switch (kind) {
    case 'MULTIPLE_CHOICE':
      return Array.isArray(response.selected) && response.selected.length > 0;
    case 'TRUE_FALSE':
      return typeof response.value === 'boolean';
    case 'FILL_BLANK':
      return Array.isArray(response.values) && response.values.some((value) => typeof value === 'string' && value.trim() !== '');
    case 'MATCHING':
      return Array.isArray(response.pairs) && response.pairs.length > 0;
    case 'ORDERING':
      return Array.isArray(response.order);
    case 'SHORT_ANSWER':
    case 'ESSAY':
      return typeof response.text === 'string' && response.text.trim() !== '';
    case 'FILE_UPLOAD':
      return Array.isArray(response.fileIds) && response.fileIds.length > 0;
  }
}

export function countUnanswered(
  questions: QuestionDTO[],
  responses: Record<string, Record<string, unknown>>,
): number {
  return questions.filter((question) => !isAnswered(question.kind, responses[question.id])).length;
}

/** Plain-text rendering of what the learner answered (file uploads are handled
 * by the caller, which has the file names). */
export function formatAnswer(question: QuestionDTO, response: Record<string, unknown> | undefined): string {
  if (!response || !isAnswered(question.kind, response)) return 'Sin respuesta';
  const content = question.content;
  switch (question.kind) {
    case 'MULTIPLE_CHOICE': {
      const options = Array.isArray(content.options) ? content.options : [];
      const selected = Array.isArray(response.selected) ? response.selected : [];
      return selected.map((index) => textOf(options[Number(index)])).filter(Boolean).join(' · ');
    }
    case 'TRUE_FALSE':
      return response.value ? 'Verdadero' : 'Falso';
    case 'FILL_BLANK': {
      const values = Array.isArray(response.values) ? response.values : [];
      return values.map((value, index) => `Hueco ${index + 1}: ${textOf(value) || '—'}`).join(' · ');
    }
    case 'MATCHING': {
      const left = Array.isArray(content.left) ? content.left : [];
      const right = Array.isArray(content.right) ? content.right : [];
      const pairs = Array.isArray(response.pairs) ? response.pairs : [];
      return pairs.flatMap((pair) => Array.isArray(pair) && pair.length === 2
        ? [`${textOf(left[Number(pair[0])])} → ${textOf(right[Number(pair[1])])}`]
        : []).join(' · ');
    }
    case 'ORDERING': {
      const items = Array.isArray(content.items) ? content.items : [];
      const order = Array.isArray(response.order) ? response.order : [];
      return order.map((index) => textOf(items[Number(index)])).filter(Boolean).join(' → ');
    }
    case 'SHORT_ANSWER':
    case 'ESSAY':
      return String(response.text ?? '');
    case 'FILE_UPLOAD':
      return 'Archivo entregado';
  }
}

export function formatSolution(question: QuestionDTO, content: Record<string, unknown>): string {
  const text = (value: unknown) => typeof value === 'string'
    ? value
    : value && typeof value === 'object' && 'text' in value && typeof value.text === 'string'
      ? value.text
      : String(value ?? '');
  switch (question.kind) {
    case 'MULTIPLE_CHOICE': {
      const options = Array.isArray(content.options) ? content.options : [];
      const correct = Array.isArray(content.correct) ? content.correct : [];
      return correct.map((index) => text(options[Number(index)])).filter(Boolean).join(' · ') || 'Sin respuesta configurada';
    }
    case 'TRUE_FALSE':
      return typeof content.answer === 'boolean' ? (content.answer ? 'Verdadero' : 'Falso') : 'Sin respuesta configurada';
    case 'FILL_BLANK': {
      const blanks = Array.isArray(content.blanks) ? content.blanks : [];
      return blanks.map((blank) => {
        const accepted = blank && typeof blank === 'object' && 'accepted' in blank && Array.isArray(blank.accepted)
          ? blank.accepted
          : [];
        return accepted.map(text).join(' / ');
      }).map((answer, index) => `Hueco ${index + 1}: ${answer}`).join(' · ');
    }
    case 'MATCHING': {
      const left = Array.isArray(content.left) ? content.left : [];
      const right = Array.isArray(content.right) ? content.right : [];
      const pairs = Array.isArray(content.pairs) ? content.pairs : [];
      return pairs.flatMap((pair) => Array.isArray(pair) && pair.length === 2
        ? [`${text(left[Number(pair[0])])} → ${text(right[Number(pair[1])])}`]
        : []).join(' · ');
    }
    case 'ORDERING': {
      const items = Array.isArray(content.items) ? content.items : [];
      const order = Array.isArray(content.correctOrder) ? content.correctOrder : [];
      return order.map((index) => text(items[Number(index)])).filter(Boolean).join(' → ');
    }
    case 'SHORT_ANSWER': {
      const accepted = Array.isArray(content.accepted) ? content.accepted : [];
      return accepted.length ? accepted.map(text).join(' · ') : 'Se corrige a mano';
    }
    case 'ESSAY':
    case 'FILE_UPLOAD':
      return 'Se corrige a mano';
  }
}

