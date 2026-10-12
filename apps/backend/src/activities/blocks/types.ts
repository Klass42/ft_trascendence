import { QuestionKind } from '@prisma/client';

export interface GradeResult {
  correct: boolean;
  awarded: number;
}

export interface BlockKindAdapter {
  kind: QuestionKind;
  validateContent(content: unknown): void;
  validateResponse(response: unknown): void;
  /** Absent ⇒ manual grading. Pure; malformed response → awarded 0. */
  grade?(content: unknown, response: unknown, points: number): GradeResult;
}

export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
