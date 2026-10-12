import { BadRequestException } from '@nestjs/common';
import { QuestionKind } from '@prisma/client';
import { gradeQuestion, GRADERS } from '../grading/graders';
import { essayAdapter } from './essay';
import { fileUploadAdapter } from './file-upload';
import type { BlockKindAdapter } from './types';

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function validateLegacyContent(kind: QuestionKind, content: unknown): void {
  const c = asRecord(content);
  const isStrArr = (v: unknown) =>
    Array.isArray(v) && v.every((x) => typeof x === 'string');
  const isIdxArr = (v: unknown, max: number) =>
    Array.isArray(v) &&
    v.every((x) => Number.isInteger(x) && x >= 0 && x < max);
  const bad = (msg: string) => {
    throw new BadRequestException(msg);
  };

  switch (kind) {
    case QuestionKind.MULTIPLE_CHOICE: {
      if (!isStrArr(c.options) || (c.options as string[]).length < 2) {
        bad('MULTIPLE_CHOICE requires options: string[] (≥2)');
      }
      if (
        !isIdxArr(c.correct, (c.options as string[]).length) ||
        (c.correct as number[]).length < 1
      ) {
        bad('MULTIPLE_CHOICE requires correct: valid option indices (≥1)');
      }
      break;
    }
    case QuestionKind.TRUE_FALSE:
      if (typeof c.answer !== 'boolean') bad('TRUE_FALSE requires answer: boolean');
      break;
    case QuestionKind.FILL_BLANK: {
      const blanks = c.blanks;
      if (!Array.isArray(blanks) || blanks.length < 1) {
        bad('FILL_BLANK requires blanks: { accepted: string[] }[] (≥1)');
      }
      (blanks as unknown[]).forEach((b, i) => {
        const accepted = (b as Record<string, unknown>)?.accepted;
        if (!isStrArr(accepted) || (accepted as string[]).length < 1) {
          bad(`FILL_BLANK blank #${i + 1} needs accepted: string[] (≥1)`);
        }
      });
      break;
    }
    case QuestionKind.MATCHING: {
      const { left, right, pairs } = c;
      if (!isStrArr(left) || (left as string[]).length < 1) {
        bad('MATCHING requires left: string[] (≥1)');
      }
      if (!isStrArr(right) || (right as string[]).length < 1) {
        bad('MATCHING requires right: string[] (≥1)');
      }
      if (
        !Array.isArray(pairs) ||
        pairs.length < 1 ||
        !pairs.every(
          (p) =>
            Array.isArray(p) &&
            p.length === 2 &&
            Number.isInteger(p[0]) &&
            p[0] >= 0 &&
            p[0] < (left as string[]).length &&
            Number.isInteger(p[1]) &&
            p[1] >= 0 &&
            p[1] < (right as string[]).length,
        )
      ) {
        bad('MATCHING requires pairs: [leftIdx, rightIdx][] within bounds');
      }
      break;
    }
    case QuestionKind.ORDERING: {
      const { items, correctOrder } = c;
      if (!isStrArr(items) || (items as string[]).length < 2) {
        bad('ORDERING requires items: string[] (≥2)');
      }
      const n = (items as string[]).length;
      if (
        !Array.isArray(correctOrder) ||
        correctOrder.length !== n ||
        new Set(correctOrder).size !== n ||
        !isIdxArr(correctOrder, n)
      ) {
        bad('ORDERING requires correctOrder: a permutation of item indices');
      }
      break;
    }
    case QuestionKind.SHORT_ANSWER:
      if (c.accepted !== undefined && !isStrArr(c.accepted)) {
        bad('SHORT_ANSWER accepted must be string[] when provided');
      }
      break;
    default:
      bad(`Unsupported question kind: ${kind}`);
  }
}

function legacyAdapter(kind: QuestionKind): BlockKindAdapter {
  const grader = GRADERS[kind];
  return {
    kind,
    validateContent: (content) => validateLegacyContent(kind, content),
    validateResponse: () => undefined,
    ...(grader
      ? {
          grade: (content: unknown, response: unknown, points: number) =>
            gradeQuestion(kind, content, response, points),
        }
      : {}),
  };
}

const BLOCK_ADAPTERS: Record<QuestionKind, BlockKindAdapter> = {
  [QuestionKind.MULTIPLE_CHOICE]: legacyAdapter(QuestionKind.MULTIPLE_CHOICE),
  [QuestionKind.TRUE_FALSE]: legacyAdapter(QuestionKind.TRUE_FALSE),
  [QuestionKind.FILL_BLANK]: legacyAdapter(QuestionKind.FILL_BLANK),
  [QuestionKind.MATCHING]: legacyAdapter(QuestionKind.MATCHING),
  [QuestionKind.ORDERING]: legacyAdapter(QuestionKind.ORDERING),
  [QuestionKind.SHORT_ANSWER]: legacyAdapter(QuestionKind.SHORT_ANSWER),
  [QuestionKind.ESSAY]: essayAdapter,
  [QuestionKind.FILE_UPLOAD]: fileUploadAdapter,
};

export function getAdapter(kind: QuestionKind): BlockKindAdapter {
  const adapter = BLOCK_ADAPTERS[kind];
  if (!adapter) {
    throw new BadRequestException(`Unsupported question kind: ${kind}`);
  }
  return adapter;
}
