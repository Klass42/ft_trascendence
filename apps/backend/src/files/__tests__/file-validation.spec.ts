import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  MAX_AVATAR_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
  validateUpload,
} from '../file-validation';

const file = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
  fieldname: 'file',
  originalname: 'lesson.pdf',
  encoding: '7bit',
  mimetype: 'application/pdf',
  size: 3,
  buffer: Buffer.from('pdf'),
  stream: undefined as never,
  destination: '',
  filename: '',
  path: '',
  ...overrides,
});

describe('validateUpload', () => {
  it('allows supported learning-resource files', () => {
    expect(() => validateUpload(file())).not.toThrow();
    expect(() => validateUpload(file({ mimetype: 'application/epub+zip' }))).not.toThrow();
  });

  it('rejects missing, empty and unsupported files', () => {
    expect(() => validateUpload(undefined)).toThrow(BadRequestException);
    expect(() => validateUpload(file({ size: 0, buffer: Buffer.alloc(0) }))).toThrow(BadRequestException);
    expect(() => validateUpload(file({ mimetype: 'application/x-msdownload' }))).toThrow(BadRequestException);
  });

  it('enforces the general size limit in the service validation', () => {
    const oversized = file({
      size: MAX_UPLOAD_BYTES + 1,
      buffer: Buffer.alloc(1),
    });
    expect(() => validateUpload(oversized)).toThrow(PayloadTooLargeException);
  });

  it('only accepts small raster images as avatars', () => {
    expect(() => validateUpload(file({ mimetype: 'image/webp' }), 'AVATAR')).not.toThrow();
    expect(() => validateUpload(file({ mimetype: 'application/pdf' }), 'AVATAR')).toThrow(BadRequestException);
    expect(() => validateUpload(file({
      mimetype: 'image/jpeg',
      size: MAX_AVATAR_UPLOAD_BYTES + 1,
      buffer: Buffer.alloc(1),
    }), 'AVATAR')).toThrow(PayloadTooLargeException);
  });
});
