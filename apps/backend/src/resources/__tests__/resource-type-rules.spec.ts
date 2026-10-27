import { BadRequestException } from '@nestjs/common';
import { assertResourceTypeRules } from '../resources.service';

describe('assertResourceTypeRules (#24)', () => {
  it('allows ISBN and publisher on BOOK', () => {
    expect(() => assertResourceTypeRules({ type: 'BOOK', isbn: '978', publisher: 'X', fileId: 'f1' })).not.toThrow();
  });
  it.each(['DOCUMENT', 'VIDEO', 'AUDIO', 'LINK'] as const)('rejects ISBN/publisher on %s', (type) => {
    expect(() => assertResourceTypeRules({ type, isbn: '978', externalUrl: 'https://a.b' })).toThrow(BadRequestException);
    expect(() => assertResourceTypeRules({ type, publisher: 'X', externalUrl: 'https://a.b' })).toThrow(BadRequestException);
  });
  it('ignores empty ISBN/publisher on non-BOOK', () => {
    expect(() => assertResourceTypeRules({ type: 'DOCUMENT', isbn: ' ', publisher: null, fileId: 'f1' })).not.toThrow();
  });
  it('rejects a file on LINK', () => {
    expect(() => assertResourceTypeRules({ type: 'LINK', fileId: 'f1' })).toThrow(BadRequestException);
  });
  it('requires a URL on LINK', () => {
    expect(() => assertResourceTypeRules({ type: 'LINK' })).toThrow(BadRequestException);
    expect(() => assertResourceTypeRules({ type: 'LINK', externalUrl: 'https://a.b' })).not.toThrow();
  });
});
