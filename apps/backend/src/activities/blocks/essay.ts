import { BadRequestException } from '@nestjs/common';
import { QuestionKind } from '@prisma/client';
import { asRecord, type BlockKindAdapter } from './types';

function optionalNonNegInt(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new BadRequestException(`ESSAY ${field} must be an integer ≥ 0`);
  }
  return value;
}

export const essayAdapter: BlockKindAdapter = {
  kind: QuestionKind.ESSAY,
  validateContent(content: unknown): void {
    const c = asRecord(content);
    const minChars = optionalNonNegInt(c.minChars, 'minChars');
    const maxChars = optionalNonNegInt(c.maxChars, 'maxChars');
    if (minChars !== undefined && maxChars !== undefined && minChars > maxChars) {
      throw new BadRequestException('El mínimo de caracteres no puede superar el máximo.');
    }
  },
  validateResponse(response: unknown): void {
    const r = asRecord(response);
    if (typeof r.text !== 'string') {
      throw new BadRequestException('ESSAY response requires text: string');
    }
  },
};
