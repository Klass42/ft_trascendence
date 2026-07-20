/**
 * Auto-grading engine for objective question kinds.
 *
 * Each grader is a PURE function `(content, response, points) => GradeResult`.
 * `content` is the DTO-validated question definition; `response` is the
 * student's raw (untrusted) answer, so every grader defends against malformed
 * shapes and returns zero rather than throwing. Partial credit is awarded where
 * it's natural (per blank, per matched pair); other kinds are all-or-nothing.
 *
 * Adding a new objective kind = add its content DTO + one grader here + register
 * it in GRADERS. Subjective kinds (no entry here) fall through to manual grading.
 */
import { QuestionKind } from '@prisma/client';
import { matchesAccepted, NormalizeOptions, normalizeText } from './normalize';

export interface GradeResult {
  /** Full marks (every part correct). */
  correct: boolean;
  /** Points awarded, clamped to [0, points]. */
  awarded: number;
}

export type Grader = (
  content: unknown,
  response: unknown,
  points: number,
) => GradeResult;

const zero = (): GradeResult => ({ correct: false, awarded: 0 });
const full = (points: number): GradeResult => ({
  correct: true,
  awarded: points,
});

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/** Set-equality over numeric indices (order-independent, dedup-safe). */
function sameIndexSet(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  const sa = new Set(a.map(Number));
  const sb = new Set(b.map(Number));
  if (sa.size !== sb.size) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}

// ─── MULTIPLE_CHOICE ────────────────────────────────────────────────────────
// content: { options: string[], correct: number[] }  response: { selected: number[] }
// All-or-nothing: the selected set must equal the correct set exactly.
const gradeMultipleChoice: Grader = (content, response, points) => {
  const correct = asRecord(content).correct;
  const selected = asRecord(response).selected;
  return sameIndexSet(correct, selected) ? full(points) : zero();
};

// ─── TRUE_FALSE ─────────────────────────────────────────────────────────────
// content: { answer: boolean }  response: { value: boolean }
const gradeTrueFalse: Grader = (content, response, points) => {
  const answer = asRecord(content).answer;
  const value = asRecord(response).value;
  return typeof answer === 'boolean' && value === answer ? full(points) : zero();
};

// ─── FILL_BLANK ─────────────────────────────────────────────────────────────
// content: { blanks: { accepted: string[] }[], caseSensitive?, ignoreAccents? }
// response: { values: string[] }   Partial credit: one share per matched blank.
const gradeFillBlank: Grader = (content, response, points) => {
  const c = asRecord(content);
  const blanks = Array.isArray(c.blanks) ? c.blanks : [];
  if (blanks.length === 0) return zero();
  const values = Array.isArray(asRecord(response).values)
    ? (asRecord(response).values as unknown[])
    : [];
  const opts: NormalizeOptions = {
    caseSensitive: c.caseSensitive === true,
    ignoreAccents: c.ignoreAccents !== false,
  };
  let matched = 0;
  blanks.forEach((blank, i) => {
    const accepted = asRecord(blank).accepted;
    if (matchesAccepted(values[i], accepted, opts)) matched += 1;
  });
  const awarded = (points * matched) / blanks.length;
  return { correct: matched === blanks.length, awarded };
};

// ─── MATCHING ───────────────────────────────────────────────────────────────
// content: { left: string[], right: string[], pairs: [number,number][] }
// response: { pairs: [number,number][] }   Partial credit: per correct pair.
const gradeMatching: Grader = (content, response, points) => {
  const pairs = asRecord(content).pairs;
  if (!Array.isArray(pairs) || pairs.length === 0) return zero();
  const given = asRecord(response).pairs;
  const givenList: unknown[] = Array.isArray(given) ? given : [];
  // Map left→right from the student's answer (last write wins).
  const answer = new Map<number, number>();
  for (const p of givenList) {
    if (Array.isArray(p) && p.length === 2) answer.set(Number(p[0]), Number(p[1]));
  }
  let matched = 0;
  for (const p of pairs) {
    if (Array.isArray(p) && p.length === 2 && answer.get(Number(p[0])) === Number(p[1])) {
      matched += 1;
    }
  }
  const awarded = (points * matched) / pairs.length;
  return { correct: matched === pairs.length, awarded };
};

// ─── ORDERING ───────────────────────────────────────────────────────────────
// content: { items: string[], correctOrder: number[] }  response: { order: number[] }
// All-or-nothing: the sequence must match exactly.
const gradeOrdering: Grader = (content, response, points) => {
  const correctOrder = asRecord(content).correctOrder;
  const order = asRecord(response).order;
  if (!Array.isArray(correctOrder) || !Array.isArray(order)) return zero();
  if (correctOrder.length !== order.length) return zero();
  const ok = correctOrder.every((v, i) => Number(v) === Number(order[i]));
  return ok ? full(points) : zero();
};

// ─── SHORT_ANSWER ───────────────────────────────────────────────────────────
// content: { accepted: string[], caseSensitive?, ignoreAccents? }  response: { text }
// An EMPTY `accepted` list marks the question subjective → not auto-gradable
// (isAutoGradable returns false), so this grader only runs when accepted exists.
const gradeShortAnswer: Grader = (content, response, points) => {
  const c = asRecord(content);
  const opts: NormalizeOptions = {
    caseSensitive: c.caseSensitive === true,
    ignoreAccents: c.ignoreAccents !== false,
  };
  return matchesAccepted(asRecord(response).text, c.accepted, opts)
    ? full(points)
    : zero();
};

export const GRADERS: Partial<Record<QuestionKind, Grader>> = {
  [QuestionKind.MULTIPLE_CHOICE]: gradeMultipleChoice,
  [QuestionKind.TRUE_FALSE]: gradeTrueFalse,
  [QuestionKind.FILL_BLANK]: gradeFillBlank,
  [QuestionKind.MATCHING]: gradeMatching,
  [QuestionKind.ORDERING]: gradeOrdering,
  [QuestionKind.SHORT_ANSWER]: gradeShortAnswer,
};

/**
 * Whether a question can be graded automatically. Every objective kind has a
 * grader; SHORT_ANSWER additionally needs a non-empty `accepted` list (an empty
 * list is the author's way of saying "grade this by hand").
 */
export function isAutoGradable(kind: QuestionKind, content: unknown): boolean {
  if (!GRADERS[kind]) return false;
  if (kind === QuestionKind.SHORT_ANSWER) {
    const accepted = asRecord(content).accepted;
    return Array.isArray(accepted) && accepted.length > 0;
  }
  return true;
}

/** Grade one question; normalises the raw awarded value into [0, points]. */
export function gradeQuestion(
  kind: QuestionKind,
  content: unknown,
  response: unknown,
  points: number,
): GradeResult {
  const grader = GRADERS[kind];
  if (!grader) return zero();
  const { correct, awarded } = grader(content, response, points);
  const clamped = Math.max(0, Math.min(points, Number.isFinite(awarded) ? awarded : 0));
  return { correct, awarded: clamped };
}

export { normalizeText };
