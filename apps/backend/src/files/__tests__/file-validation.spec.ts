import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  MAX_AVATAR_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
  validateUpload,
} from '../file-validation';

const PDF_BYTES = Buffer.from('%PDF-1.4\n%fake but well-formed header');
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF'), Buffer.from([0x10, 0, 0, 0]), Buffer.from('WEBPVP8 '),
]);
const EPUB_BYTES = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(26), Buffer.from('mimetypeapplication/epub+zip'),
]);
const EXE_BYTES = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

const file = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => {
  const buffer = overrides.buffer ?? PDF_BYTES;
  return {
    fieldname: 'file',
    originalname: 'lesson.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: buffer.length,
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
    buffer,
  };
};

describe('validateUpload', () => {
  it('allows supported learning-resource files', () => {
    expect(() => validateUpload(file())).not.toThrow();
    expect(() => validateUpload(file({
      originalname: 'book.epub', mimetype: 'application/epub+zip', buffer: EPUB_BYTES,
    }))).not.toThrow();
    expect(() => validateUpload(file({
      originalname: 'notes.txt', mimetype: 'text/plain', buffer: Buffer.from('apuntes\n'),
    }))).not.toThrow();
  });

  it('accepts a .csv reported as application/vnd.ms-excel (Windows browsers)', () => {
    expect(() => validateUpload(file({
      originalname: 'grades.csv', mimetype: 'application/vnd.ms-excel', buffer: Buffer.from('a,b\n1,2\n'),
    }))).not.toThrow();
  });

  it('rejects missing, empty and unsupported files', () => {
    expect(() => validateUpload(undefined)).toThrow(BadRequestException);
    expect(() => validateUpload(file({ size: 0, buffer: Buffer.alloc(0) }))).toThrow(BadRequestException);
    expect(() => validateUpload(file({ mimetype: 'application/x-msdownload' }))).toThrow(BadRequestException);
  });

  it('rejects an executable disguised as a PDF', () => {
    expect(() => validateUpload(file({ buffer: EXE_BYTES }))).toThrow('File content does not match its type');
  });

  it('rejects an extension that disagrees with the declared type', () => {
    expect(() => validateUpload(file({ originalname: 'payload.exe' })))
      .toThrow('File extension does not match its type');
    expect(() => validateUpload(file({ originalname: 'no-extension' })))
      .toThrow('File extension does not match its type');
    expect(() => validateUpload(file({ originalname: 'image.png' })))
      .toThrow('File extension does not match its type');
  });

  it('rejects binary content declared as plain text', () => {
    expect(() => validateUpload(file({
      originalname: 'notes.txt', mimetype: 'text/plain', buffer: EXE_BYTES,
    }))).toThrow('File content does not match its type');
  });

  it('enforces the general size limit in the service validation', () => {
    const oversized = file({
      size: MAX_UPLOAD_BYTES + 1,
      buffer: Buffer.alloc(1),
    });
    expect(() => validateUpload(oversized)).toThrow(PayloadTooLargeException);
  });

  it('only accepts small raster images as avatars', () => {
    expect(() => validateUpload(file({
      originalname: 'me.webp', mimetype: 'image/webp', buffer: WEBP_BYTES,
    }), 'AVATAR')).not.toThrow();
    expect(() => validateUpload(file({
      originalname: 'me.png', mimetype: 'image/png', buffer: PNG_BYTES,
    }), 'AVATAR')).not.toThrow();
    expect(() => validateUpload(file({ mimetype: 'application/pdf' }), 'AVATAR')).toThrow(BadRequestException);
    expect(() => validateUpload(file({
      originalname: 'me.png', mimetype: 'image/png', buffer: PDF_BYTES,
    }), 'AVATAR')).toThrow('Avatar content does not match its type');
    expect(() => validateUpload(file({
      originalname: 'me.jpg',
      mimetype: 'image/jpeg',
      size: MAX_AVATAR_UPLOAD_BYTES + 1,
      buffer: Buffer.alloc(1),
    }), 'AVATAR')).toThrow(PayloadTooLargeException);
  });
});
