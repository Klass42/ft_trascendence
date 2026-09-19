import { BadRequestException } from '@nestjs/common';
import { QuestionKind } from '@prisma/client';
import { asRecord, type BlockKindAdapter } from './types';

export const fileUploadAdapter: BlockKindAdapter = {
  kind: QuestionKind.FILE_UPLOAD,
  validateContent(content: unknown): void {
    const c = asRecord(content);
    if (
      typeof c.maxFiles !== 'number' ||
      !Number.isInteger(c.maxFiles) ||
      c.maxFiles < 1
    ) {
      throw new BadRequestException(
        'FILE_UPLOAD requires maxFiles: integer ≥ 1',
      );
    }
    if (
      c.accept !== undefined &&
      (!Array.isArray(c.accept) ||
        !c.accept.every((x) => typeof x === 'string'))
    ) {
      throw new BadRequestException('FILE_UPLOAD accept must be string[]');
    }
  },
  validateResponse(response: unknown): void {
    const r = asRecord(response);
    if (
      !Array.isArray(r.fileIds) ||
      !r.fileIds.every((id) => typeof id === 'string' && id.length > 0)
    ) {
      throw new BadRequestException(
        'FILE_UPLOAD response requires fileIds: nonempty string[]',
      );
    }
  },
};
