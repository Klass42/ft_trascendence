import { BadRequestException } from '@nestjs/common';
import { QuestionKind } from '@prisma/client';
import { getAdapter } from './registry';

const ESSAY = 'ESSAY' as unknown as QuestionKind;
const FILE_UPLOAD = 'FILE_UPLOAD' as unknown as QuestionKind;

describe('ESSAY adapter', () => {
  const a = () => getAdapter(ESSAY);

  it('accepts empty content and { minChars, maxChars }', () => {
    expect(() => a().validateContent({})).not.toThrow();
    expect(() => a().validateContent({ minChars: 10, maxChars: 500 })).not.toThrow();
  });

  it('rejects minChars > maxChars', () => {
    expect(() => a().validateContent({ minChars: 10, maxChars: 5 })).toThrow(
      BadRequestException,
    );
  });

  it('rejects negative minChars or maxChars', () => {
    expect(() => a().validateContent({ minChars: -1 })).toThrow(BadRequestException);
    expect(() => a().validateContent({ maxChars: -5 })).toThrow(BadRequestException);
  });

  it('accepts { text: string } and rejects missing text', () => {
    expect(() => a().validateResponse({ text: 'hola' })).not.toThrow();
    expect(() => a().validateResponse({})).toThrow(BadRequestException);
  });

  it('has no grade function', () => {
    expect(a().grade).toBeUndefined();
  });
});

describe('FILE_UPLOAD adapter', () => {
  const a = () => getAdapter(FILE_UPLOAD);

  it('requires maxFiles ≥ 1', () => {
    expect(() => a().validateContent({ maxFiles: 3 })).not.toThrow();
    expect(() => a().validateContent({})).toThrow(BadRequestException);
    expect(() => a().validateContent({ maxFiles: 0 })).toThrow(BadRequestException);
  });

  it('accepts optional accept[] of strings', () => {
    expect(() =>
      a().validateContent({ maxFiles: 1, accept: ['application/pdf', '.pdf'] }),
    ).not.toThrow();
  });

  it('rejects non-array fileIds', () => {
    expect(() => a().validateResponse({ fileIds: 'x' })).toThrow(BadRequestException);
  });

  it('rejects empty-string fileIds', () => {
    expect(() => a().validateResponse({ fileIds: [''] })).toThrow(BadRequestException);
  });

  it('accepts one fileId', () => {
    expect(() => a().validateResponse({ fileIds: ['file-1'] })).not.toThrow();
  });

  it('has no grade function', () => {
    expect(a().grade).toBeUndefined();
  });
});
